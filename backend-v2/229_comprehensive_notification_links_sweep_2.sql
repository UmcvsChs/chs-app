create or replace function pay_for_property(p_offer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_property_id uuid;
  v_status text;
  v_payment_status text;
  v_breakdown record;
  v_buyer_balance numeric;
  v_reference text;
  v_deadline_days int;
begin
  select buyer_id, property_id, status, payment_status
    into v_buyer_id, v_property_id, v_status, v_payment_status
    from offers where id = p_offer_id;

  select owner_id into v_seller_id from properties where id = v_property_id;

  if v_buyer_id != auth.uid() then
    raise exception 'Only the real buyer on this offer can make this payment.';
  end if;
  if v_status != 'accepted' then
    raise exception 'This offer has not been accepted yet.';
  end if;
  if v_payment_status = 'paid' then
    raise exception 'This property has already been paid for.';
  end if;

  select * into v_breakdown from get_sale_commission_breakdown(p_offer_id);

  select main_balance into v_buyer_balance from wallets where user_id = v_buyer_id;
  if v_buyer_balance is null or v_buyer_balance < v_breakdown.buyer_total then
    raise exception 'Insufficient wallet balance. Total due (including your commission) is %.', v_breakdown.buyer_total;
  end if;

  v_reference := 'SALEPAY-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - v_breakdown.buyer_total, updated_at = now() where user_id = v_buyer_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_buyer_id, 'main', v_breakdown.buyer_total, 'debit', 'Property purchase (price + commission)', v_reference);

  update wallets set escrow_held = escrow_held + v_breakdown.seller_net, updated_at = now() where user_id = v_seller_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_seller_id, 'escrow_held', v_breakdown.seller_net, 'credit', 'Property sale proceeds — held pending real legal document transfer', v_reference);

  insert into transaction_commissions (transaction_type, offer_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount, status, paid_at)
  values
    ('sale', p_offer_id, v_property_id, v_buyer_id, 'buyer', v_breakdown.offer_amount, v_breakdown.buyer_pct, v_breakdown.buyer_commission, 'paid', now()),
    ('sale', p_offer_id, v_property_id, v_seller_id, 'seller', v_breakdown.offer_amount, v_breakdown.seller_pct, v_breakdown.seller_commission, 'paid', now());

  select value::int into v_deadline_days from platform_settings where key = 'sale_document_deadline_days';

  update offers set payment_status = 'paid', chs_cleared = true, document_deadline = now() + (coalesce(v_deadline_days, 14) || ' days')::interval where id = p_offer_id;
  update properties set status = 'sold' where id = v_property_id;

  perform notify_user(v_seller_id, '💰 Property sold and paid!',
    'The buyer has paid in full — ' || v_breakdown.seller_net || ' is now visible in your wallet, held pending confirmation that all real legal documents have been transferred to the buyer. Please ensure this happens within ' || coalesce(v_deadline_days, 14) || ' working days.',
    '/property/' || v_property_id);
  perform notify_user(v_buyer_id, '🎉 Payment successful!',
    'You paid ' || v_breakdown.buyer_total || ' total. CHS is now acting on your behalf to ensure all real legal documents are delivered to you within ' || coalesce(v_deadline_days, 14) || ' working days. If they have not arrived by then, you can request a refund and cancel this deal.',
    '/property/' || v_property_id);
end;
$$;

create or replace function pay_for_property_agent_managed(p_offer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_agent_id uuid;
  v_property_id uuid;
  v_status text;
  v_payment_status text;
  v_breakdown record;
  v_buyer_balance numeric;
  v_reference text;
  v_deadline_days int;
begin
  select buyer_id, property_id, status, payment_status
    into v_buyer_id, v_property_id, v_status, v_payment_status
    from offers where id = p_offer_id;

  select owner_id, managing_agent_id into v_seller_id, v_agent_id from properties where id = v_property_id;

  if v_buyer_id != auth.uid() then
    raise exception 'Only the real buyer on this offer can make this payment.';
  end if;
  if v_status != 'accepted' then
    raise exception 'This offer has not been accepted yet.';
  end if;
  if v_payment_status = 'paid' then
    raise exception 'This property has already been paid for.';
  end if;

  select * into v_breakdown from get_agent_commission_breakdown(p_offer_id);
  if v_breakdown.agent_pct is null then
    raise exception 'This property has no real agent commission rate set — use the standard payment instead.';
  end if;

  select main_balance into v_buyer_balance from wallets where user_id = v_buyer_id;
  if v_buyer_balance is null or v_buyer_balance < v_breakdown.buyer_total then
    raise exception 'Insufficient wallet balance. Total due is %.', v_breakdown.buyer_total;
  end if;

  v_reference := 'AGENTSALE-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - v_breakdown.buyer_total, updated_at = now() where user_id = v_buyer_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_buyer_id, 'main', v_breakdown.buyer_total, 'debit', 'Property purchase (agent-managed, real agreed price)', v_reference);

  update wallets set escrow_held = escrow_held + v_breakdown.seller_net, updated_at = now() where user_id = v_seller_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_seller_id, 'escrow_held', v_breakdown.seller_net, 'credit', 'Property sale proceeds, net of real agent commission — held pending legal transfer', v_reference);

  update wallets set main_balance = main_balance + v_breakdown.agent_net, updated_at = now() where user_id = v_agent_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_agent_id, 'main', v_breakdown.agent_net, 'credit', 'Real agent commission earned, net of CHS platform fee', v_reference);

  insert into transaction_commissions (transaction_type, offer_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount, status, paid_at)
  values ('agent_managed_sale', p_offer_id, v_property_id, v_agent_id, 'agent', v_breakdown.agent_commission, v_breakdown.chs_fee_pct, v_breakdown.chs_fee_amount, 'paid', now());

  select value::int into v_deadline_days from platform_settings where key = 'sale_document_deadline_days';
  update offers set payment_status = 'paid', chs_cleared = true, document_deadline = now() + (coalesce(v_deadline_days, 14) || ' days')::interval where id = p_offer_id;
  update properties set status = 'sold' where id = v_property_id;

  perform notify_user(v_seller_id, '💰 Property sold and paid!', 'The buyer has paid in full. ' || v_breakdown.seller_net || ' is now held in your wallet pending legal document transfer.', '/property/' || v_property_id);
  perform notify_user(v_agent_id, '💰 Your real commission has been paid', 'You earned ' || v_breakdown.agent_net || ' (your ' || v_breakdown.agent_commission || ' commission, net of CHS''s ' || v_breakdown.chs_fee_pct || '% platform fee).', '/agent');
  perform notify_user(v_buyer_id, '🎉 Payment successful!', 'You paid ' || v_breakdown.buyer_total || ' — the real agreed price for this property.', '/property/' || v_property_id);
end;
$$;

create or replace function request_sale_refund(p_offer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_property_id uuid;
  v_deadline timestamptz;
  v_payment_status text;
  v_legal_confirmed boolean;
  v_buyer_total numeric;
  v_seller_net numeric;
begin
  select buyer_id, property_id, document_deadline, payment_status, legal_transfer_confirmed
    into v_buyer_id, v_property_id, v_deadline, v_payment_status, v_legal_confirmed
    from offers where id = p_offer_id;

  if v_buyer_id != auth.uid() then
    raise exception 'Only the real buyer on this offer can request this refund.';
  end if;
  if v_payment_status != 'paid' then
    raise exception 'This offer was never paid for.';
  end if;
  if v_legal_confirmed then
    raise exception 'The real legal document transfer has already been confirmed complete — a refund is no longer available.';
  end if;
  if now() < v_deadline then
    raise exception 'The document delivery window has not yet passed. It ends on %.', v_deadline;
  end if;

  select owner_id into v_seller_id from properties where id = v_property_id;

  select amount + (amount * (select value::numeric from platform_settings where key = 'sale_commission_buyer_percentage') / 100)
    into v_buyer_total
    from offers where id = p_offer_id;
  select escrow_held into v_seller_net from wallets where user_id = v_seller_id;

  update wallets set main_balance = main_balance + v_buyer_total, updated_at = now() where user_id = v_buyer_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_buyer_id, 'main', v_buyer_total, 'credit', 'Full refund — legal documents not delivered in time', 'REFUND-' || substr(gen_random_uuid()::text, 1, 8));

  update wallets set escrow_held = 0, updated_at = now() where user_id = v_seller_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_seller_id, 'escrow_held', v_seller_net, 'debit', 'Sale reversed — refunded to buyer, documents not delivered in time', 'REFUND-' || substr(gen_random_uuid()::text, 1, 8));

  update offers set refund_status = 'refunded', payment_status = 'unpaid', status = 'rejected' where id = p_offer_id;
  update properties set status = 'active' where id = v_property_id;
  delete from transaction_commissions where offer_id = p_offer_id;

  perform notify_user(v_seller_id, '⚠️ Sale reversed — refund issued',
    'The buyer requested a refund because the real legal documents were not delivered within the agreed window. The full amount has been reversed from your held balance, and this deal is now cancelled.',
    '/property/' || v_property_id);
  perform notify_user(v_buyer_id, '✓ Refund issued', 'Your full payment of ' || v_buyer_total || ' has been refunded to your wallet.', '/wallet');
end;
$$;

create or replace function complete_agent_referral(p_referral_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_chs_commission numeric;
  v_agent_share_pct numeric;
  v_split_50_50 boolean;
  v_listing_agent_id uuid;
  v_referring_agent_id uuid;
  v_payout numeric;
  v_half numeric;
  v_reference text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can complete a referral and trigger payout.';
  end if;

  select chs_commission, agent_share_pct, split_50_50, listing_agent_id, referring_agent_id
    into v_chs_commission, v_agent_share_pct, v_split_50_50, v_listing_agent_id, v_referring_agent_id
    from agent_referrals where id = p_referral_id;

  if v_chs_commission is null then
    raise exception 'This referral has no real commission amount set.';
  end if;

  if v_split_50_50 and v_listing_agent_id is not null and v_referring_agent_id is not null and v_listing_agent_id != v_referring_agent_id then
    v_half := round(v_chs_commission * 0.5, 2);
    v_reference := 'AGREF-' || substr(gen_random_uuid()::text, 1, 8);

    update wallets set main_balance = main_balance + v_half, updated_at = now() where user_id = v_listing_agent_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (v_listing_agent_id, 'main', v_half, 'credit', 'Agent referral payout (co-broker split)', v_reference);

    update wallets set main_balance = main_balance + v_half, updated_at = now() where user_id = v_referring_agent_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (v_referring_agent_id, 'main', v_half, 'credit', 'Agent referral payout (co-broker split)', v_reference);

    update agent_referrals set stage = 'completed', agent_payout = v_half where id = p_referral_id;

    perform notify_user(v_listing_agent_id, '💰 Referral payout received', 'You have been paid ' || v_half || ' for a completed co-broker referral.', '/agent');
    perform notify_user(v_referring_agent_id, '💰 Referral payout received', 'You have been paid ' || v_half || ' for a completed co-broker referral.', '/agent');
  else
    v_payout := round(v_chs_commission * coalesce(v_agent_share_pct, 0) / 100, 2);
    v_reference := 'AGREF-' || substr(gen_random_uuid()::text, 1, 8);

    update wallets set main_balance = main_balance + v_payout, updated_at = now() where user_id = v_referring_agent_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (v_referring_agent_id, 'main', v_payout, 'credit', 'Agent referral payout', v_reference);

    update agent_referrals set stage = 'completed', agent_payout = v_payout where id = p_referral_id;

    perform notify_user(v_referring_agent_id, '💰 Referral payout received', 'You have been paid ' || v_payout || ' for a completed referral.', '/agent');
  end if;
end;
$$;
