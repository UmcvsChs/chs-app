-- Real, complete audit of every commission-bearing function's
-- notifications, per direct client instruction to extend the same
-- accounting-grade standard already applied to rent "across board."
-- Confirmed directly, function by function, before fixing anything:
--
--   * pay_for_property / pay_for_property_agent_managed (SALE) --
--     typically the largest real amounts on the platform -- had NO
--     admin notification at all. Admin learned of a real sale only by
--     noticing it in Escrow Oversight. Fixed, with the full real
--     breakdown. Tested directly: a real ₦5,325,000 sale payment now
--     correctly notifies admin with "Price: 5000000.00. Buyer's CHS
--     commission: 325000.00. Seller's CHS commission (deducted at
--     source): 300000.00. Net held in escrow for seller: 4700000.00.
--     Total platform earning: 625000.00."
--
--   * release_direct_order_to_vendor / release_marketplace_escrow_to_
--     vendor / release_shortlet_funds_to_host -- told the real
--     recipient "your real net proceeds have been credited" with NO
--     NUMBER at all -- worse than an incomplete breakdown, a missing
--     amount entirely. Fixed to state the real net, the real
--     commission deducted, and the real reference. Admin notification
--     added to all three -- previously missing.
--
--   * accept_marketplace_quote / buy_product_direct -- admin was
--     notified of a total only, never the real buyer/vendor
--     commission split. Fixed with the full breakdown.
--
--   * host_decide_shortlet_booking -- confirming a real booking (real
--     commission now accruing) had no admin notification at all on
--     the accept path. Fixed.
--
--   * confirm_job_completion (artisan) -- no admin notification at
--     all. Fixed. One real mistake of my own caught and fixed in the
--     same session: a property_id (uuid) was mistakenly selected into
--     a variable declared text, which happened to still work only
--     because Postgres silently cast it through text and back -- not
--     because the code was actually correct. Corrected with a proper,
--     separate uuid variable before any real artisan payment could
--     depend on it.
--
--   * pay_rent_to_own_installment -- no admin notification, no
--     breakdown shown to buyer or seller. Fixed.

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
  v_buyer_name text;
  v_property_title text;
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
  values (v_buyer_id, 'main', v_breakdown.buyer_total, 'debit', 'Property purchase (price ' || v_breakdown.offer_amount || ' + your CHS commission ' || v_breakdown.buyer_commission || ')', v_reference);

  update wallets set escrow_held = escrow_held + v_breakdown.seller_net, updated_at = now() where user_id = v_seller_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_seller_id, 'escrow_held', v_breakdown.seller_net, 'credit', 'Property sale proceeds, net of CHS commission ' || v_breakdown.seller_commission || ' (deducted at source) — held pending real legal document transfer', v_reference);

  insert into transaction_commissions (transaction_type, offer_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount, status, paid_at)
  values
    ('sale', p_offer_id, v_property_id, v_buyer_id, 'buyer', v_breakdown.offer_amount, v_breakdown.buyer_pct, v_breakdown.buyer_commission, 'paid', now()),
    ('sale', p_offer_id, v_property_id, v_seller_id, 'seller', v_breakdown.offer_amount, v_breakdown.seller_pct, v_breakdown.seller_commission, 'paid', now());

  select value::int into v_deadline_days from platform_settings where key = 'sale_document_deadline_days';

  update offers set payment_status = 'paid', chs_cleared = true, document_deadline = now() + (coalesce(v_deadline_days, 14) || ' days')::interval where id = p_offer_id;
  update properties set status = 'sold' where id = v_property_id;

  perform notify_user(v_seller_id, '💰 Property sold and paid!',
    'The buyer paid ' || v_breakdown.buyer_total || ' in total (price ' || v_breakdown.offer_amount || ' + their CHS commission ' || v_breakdown.buyer_commission || '). Your CHS commission of ' || v_breakdown.seller_commission || ' has been deducted at source — ' || v_breakdown.seller_net || ' is now visible in your wallet, held pending confirmation that all real legal documents have been transferred to the buyer. Please ensure this happens within ' || coalesce(v_deadline_days, 14) || ' working days.',
    '/property/' || v_property_id);
  perform notify_user(v_buyer_id, '🎉 Payment successful!',
    'You paid ' || v_breakdown.buyer_total || ' in total (price ' || v_breakdown.offer_amount || ' + your CHS commission ' || v_breakdown.buyer_commission || '). CHS is now acting on your behalf to ensure all real legal documents are delivered to you within ' || coalesce(v_deadline_days, 14) || ' working days. If they have not arrived by then, you can request a refund and cancel this deal.',
    '/property/' || v_property_id);

  select full_name into v_buyer_name from profiles where id = v_buyer_id;
  select title into v_property_title from properties where id = v_property_id;
  perform notify_admins_by_domain('owner_buyer_tenant', '💰 Real property sale payment received',
    v_buyer_name || ' paid ' || v_breakdown.buyer_total || ' in total for ' || v_property_title || '. ' ||
    'Breakdown — Price: ' || v_breakdown.offer_amount || '. ' ||
    'Buyer''s CHS commission: ' || v_breakdown.buyer_commission || '. ' ||
    'Seller''s CHS commission (deducted at source): ' || v_breakdown.seller_commission || '. ' ||
    'Net held in escrow for seller: ' || v_breakdown.seller_net || '. ' ||
    'Total platform earning on this transaction: ' || (v_breakdown.buyer_commission + v_breakdown.seller_commission) || '.',
    '/admin?tab=escrowoversight');
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
  v_buyer_name text;
  v_property_title text;
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

  perform notify_user(v_seller_id, '💰 Property sold and paid!', 'The buyer paid ' || v_breakdown.buyer_total || ' in total, the real agreed price. ' || v_breakdown.seller_net || ' (net of the agent''s commission) is now held in your wallet pending legal document transfer.', '/property/' || v_property_id);
  perform notify_user(v_agent_id, '💰 Your real commission has been paid', 'You earned ' || v_breakdown.agent_net || ' (your ' || v_breakdown.agent_commission || ' commission, net of CHS''s ' || v_breakdown.chs_fee_pct || '% platform fee of ' || v_breakdown.chs_fee_amount || ').', '/agent');
  perform notify_user(v_buyer_id, '🎉 Payment successful!', 'You paid ' || v_breakdown.buyer_total || ' — the real agreed price for this property.', '/property/' || v_property_id);

  select full_name into v_buyer_name from profiles where id = v_buyer_id;
  select title into v_property_title from properties where id = v_property_id;
  perform notify_admins_by_domain('owner_buyer_tenant', '💰 Real agent-managed sale payment received',
    v_buyer_name || ' paid ' || v_breakdown.buyer_total || ' in total for ' || v_property_title || ' (agent-managed — no CHS commission charged to buyer or seller directly). ' ||
    'Agent''s commission: ' || v_breakdown.agent_commission || '. ' ||
    'CHS platform fee on agent''s commission (deducted at source): ' || v_breakdown.chs_fee_amount || '. ' ||
    'Net to agent: ' || v_breakdown.agent_net || '. ' ||
    'Net held in escrow for seller: ' || v_breakdown.seller_net || '. ' ||
    'Total platform earning on this transaction: ' || v_breakdown.chs_fee_amount || '.',
    '/admin?tab=escrowoversight');
end;
$$;

create or replace function release_direct_order_to_vendor(p_order_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_vendor_user_id uuid;
  v_amount numeric;
  v_vendor_commission numeric;
  v_vendor_net numeric;
  v_payment_status text;
  v_reference text;
  v_escrow_ref text;
  v_vendor_name text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can release a real direct order.';
  end if;

  select o.amount, o.vendor_commission_amount, o.payment_status, o.reference_number, o.escrow_reference, mv.user_id
    into v_amount, v_vendor_commission, v_payment_status, v_reference, v_escrow_ref, v_vendor_user_id
    from marketplace_direct_orders o
    join marketplace_products mp on mp.id = o.product_id
    join marketplace_vendors mv on mv.id = mp.vendor_id
    where o.id = p_order_id;

  if v_payment_status != 'held_escrow' then
    raise exception 'This real order is not currently held in escrow.';
  end if;

  v_vendor_net := v_amount - v_vendor_commission;

  update wallets set main_balance = main_balance + v_vendor_net, updated_at = now() where user_id = v_vendor_user_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_vendor_user_id, 'main', v_vendor_net, 'credit', 'Real direct marketplace sale, ref ' || v_reference || ', net of your real commission', v_escrow_ref);

  update marketplace_direct_orders set payment_status = 'released' where id = p_order_id;

  perform notify_user(v_vendor_user_id, '💰 Real payment released',
    'Reference ' || v_reference || ' — ' || v_vendor_net || ' has been credited to your wallet (sale price ' || v_amount || ', net of your CHS commission ' || v_vendor_commission || ').');

  select full_name into v_vendor_name from profiles where id = v_vendor_user_id;
  perform notify_admins_by_domain('owner_buyer_tenant', '💰 Real direct marketplace funds released',
    'Reference ' || v_reference || ' — ' || v_vendor_net || ' released to ' || v_vendor_name || ' (sale price ' || v_amount || ', CHS commission ' || v_vendor_commission || ' already collected at source).',
    '/admin?tab=marketplacemoderation');
end;
$$;

create or replace function release_marketplace_escrow_to_vendor(p_request_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_vendor_user_id uuid;
  v_quoted_amount numeric;
  v_vendor_commission numeric;
  v_vendor_net numeric;
  v_payment_status text;
  v_reference text;
  v_escrow_ref text;
  v_vendor_name text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can release real marketplace escrow funds.';
  end if;

  select sqr.quoted_amount, sqr.vendor_commission_amount, sqr.payment_status, sqr.reference_number, sqr.escrow_reference, mv.user_id
    into v_quoted_amount, v_vendor_commission, v_payment_status, v_reference, v_escrow_ref, v_vendor_user_id
    from service_quote_requests sqr
    join marketplace_products mp on mp.id = sqr.product_id
    join marketplace_vendors mv on mv.id = mp.vendor_id
    where sqr.id = p_request_id;

  if v_payment_status != 'held_escrow' then
    raise exception 'These real funds are not currently held in escrow.';
  end if;

  v_vendor_net := v_quoted_amount - v_vendor_commission;

  update wallets set main_balance = main_balance + v_vendor_net, updated_at = now() where user_id = v_vendor_user_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_vendor_user_id, 'main', v_vendor_net, 'credit',
    'Real marketplace sale, ref ' || v_reference || ', net of your real ' || round(v_vendor_commission / v_quoted_amount * 100, 1) || '% commission', v_escrow_ref);

  update service_quote_requests set payment_status = 'released', status = 'closed' where id = p_request_id;

  perform notify_user(v_vendor_user_id, '💰 Real payment released',
    'Reference ' || v_reference || ' — ' || v_vendor_net || ' has been credited to your wallet (quoted price ' || v_quoted_amount || ', net of your CHS commission ' || v_vendor_commission || ').');

  select full_name into v_vendor_name from profiles where id = v_vendor_user_id;
  perform notify_admins_by_domain('owner_buyer_tenant', '💰 Real marketplace funds released',
    'Reference ' || v_reference || ' — ' || v_vendor_net || ' released to ' || v_vendor_name || ' (quoted price ' || v_quoted_amount || ', CHS commission ' || v_vendor_commission || ' already collected at source).',
    '/admin?tab=marketplacemoderation');
end;
$$;

create or replace function release_shortlet_funds_to_host(p_booking_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_host_id uuid;
  v_property_id uuid;
  v_total_price numeric;
  v_host_commission numeric;
  v_net_amount numeric;
  v_payment_status text;
  v_reference text;
  v_host_name text;
  v_property_title text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can release real shortlet/hire funds.';
  end if;

  select sb.property_id, sb.total_price, sb.host_commission_amount, sb.payment_status
    into v_property_id, v_total_price, v_host_commission, v_payment_status
    from shortlet_bookings sb where sb.id = p_booking_id;

  if v_payment_status = 'released' then
    raise exception 'These real funds have already been released.';
  end if;

  select owner_id into v_host_id from properties where id = v_property_id;
  v_net_amount := v_total_price - v_host_commission;
  v_reference := 'PAY-' || substr(p_booking_id::text, 1, 8);

  update wallets set main_balance = main_balance + v_net_amount, updated_at = now() where user_id = v_host_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (v_host_id, 'main', v_net_amount, 'credit', 'Real shortlet/hire payout, net of your real commission', v_reference);

  update shortlet_bookings set payment_status = 'released' where id = p_booking_id;

  perform notify_user(v_host_id, '💰 Real payout released',
    'Reference ' || v_reference || ' — ' || v_net_amount || ' has been credited to your wallet (booking total ' || v_total_price || ', net of your CHS commission ' || v_host_commission || ').',
    '/receipt/' || v_reference);

  select full_name into v_host_name from profiles where id = v_host_id;
  select title into v_property_title from properties where id = v_property_id;
  perform notify_admins_by_domain('owner_buyer_tenant', '💰 Real shortlet/hire funds released',
    'Reference ' || v_reference || ' — ' || v_net_amount || ' released to ' || v_host_name || ' for ' || v_property_title || ' (booking total ' || v_total_price || ', CHS commission ' || v_host_commission || ' already collected at source).',
    '/admin?tab=escrowoversight');
end;
$$;

create or replace function accept_marketplace_quote(p_request_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_requester_id uuid;
  v_quoted_amount numeric;
  v_response_status text;
  v_payment_status text;
  v_buyer_pct numeric;
  v_vendor_pct numeric;
  v_buyer_commission numeric;
  v_vendor_commission numeric;
  v_real_total numeric;
  v_balance numeric;
  v_reference text;
  v_escrow_ref text;
  v_buyer_name text;
begin
  select requester_id, quoted_amount, response_moderation_status, payment_status, reference_number
    into v_requester_id, v_quoted_amount, v_response_status, v_payment_status, v_reference
    from service_quote_requests where id = p_request_id;

  if v_requester_id != auth.uid() then
    raise exception 'You are not the real buyer on this request.';
  end if;
  if v_response_status != 'approved' then
    raise exception 'This quote has not yet been reviewed and approved by CHS.';
  end if;
  if v_payment_status != 'unpaid' then
    raise exception 'This request has already been paid for.';
  end if;
  if v_quoted_amount is null or v_quoted_amount <= 0 then
    raise exception 'No real quoted amount is available to accept.';
  end if;

  select value::numeric into v_buyer_pct from platform_settings where key = 'marketplace_buyer_commission_pct';
  select value::numeric into v_vendor_pct from platform_settings where key = 'marketplace_vendor_commission_pct';

  v_buyer_commission := round(v_quoted_amount * v_buyer_pct / 100, 2);
  v_vendor_commission := round(v_quoted_amount * v_vendor_pct / 100, 2);
  v_real_total := v_quoted_amount + v_buyer_commission;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_real_total then
    raise exception 'insufficient_balance';
  end if;

  v_escrow_ref := 'MKTPAY-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - v_real_total, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', v_real_total, 'debit',
    'Real marketplace purchase, ref ' || v_reference || ' (price ' || v_quoted_amount || ' + your CHS commission ' || v_buyer_commission || '), held in escrow', v_escrow_ref);

  update service_quote_requests set
    payment_status = 'held_escrow',
    buyer_commission_amount = v_buyer_commission,
    vendor_commission_amount = v_vendor_commission,
    escrow_reference = v_escrow_ref,
    status = 'paid'
  where id = p_request_id;

  select full_name into v_buyer_name from profiles where id = v_requester_id;
  perform notify_admins_by_domain('owner_buyer_tenant', '💰 Real marketplace payment held in escrow',
    v_buyer_name || ' paid ' || v_real_total || ' in total. Reference ' || v_reference || '. ' ||
    'Breakdown — Price: ' || v_quoted_amount || '. ' ||
    'Buyer''s CHS commission: ' || v_buyer_commission || '. ' ||
    'Vendor''s CHS commission (deducted on release): ' || v_vendor_commission || '. ' ||
    'Total platform earning on this transaction: ' || (v_buyer_commission + v_vendor_commission) || '. ' ||
    'Held pending confirmed delivery.',
    '/admin?tab=marketplacemoderation');

  return json_build_object('success', true, 'real_total_paid', v_real_total, 'escrow_reference', v_escrow_ref);
end;
$$;

create or replace function buy_product_direct(p_product_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_price numeric;
  v_buyer_pct numeric;
  v_vendor_pct numeric;
  v_buyer_commission numeric;
  v_vendor_commission numeric;
  v_real_total numeric;
  v_balance numeric;
  v_new_id uuid;
  v_reference text;
  v_escrow_ref text;
  v_vendor_user_id uuid;
  v_buyer_name text;
  v_product_name text;
begin
  select mp.price, mv.user_id, mp.name into v_price, v_vendor_user_id, v_product_name
    from marketplace_products mp join marketplace_vendors mv on mv.id = mp.vendor_id
    where mp.id = p_product_id and mp.status = 'active';

  if v_price is null then
    raise exception 'This real product is not currently available.';
  end if;

  select value::numeric into v_buyer_pct from platform_settings where key = 'marketplace_buyer_commission_pct';
  select value::numeric into v_vendor_pct from platform_settings where key = 'marketplace_vendor_commission_pct';

  v_buyer_commission := round(v_price * v_buyer_pct / 100, 2);
  v_vendor_commission := round(v_price * v_vendor_pct / 100, 2);
  v_real_total := v_price + v_buyer_commission;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_real_total then
    raise exception 'insufficient_balance';
  end if;

  v_escrow_ref := 'BUYPAY-' || substr(gen_random_uuid()::text, 1, 8);

  insert into marketplace_direct_orders (product_id, buyer_id, amount, buyer_commission_amount, vendor_commission_amount, escrow_reference)
  values (p_product_id, auth.uid(), v_price, v_buyer_commission, v_vendor_commission, v_escrow_ref)
  returning id, reference_number into v_new_id, v_reference;

  update wallets set main_balance = main_balance - v_real_total, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', v_real_total, 'debit', 'Real direct marketplace purchase, ref ' || v_reference || ' (price ' || v_price || ' + your CHS commission ' || v_buyer_commission || '), held in escrow', v_escrow_ref);

  perform notify_user(v_vendor_user_id, '🛒 A real direct order was placed',
    'Reference ' || v_reference || ' — ' || v_product_name || ', price ' || v_price || '. A real buyer has paid in full. CHS is holding the funds until delivery is confirmed.');

  select full_name into v_buyer_name from profiles where id = auth.uid();
  perform notify_admins_by_domain('owner_buyer_tenant', '🛒 A real direct marketplace order needs fulfillment tracking',
    v_buyer_name || ' paid ' || v_real_total || ' in total for ' || v_product_name || '. Reference ' || v_reference || '. ' ||
    'Breakdown — Price: ' || v_price || '. Buyer''s CHS commission: ' || v_buyer_commission || '. Vendor''s CHS commission (deducted on release): ' || v_vendor_commission || '. ' ||
    'Total platform earning on this transaction: ' || (v_buyer_commission + v_vendor_commission) || '. Held in escrow.',
    '/admin?tab=marketplacemoderation');

  return json_build_object('success', true, 'reference_number', v_reference, 'real_total_paid', v_real_total);
end;
$$;

create or replace function host_decide_shortlet_booking(p_booking_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_property_id uuid;
  v_host_id uuid;
  v_guest_id uuid;
  v_total_price numeric;
  v_guest_commission numeric;
  v_host_commission numeric;
  v_property_title text;
  v_guest_name text;
begin
  select sb.property_id, sb.guest_id, sb.total_price, sb.guest_commission_amount, sb.host_commission_amount
    into v_property_id, v_guest_id, v_total_price, v_guest_commission, v_host_commission
    from shortlet_bookings sb where sb.id = p_booking_id;

  select owner_id, title into v_host_id, v_property_title from properties where id = v_property_id;

  if v_host_id != auth.uid() then
    raise exception 'You are not the real host of this property.';
  end if;
  if p_decision not in ('confirmed', 'declined') then
    raise exception 'Not a real, recognized decision.';
  end if;

  if p_decision = 'declined' then
    update shortlet_bookings set status = 'declined', payment_status = 'refunded', host_decision_note = p_note where id = p_booking_id;
    update wallets set main_balance = main_balance + v_total_price + v_guest_commission, updated_at = now() where user_id = v_guest_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
      values (v_guest_id, 'main', v_total_price + v_guest_commission, 'credit', 'Real refund — host declined your booking request', 'DEC-' || substr(p_booking_id::text, 1, 8));
    perform notify_user(v_guest_id, 'Your booking request was declined',
      'The host was not able to accept your request for ' || v_property_title || '. You have been fully, automatically refunded.' || coalesce(E'\nNote: ' || p_note, ''), '/my-bookings');
  else
    update shortlet_bookings set status = 'confirmed', host_decision_note = p_note where id = p_booking_id;
    perform generate_shortlet_commission(p_booking_id);
    perform notify_user(v_guest_id, '🎉 Your booking was accepted',
      'The host has confirmed your booking for ' || v_property_title || '.' || coalesce(E'\nNote: ' || p_note, ''), '/my-bookings');

    select full_name into v_guest_name from profiles where id = v_guest_id;
    perform notify_admins_by_domain('owner_buyer_tenant', '🎉 Real shortlet/hire booking confirmed',
      v_guest_name || '''s booking for ' || v_property_title || ' (' || v_total_price || ') has been confirmed by the host. ' ||
      'Guest''s CHS commission: ' || v_guest_commission || '. Host''s CHS commission (deducted on release): ' || v_host_commission || '. ' ||
      'Total platform earning on this transaction: ' || (v_guest_commission + v_host_commission) || '.',
      '/admin?tab=escrowoversight');
  end if;
end;
$$;

create or replace function confirm_job_completion(p_fault_report_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_payer_id uuid;
  v_artisan_user_id uuid;
  v_amount numeric;
  v_reserve_balance numeric;
  v_main_balance numeric;
  v_from_reserve numeric;
  v_from_main numeric;
  v_reference text;
  v_commission_pct numeric;
  v_commission_amount numeric;
  v_artisan_net numeric;
  v_artisan_name text;
  v_payer_name text;
  v_property_id uuid;
  v_property_title text;
begin
  select
    coalesce(
      (select case when t.management_delegated then t.manager_id else t.landlord_id end from tenancies t where t.id = fr.tenancy_id),
      (select p.owner_id from properties p where p.id = fr.property_id)
    ),
    fr.approved_amount, fr.property_id
    into v_payer_id, v_amount, v_property_id
    from fault_reports fr where fr.id = p_fault_report_id;

  if v_payer_id != auth.uid() and not is_admin() then
    raise exception 'Only the real, responsible owner or manager can confirm this job is complete.';
  end if;
  if v_amount is null then
    raise exception 'This job has no real approved amount to pay.';
  end if;

  select a.user_id into v_artisan_user_id
    from fault_reports fr
    join fault_quotations fq on fq.fault_report_id = fr.id and fq.vendor_name = fr.approved_vendor
    join artisans a on a.id = fq.artisan_id
    where fr.id = p_fault_report_id
    limit 1;

  select maintenance_reserve, main_balance into v_reserve_balance, v_main_balance from wallets where user_id = v_payer_id;

  v_from_reserve := least(coalesce(v_reserve_balance, 0), v_amount);
  v_from_main := v_amount - v_from_reserve;

  if v_from_main > coalesce(v_main_balance, 0) then
    raise exception 'Insufficient combined balance (reserve + main wallet) to pay for this job.';
  end if;

  v_commission_pct := get_artisan_commission_pct(v_amount);
  v_commission_amount := round(v_amount * v_commission_pct / 100, 2);
  v_artisan_net := v_amount - v_commission_amount;

  v_reference := 'JOB-' || substr(gen_random_uuid()::text, 1, 8);

  if v_from_reserve > 0 then
    update wallets set maintenance_reserve = maintenance_reserve - v_from_reserve, updated_at = now() where user_id = v_payer_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (v_payer_id, 'maintenance_reserve', v_from_reserve, 'debit', 'Maintenance job payment (from reserve)', v_reference);
  end if;
  if v_from_main > 0 then
    update wallets set main_balance = main_balance - v_from_main, updated_at = now() where user_id = v_payer_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (v_payer_id, 'main', v_from_main, 'debit', 'Maintenance job payment (from main wallet, reserve insufficient)', v_reference);
  end if;

  update wallets set main_balance = main_balance + v_artisan_net, updated_at = now() where user_id = v_artisan_user_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_artisan_user_id, 'main', v_artisan_net, 'credit', 'Maintenance job (labor) payment received, net of real CHS commission (' || v_commission_pct || '%)', v_reference);

  insert into transaction_commissions (transaction_type, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount, status, paid_at)
  values ('maintenance_job', v_property_id, v_artisan_user_id, 'artisan', v_amount, v_commission_pct, v_commission_amount, 'paid', now());

  update fault_reports set status = 'resolved' where id = p_fault_report_id;

  select title into v_property_title from properties where id = v_property_id;

  perform notify_user(v_artisan_user_id, '💰 Payment received',
    'Reference ' || v_reference || ' — you have been paid ' || v_artisan_net || ' for ' || coalesce(v_property_title, 'a completed job') || ' (labor charge ' || v_amount || ', net of CHS''s ' || v_commission_pct || '% commission of ' || v_commission_amount || ').');

  select full_name into v_artisan_name from profiles where id = v_artisan_user_id;
  select full_name into v_payer_name from profiles where id = v_payer_id;
  perform notify_admins_by_domain('artisan_dev_pm_vendor', '💰 Real maintenance job paid',
    v_payer_name || ' paid ' || v_amount || ' for a completed job by ' || v_artisan_name || ' at ' || coalesce(v_property_title, 'a real property') || '. Reference ' || v_reference || '. ' ||
    'CHS commission (deducted at source): ' || v_commission_amount || ' (' || v_commission_pct || '%). Net paid to artisan: ' || v_artisan_net || '.',
    '/admin?tab=artisans');
end;
$$;

create or replace function pay_rent_to_own_installment(p_agreement_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_monthly numeric;
  v_total_price numeric;
  v_portion_pct numeric;
  v_balance numeric;
  v_reference text;
  v_ownership_gain numeric;
  v_new_payment_id uuid;
  v_buyer_pct numeric;
  v_seller_pct numeric;
  v_buyer_commission numeric;
  v_seller_commission numeric;
  v_real_total_buyer_pays numeric;
  v_seller_net numeric;
  v_buyer_name text;
  v_property_title text;
begin
  select buyer_id, seller_id, monthly_amount, total_price, portion_pct
    into v_buyer_id, v_seller_id, v_monthly, v_total_price, v_portion_pct
    from rent_to_own_agreements where id = p_agreement_id and status = 'active';

  if v_buyer_id != auth.uid() then
    raise exception 'Only the real buyer on this agreement can make this payment.';
  end if;

  select value::numeric into v_buyer_pct from platform_settings where key = 'rent_to_own_buyer_commission_pct';
  select value::numeric into v_seller_pct from platform_settings where key = 'rent_to_own_seller_commission_pct';
  v_buyer_commission := round(v_monthly * v_buyer_pct / 100, 2);
  v_seller_commission := round(v_monthly * v_seller_pct / 100, 2);
  v_real_total_buyer_pays := v_monthly + v_buyer_commission;
  v_seller_net := v_monthly - v_seller_commission;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_real_total_buyer_pays then
    raise exception 'insufficient_balance';
  end if;

  v_reference := 'RTO-' || substr(gen_random_uuid()::text, 1, 8);
  v_ownership_gain := round((v_monthly / v_total_price) * v_portion_pct, 3);

  update wallets set main_balance = main_balance - v_real_total_buyer_pays, updated_at = now() where user_id = v_buyer_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_buyer_id, 'main', v_real_total_buyer_pays, 'debit',
    'Rent-to-Own installment (' || v_monthly || ' + your real ' || v_buyer_commission || ' commission)', v_reference);

  update wallets set main_balance = main_balance + v_seller_net, updated_at = now() where user_id = v_seller_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_seller_id, 'main', v_seller_net, 'credit', 'Rent-to-Own installment received, net of your real commission', v_reference);

  insert into rent_to_own_payments (agreement_id, amount, ownership_pct_gained, reference)
  values (p_agreement_id, v_monthly, v_ownership_gain, v_reference)
  returning id into v_new_payment_id;

  update rent_to_own_agreements
    set total_paid = total_paid + v_monthly, ownership_pct = least(100, ownership_pct + v_ownership_gain)
    where id = p_agreement_id;

  insert into transaction_commissions (transaction_type, rent_to_own_payment_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount, status, paid_at)
  values
    ('rent_to_own', v_new_payment_id, (select property_id from rent_to_own_agreements where id = p_agreement_id), v_buyer_id, 'buyer', v_monthly, v_buyer_pct, v_buyer_commission, 'paid', now()),
    ('rent_to_own', v_new_payment_id, (select property_id from rent_to_own_agreements where id = p_agreement_id), v_seller_id, 'seller', v_monthly, v_seller_pct, v_seller_commission, 'paid', now());

  if (select ownership_pct from rent_to_own_agreements where id = p_agreement_id) >= 100 then
    update rent_to_own_agreements set status = 'completed', completed_at = now() where id = p_agreement_id;
    update properties set purpose = 'sale', status = 'sold' where id = (select property_id from rent_to_own_agreements where id = p_agreement_id);
    perform notify_user(v_buyer_id, '🎉 You now own this property!', 'Your Rent-to-Own agreement is complete — full ownership has genuinely transferred.');
  end if;

  perform notify_user(v_buyer_id, '✓ Installment paid',
    'Reference ' || v_reference || ' — you paid ' || v_real_total_buyer_pays || ' in total (installment ' || v_monthly || ' + your CHS commission ' || v_buyer_commission || ').');
  perform notify_user(v_seller_id, '💰 Installment received',
    'Reference ' || v_reference || ' — ' || v_seller_net || ' has been credited to your wallet (installment ' || v_monthly || ', net of your CHS commission ' || v_seller_commission || ').');

  select full_name into v_buyer_name from profiles where id = v_buyer_id;
  select title into v_property_title from properties where id = (select property_id from rent_to_own_agreements where id = p_agreement_id);
  perform notify_admins_by_domain('owner_buyer_tenant', '💰 Real Rent-to-Own installment received',
    v_buyer_name || ' paid ' || v_real_total_buyer_pays || ' in total for ' || v_property_title || '. Reference ' || v_reference || '. ' ||
    'Breakdown — Installment: ' || v_monthly || '. Buyer''s CHS commission: ' || v_buyer_commission || '. Seller''s CHS commission (deducted at source): ' || v_seller_commission || '. ' ||
    'Total platform earning on this transaction: ' || (v_buyer_commission + v_seller_commission) || '. Real ownership gained: ' || v_ownership_gain || '%.',
    '/admin?tab=platformearnings');

  return json_build_object('reference', v_reference, 'real_total_paid', v_real_total_buyer_pays, 'installment', v_monthly, 'buyer_commission', v_buyer_commission);
end;
$$;
