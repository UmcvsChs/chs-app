-- Real, corrected design per direct client instruction: blocking a
-- buyer's payment on document pre-verification created unnecessary
-- delay and never let anyone actually test the payment flow. The
-- real, better design: let payment proceed immediately once an offer
-- is accepted, CHS coordinates the real document handover afterward,
-- and the buyer gets a genuine, time-boxed refund right if it doesn't
-- happen — the actual honest safety net, not a pre-payment gate.
--
-- Also corrected the information shown to each side: the buyer never
-- sees what the seller nets, and the seller never sees the buyer's
-- own commission — each side only sees its own real numbers, matching
-- how real negotiation actually works.

alter table offers add column if not exists document_deadline timestamptz;
alter table offers add column if not exists refund_status text default 'none' check (refund_status in ('none', 'requested', 'refunded'));

insert into platform_settings (key, value) values
  ('sale_document_deadline_days', '14')
on conflict (key) do nothing;

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
    'The buyer has paid in full — ' || v_breakdown.seller_net || ' is now visible in your wallet, held pending confirmation that all real legal documents have been transferred to the buyer. Please ensure this happens within ' || coalesce(v_deadline_days, 14) || ' working days.');
  perform notify_user(v_buyer_id, '🎉 Payment successful!',
    'You paid ' || v_breakdown.buyer_total || ' total. CHS is now acting on your behalf to ensure all real legal documents are delivered to you within ' || coalesce(v_deadline_days, 14) || ' working days. If they have not arrived by then, you can request a refund and cancel this deal.');
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
    'The buyer requested a refund because the real legal documents were not delivered within the agreed window. The full amount has been reversed from your held balance, and this deal is now cancelled.');
  perform notify_user(v_buyer_id, '✓ Refund issued', 'Your full payment of ' || v_buyer_total || ' has been refunded to your wallet.');
end;
$$;
