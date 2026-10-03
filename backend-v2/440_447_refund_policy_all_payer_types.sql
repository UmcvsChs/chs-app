-- ============================================================================
-- CHS REFUND POLICY — tenants, buyers, and guests (migrations 440–447)
-- ============================================================================
-- Policy agreed directly with the client after reviewing Airbnb's own
-- current, published rule ("full refund, including service fees" when the
-- host is at fault): when the OTHER party in a real transaction defaults,
-- the payer gets back everything they paid, including CHS's own commission
-- from them, minus ONLY the real, non-refundable bank processing cost
-- already paid to a third party when the original payment moved.
--
--   fee = least(round(commission * 0.015 + 100, 2), 2000)
--
-- The fee is calculated on CHS's commission from the payer — never on the
-- principal — and never exceeds ₦2,000. The commission charged to the
-- defaulting party is cancelled too. Example: CHS commission from the payer
-- ₦100,000 -> fee ₦1,600 -> payer receives the full price + ₦98,400.
-- Also written into the Terms & Conditions as term 36 and shown beside
-- every pay button (components/RefundPolicyNotice.tsx).
--
-- HONEST HISTORY — three real mistakes of my own, caught by testing before
-- any real refund depended on them:
--   * 442 built request_rent_refund; 443 added an admin path but left the
--     old single-argument versions of BOTH request_rent_refund and
--     request_sale_refund behind as overloads — the same ambiguity class
--     that caused a real failure in migration 368. Dropped in 444.
--   * 443's request_sale_refund called a helper that does not exist inside
--     an "exception when undefined_function" block. In PL/pgSQL a caught
--     exception rolls back the whole block, so a real sale refund would have
--     credited nothing and still reported success. Removed in 444.
--   * The ORIGINAL request_sale_refund (present before this work, and
--     carried into my rewrite without being caught) set the seller's ENTIRE
--     escrow_held to zero, not just this deal's share — a seller with two
--     deals held would lose the second when the first was refunded. Testing
--     showed 5,468,000 reversed instead of 4,700,000. Fixed in 445 to reverse
--     only this deal's net held amount.
-- The definitions below are the FINAL, correct versions only.
--
-- Verified by direct tests against constructed scenarios (all rolled back):
--   rent   : tenant +1,059,000 on 1,000,000 rent + 60,000 commission (fee 1,000);
--            landlord escrow -960,000 exactly
--   sale   : buyer +5,323,000 on 5,000,000 + 325,000 (fee capped 2,000);
--            seller escrow -4,700,000 exactly (other held funds untouched);
--            stranger refused; admin with blank reason refused
--   direct : +10,491 on 10,000 + 600 (fee 109)
--   quote  : +52,855 on 50,000 + 3,000 (fee 145)
--   guest  : booking debited 233,200; refunded 232,902; net cost to guest =
--            exactly the 298 fee; guest cannot self-refund through admin path
-- ============================================================================

drop function if exists request_rent_refund(uuid);
drop function if exists request_sale_refund(uuid);

create or replace function calculate_real_processing_fee(p_amount numeric)
returns numeric
language sql
immutable
as $$
  select least(round(p_amount * 0.015 + 100, 2), 2000);
$$;

-- ---------------------------------------------------------------- MARKETPLACE
create or replace function refund_marketplace_escrow_to_buyer(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
as $$
declare
  v_requester_id uuid;
  v_quoted_amount numeric;
  v_buyer_commission numeric;
  v_payment_status text;
  v_reference text;
  v_escrow_ref text;
  v_processing_fee numeric;
  v_real_refund numeric;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can authorize a real marketplace refund.';
  end if;

  select requester_id, quoted_amount, buyer_commission_amount, payment_status, reference_number, escrow_reference
    into v_requester_id, v_quoted_amount, v_buyer_commission, v_payment_status, v_reference, v_escrow_ref
    from service_quote_requests where id = p_request_id;

  if v_payment_status != 'held_escrow' then
    raise exception 'These real funds are not currently held in escrow.';
  end if;

  v_processing_fee := calculate_real_processing_fee(v_buyer_commission);
  v_real_refund := v_quoted_amount + v_buyer_commission - v_processing_fee;

  update wallets set main_balance = main_balance + v_real_refund, updated_at = now() where user_id = v_requester_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_requester_id, 'main', v_real_refund, 'credit',
    'Marketplace refund, ref ' || v_reference || ' — ' || p_reason || ' (price ' || v_quoted_amount || ' + your commission ' || v_buyer_commission || ', less a real bank processing fee of ' || v_processing_fee || ')',
    v_escrow_ref);

  update service_quote_requests set payment_status = 'refunded', status = 'closed' where id = p_request_id;

  perform notify_user(v_requester_id, '✓ Your real refund has been issued',
    'Your refund of ' || v_real_refund || ' has been returned to your wallet — your full payment, less a real, non-refundable bank processing fee of ' || v_processing_fee || '. Reason: ' || p_reason);
end;
$$;

create or replace function refund_direct_order_to_buyer(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_amount numeric;
  v_buyer_commission numeric;
  v_payment_status text;
  v_reference text;
  v_escrow_ref text;
  v_processing_fee numeric;
  v_real_refund numeric;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can authorize a real refund.';
  end if;

  select buyer_id, amount, buyer_commission_amount, payment_status, reference_number, escrow_reference
    into v_buyer_id, v_amount, v_buyer_commission, v_payment_status, v_reference, v_escrow_ref
    from marketplace_direct_orders where id = p_order_id;

  if v_payment_status != 'held_escrow' then
    raise exception 'This real order is not currently held in escrow.';
  end if;

  v_processing_fee := calculate_real_processing_fee(v_buyer_commission);
  v_real_refund := v_amount + v_buyer_commission - v_processing_fee;

  update wallets set main_balance = main_balance + v_real_refund, updated_at = now() where user_id = v_buyer_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_buyer_id, 'main', v_real_refund, 'credit',
    'Direct order refund, ref ' || v_reference || ' — ' || p_reason || ' (price ' || v_amount || ' + your commission ' || v_buyer_commission || ', less a real bank processing fee of ' || v_processing_fee || ')',
    v_escrow_ref);

  update marketplace_direct_orders set payment_status = 'refunded' where id = p_order_id;

  perform notify_user(v_buyer_id, '✓ Your real refund has been issued',
    'Your refund of ' || v_real_refund || ' has been credited — your full payment, less a real, non-refundable bank processing fee of ' || v_processing_fee || '. Reason: ' || p_reason);
end;
$$;

-- ----------------------------------------------------------------------- RENT
create or replace function request_rent_refund(p_rent_payment_id uuid, p_admin_reason text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_landlord_id uuid;
  v_tenancy_id uuid;
  v_release_deadline timestamptz;
  v_released_at timestamptz;
  v_rent_amount numeric;
  v_annual_rent numeric;
  v_tenant_pct numeric;
  v_tenant_commission numeric;
  v_processing_fee numeric;
  v_real_refund numeric;
  v_landlord_held numeric;
  v_property_id uuid;
  v_property_title text;
  v_is_admin_action boolean := false;
begin
  select rp.tenant_id, rp.landlord_id, rp.tenancy_id, rp.release_deadline, rp.released_at, rp.amount
    into v_tenant_id, v_landlord_id, v_tenancy_id, v_release_deadline, v_released_at, v_rent_amount
    from rent_payments rp where rp.id = p_rent_payment_id;

  if v_tenant_id = auth.uid() then
    v_is_admin_action := false;
  elsif is_admin() then
    v_is_admin_action := true;
    if p_admin_reason is null or trim(p_admin_reason) = '' then
      raise exception 'A real, genuine reason must be recorded for an admin-triggered refund.';
    end if;
  else
    raise exception 'Only the real tenant on this payment, or a CHS admin, can request this refund.';
  end if;

  if v_released_at is not null then
    raise exception 'These real funds have already been released to the landlord — a refund is no longer available.';
  end if;
  if now() < v_release_deadline then
    raise exception 'The grace period has not yet passed. It ends on %.', v_release_deadline;
  end if;

  select annual_rent, property_id into v_annual_rent, v_property_id from tenancies where id = v_tenancy_id;
  select title into v_property_title from properties where id = v_property_id;

  select value::numeric into v_tenant_pct from platform_settings where key = 'rental_commission_tenant_percentage';
  v_tenant_commission := round(v_annual_rent * v_tenant_pct / 100, 2);
  v_processing_fee := calculate_real_processing_fee(v_tenant_commission);
  v_real_refund := v_annual_rent + v_tenant_commission - v_processing_fee;

  select escrow_held into v_landlord_held from wallets where user_id = v_landlord_id;

  update wallets set main_balance = main_balance + v_real_refund, updated_at = now() where user_id = v_tenant_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_tenant_id, 'main', v_real_refund, 'credit',
    'Refund — ' || v_property_title || (case when v_is_admin_action then ' (' || p_admin_reason || ')' else ', grace period passed with no clean move-in report' end) ||
    ' (rent ' || v_annual_rent || ' + your commission ' || v_tenant_commission || ', less a real, non-refundable bank processing fee of ' || v_processing_fee || ')',
    'REFUND-' || substr(gen_random_uuid()::text, 1, 8));

  update wallets set escrow_held = greatest(0, escrow_held - v_rent_amount), updated_at = now() where user_id = v_landlord_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_landlord_id, 'escrow_held', least(v_rent_amount, v_landlord_held), 'debit',
    'Tenancy reversed — refunded to tenant' || (case when v_is_admin_action then ' (' || p_admin_reason || ')' else ', grace period passed with no clean move-in report' end),
    'REFUND-' || substr(gen_random_uuid()::text, 1, 8));

  delete from transaction_commissions where tenancy_id = v_tenancy_id and (rent_payment_id = p_rent_payment_id or (rent_payment_id is null and payer_role = 'landlord'));

  update rent_payments set released_at = now() where id = p_rent_payment_id;
  update tenancies set status = 'ended' where id = v_tenancy_id;

  perform notify_user(v_landlord_id, '⚠️ Tenancy reversed — refund issued',
    'The real rent for ' || v_property_title || ' has been reversed and refunded to your tenant' || (case when v_is_admin_action then '. Reason: ' || p_admin_reason else ', grace period passed with no clean move-in report' end) || '. This tenancy is now ended.',
    '/owner');
  perform notify_user(v_tenant_id, '✓ Refund issued',
    'Your refund of ' || v_real_refund || ' has been credited to your wallet — your full payment, less a real, non-refundable bank processing fee of ' || v_processing_fee || ' (never our own commission, which has been fully returned to you).',
    '/wallet');

  perform log_audit_event('request_rent_refund', 'rent_payments', p_rent_payment_id,
    v_property_title || ' — refunded ' || v_real_refund || (case when v_is_admin_action then ' (admin: ' || p_admin_reason || ')' else '' end), null);
end;
$$;

-- ----------------------------------------------------------------------- SALE
create or replace function request_sale_refund(p_offer_id uuid, p_admin_reason text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_property_id uuid;
  v_property_title text;
  v_deadline timestamptz;
  v_payment_status text;
  v_legal_confirmed boolean;
  v_offer_amount numeric;
  v_buyer_pct numeric;
  v_buyer_commission numeric;
  v_seller_commission numeric;
  v_processing_fee numeric;
  v_real_refund numeric;
  v_deal_held numeric;
  v_is_admin_action boolean := false;
begin
  select buyer_id, property_id, document_deadline, payment_status, legal_transfer_confirmed, amount
    into v_buyer_id, v_property_id, v_deadline, v_payment_status, v_legal_confirmed, v_offer_amount
    from offers where id = p_offer_id;

  if v_buyer_id = auth.uid() then
    v_is_admin_action := false;
  elsif is_admin() then
    v_is_admin_action := true;
    if p_admin_reason is null or trim(p_admin_reason) = '' then
      raise exception 'A real, genuine reason must be recorded for an admin-triggered refund.';
    end if;
  else
    raise exception 'Only the real buyer on this offer, or a CHS admin, can request this refund.';
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

  select owner_id, title into v_seller_id, v_property_title from properties where id = v_property_id;

  select value::numeric into v_buyer_pct from platform_settings where key = 'sale_commission_buyer_percentage';
  v_buyer_commission := round(v_offer_amount * v_buyer_pct / 100, 2);
  v_processing_fee := calculate_real_processing_fee(v_buyer_commission);
  v_real_refund := v_offer_amount + v_buyer_commission - v_processing_fee;

  -- The amount actually held for THIS deal: the price less the seller
  -- commission that was really recorded and deducted for it.
  select commission_amount into v_seller_commission from transaction_commissions
    where offer_id = p_offer_id and payer_role = 'seller' limit 1;
  v_deal_held := v_offer_amount - coalesce(v_seller_commission, 0);

  update wallets set main_balance = main_balance + v_real_refund, updated_at = now() where user_id = v_buyer_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_buyer_id, 'main', v_real_refund, 'credit',
    'Refund' || (case when v_is_admin_action then ' — ' || p_admin_reason else ' — legal documents not delivered in time' end) ||
    ' (price ' || v_offer_amount || ' + your commission ' || v_buyer_commission || ', less a real, non-refundable bank processing fee of ' || v_processing_fee || ')',
    'REFUND-' || substr(gen_random_uuid()::text, 1, 8));

  update wallets set escrow_held = greatest(0, escrow_held - v_deal_held), updated_at = now() where user_id = v_seller_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_seller_id, 'escrow_held', v_deal_held, 'debit',
    'Sale reversed — refunded to buyer' || (case when v_is_admin_action then ': ' || p_admin_reason else ', documents not delivered in time' end),
    'REFUND-' || substr(gen_random_uuid()::text, 1, 8));

  update offers set refund_status = 'refunded', payment_status = 'unpaid', status = 'rejected' where id = p_offer_id;
  update properties set status = 'active' where id = v_property_id;
  delete from transaction_commissions where offer_id = p_offer_id;

  perform notify_user(v_seller_id, '⚠️ Sale reversed — refund issued',
    'The sale of ' || v_property_title || ' has been reversed and the full amount refunded to the buyer' ||
    (case when v_is_admin_action then '. Reason: ' || p_admin_reason else ', since the real legal documents were not delivered within the agreed window' end) || '.',
    '/property/' || v_property_id);
  perform notify_user(v_buyer_id, '✓ Refund issued',
    'Your refund of ' || v_real_refund || ' has been credited to your wallet — your full payment, less a real, non-refundable bank processing fee of ' || v_processing_fee || ' (never our own commission, which has been fully returned to you).',
    '/wallet');

  perform log_audit_event('request_sale_refund', 'offers', p_offer_id,
    v_property_title || ' — refunded ' || v_real_refund || (case when v_is_admin_action then ' (admin: ' || p_admin_reason || ')' else '' end), null);
end;
$$;

revoke all on function request_rent_refund(uuid, text) from public, anon;
grant execute on function request_rent_refund(uuid, text) to authenticated, service_role;
revoke all on function request_sale_refund(uuid, text) from public, anon;
grant execute on function request_sale_refund(uuid, text) to authenticated, service_role;

-- -------------------------------------------------------------- SHORTLET/HIRE
-- The refund amount is read from the real wallet debit made at booking, not
-- recomputed, so it can never drift from what was actually taken.
create or replace function refund_shortlet_booking(p_booking_id uuid, p_reason text)
returns void
language plpgsql
security definer
as $$
declare
  v_guest_id uuid;
  v_property_id uuid;
  v_property_title text;
  v_host_id uuid;
  v_status text;
  v_payment_status text;
  v_guest_commission numeric;
  v_paid numeric;
  v_processing_fee numeric;
  v_real_refund numeric;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can authorize a real booking refund.';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A real, genuine reason must be recorded for a refund.';
  end if;

  select guest_id, property_id, status, payment_status, coalesce(guest_commission_amount, 0)
    into v_guest_id, v_property_id, v_status, v_payment_status, v_guest_commission
    from shortlet_bookings where id = p_booking_id;

  if v_guest_id is null then
    raise exception 'This real booking could not be found.';
  end if;
  if v_payment_status != 'held_escrow' then
    raise exception 'These real funds are not currently held in escrow (status: %).', v_payment_status;
  end if;
  if v_status not in ('pending_host_review', 'confirmed') then
    raise exception 'This booking is already % — nothing is held to refund.', v_status;
  end if;

  select owner_id, title into v_host_id, v_property_title from properties where id = v_property_id;

  select amount into v_paid from wallet_transactions
    where user_id = v_guest_id and direction = 'debit'
      and reference = 'REQ-' || substr(p_booking_id::text, 1, 8)
    order by created_at desc limit 1;
  if v_paid is null then
    raise exception 'The original payment record for this booking could not be found — refund cannot be calculated safely.';
  end if;

  v_processing_fee := calculate_real_processing_fee(v_guest_commission);
  v_real_refund := v_paid - v_processing_fee;

  update wallets set main_balance = main_balance + v_real_refund, updated_at = now() where user_id = v_guest_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_guest_id, 'main', v_real_refund, 'credit',
    'Refund — ' || v_property_title || ' (' || p_reason || '). Full payment of ' || v_paid || ' returned, less a real, non-refundable bank processing fee of ' || v_processing_fee || ' (CHS''s own commission fully returned)',
    'REFUND-' || substr(gen_random_uuid()::text, 1, 8));

  update shortlet_bookings set
    status = 'cancelled',
    payment_status = 'refunded',
    security_deposit_status = case when security_deposit_status = 'held' then 'released_to_guest' else security_deposit_status end,
    host_decision_note = coalesce(host_decision_note || E'\n', '') || 'Refunded by CHS: ' || p_reason
  where id = p_booking_id;

  delete from transaction_commissions where shortlet_booking_id = p_booking_id;

  perform notify_user(v_guest_id, '✓ Refund issued',
    'Your refund of ' || v_real_refund || ' for ' || v_property_title || ' has been credited to your wallet — your full payment, less a real, non-refundable bank processing fee of ' || v_processing_fee || ' (never our own commission, which has been fully returned to you). Reason: ' || p_reason,
    '/wallet');
  perform notify_user(v_host_id, '⚠️ Booking refunded to guest',
    'The booking for ' || v_property_title || ' has been cancelled and refunded to the guest. Reason: ' || p_reason,
    '/owner');

  perform log_audit_event('refund_shortlet_booking', 'shortlet_bookings', p_booking_id,
    v_property_title || ' — refunded ' || v_real_refund || ' (' || p_reason || ')', null);
end;
$$;

revoke all on function refund_shortlet_booking(uuid, text) from public, anon;
grant execute on function refund_shortlet_booking(uuid, text) to authenticated, service_role;

-- ------------------------------------------- ESCROW OVERSIGHT DATA (447)
-- Held shortlet/hire booking money was never shown in Escrow Oversight —
-- only the security deposit was. Found: two real held bookings (₦900,000 and
-- ₦690,000) had been invisible there. Also exposes document_deadline on sale
-- escrow so the screen can show when a refund opens.
create or replace function get_held_shortlet_bookings()
returns json
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Not authorised: CHS admins only.';
  end if;
  return (
    select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json) from (
      select sb.id, sb.guest_full_name, sb.guest_phone, sb.total_price, sb.guest_commission_amount,
        sb.host_commission_amount, sb.status, sb.check_in, sb.check_out, sb.created_at,
        p.title as property_title, p.owner_id, host.full_name as host_name
      from shortlet_bookings sb
      join properties p on p.id = sb.property_id
      join profiles host on host.id = p.owner_id
      where sb.payment_status = 'held_escrow'
        and sb.status in ('pending_host_review', 'confirmed')
    ) t
  );
end;
$$;

revoke all on function get_held_shortlet_bookings() from public, anon;
grant execute on function get_held_shortlet_bookings() to authenticated, service_role;

create or replace function get_pending_legal_transfers()
returns json
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Not authorised: CHS admins only.';
  end if;
  return (
    select coalesce(json_agg(row_to_json(t) order by t.id), '[]'::json) from (
      select o.id, o.amount, o.created_at, o.document_deadline, p.title as property_title, p.owner_id
      from offers o
      join properties p on p.id = o.property_id
      where o.payment_status = 'paid' and o.legal_transfer_confirmed = false
    ) t
  );
end;
$$;
