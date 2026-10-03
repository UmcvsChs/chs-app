-- ============================================================================
-- 448 — FINAL definitions of request_rent_refund and request_sale_refund
-- ============================================================================
-- This file records what is LIVE in the database for these two functions and
-- SUPERSEDES the versions inside 440_447_refund_policy_all_payer_types.sql.
-- (Everything else in 440-447 — the fee helper, marketplace / direct-order /
-- shortlet refunds, the escrow oversight feeds — is unchanged and still
-- correct.)
--
-- Why a second pass was needed: while re-verifying the refund policy end to
-- end, testing against constructed scenarios showed the 440-447 versions of
-- these two functions were still incomplete:
--
--   RENT
--   * A refund on a RENEWAL payment wrongly handed back a tenant commission
--     the tenant never paid (tenants pay a commission only on their first
--     payment), and ended the whole tenancy.
--   * The tenant's own commission record stayed on the books as earned
--     revenue after being refunded, so Platform Earnings would overstate what
--     CHS actually kept.
--   * The payment was only stamped released_at, so a later audit could not
--     tell "paid out to the landlord" from "refunded to the tenant".
--   * The property stayed marked 'rented' after a first-payment refund.
--
--   SALE
--   * An agent-managed sale credits the agent directly at payment time, so it
--     cannot be safely reversed by this function; it now refuses and asks for
--     manual review by CHS finance instead of moving money incorrectly.
--   * The seller's reversed amount now comes from the real recorded seller
--     commission for the deal, with the configured percentage only as a
--     fallback, and the wallet debit is capped to what is actually held.
--
-- Verified by direct tests against constructed scenarios (all rolled back):
--   rent  : tenant +1,059,000 on 1,000,000 rent + 60,000 commission (fee 1,000);
--           landlord escrow -960,000 exactly; 0 commission rows left; property
--           'active'; refunded_at set; a stranger and an admin with no reason
--           both refused.
--   sale  : buyer +5,323,000 on 5,000,000 + 325,000 commission (fee capped 2,000);
--           seller escrow -4,700,000 exactly (other deals' held money untouched);
--           0 commission rows left; property 'active'; agent-managed sale refused.
--
-- NUMBERING NOTE (honest): the live migration history contains two entries
-- named "444_..." and two named "445_sale_refund_reverse_only_this_deals_
-- escrow". The first of each came from the earlier pass recorded in
-- 440-447; the second of each is this hardening, applied afterwards. That is
-- cosmetic only — the later definitions are the ones in force, and they are
-- the ones below.
-- ============================================================================

alter table rent_payments add column if not exists refunded_at timestamptz;
alter table rent_payments add column if not exists refund_reason text;

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
  v_tenant_commission numeric := 0;
  v_processing_fee numeric := 0;
  v_real_refund numeric;
  v_landlord_held numeric;
  v_property_id uuid;
  v_property_title text;
  v_is_first_payment boolean;
  v_is_admin_action boolean := false;
  v_reason_text text;
begin
  select rp.tenant_id, rp.landlord_id, rp.tenancy_id, rp.release_deadline, rp.released_at, rp.amount
    into v_tenant_id, v_landlord_id, v_tenancy_id, v_release_deadline, v_released_at, v_rent_amount
    from rent_payments rp where rp.id = p_rent_payment_id;

  if v_tenant_id is null then
    raise exception 'This real rent payment does not exist.';
  end if;

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
    raise exception 'These real funds have already been released or refunded — a refund is no longer available.';
  end if;
  if now() < v_release_deadline then
    raise exception 'The grace period has not yet passed. It ends on %.', v_release_deadline;
  end if;

  select annual_rent, property_id into v_annual_rent, v_property_id from tenancies where id = v_tenancy_id;
  select title into v_property_title from properties where id = v_property_id;

  -- A tenant only ever pays a commission on their FIRST payment;
  -- renewals carry none, so none is refunded on a renewal.
  select not exists (
    select 1 from rent_payments where tenancy_id = v_tenancy_id and created_at < (select created_at from rent_payments where id = p_rent_payment_id)
  ) into v_is_first_payment;

  if v_is_first_payment then
    select value::numeric into v_tenant_pct from platform_settings where key = 'rental_commission_tenant_percentage';
    v_tenant_commission := round(v_annual_rent * v_tenant_pct / 100, 2);
    v_processing_fee := calculate_real_processing_fee(v_tenant_commission);
  end if;

  v_real_refund := v_annual_rent + v_tenant_commission - v_processing_fee;
  v_reason_text := case when v_is_admin_action then p_admin_reason else 'grace period passed with no clean move-in report' end;

  select escrow_held into v_landlord_held from wallets where user_id = v_landlord_id;

  update wallets set main_balance = main_balance + v_real_refund, updated_at = now() where user_id = v_tenant_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_tenant_id, 'main', v_real_refund, 'credit',
    'Refund — ' || v_property_title || ', ' || v_reason_text ||
    ' (rent ' || v_annual_rent || case when v_tenant_commission > 0 then ' + your commission ' || v_tenant_commission || ', less a real, non-refundable bank processing fee of ' || v_processing_fee else '' end || ')',
    'REFUND-' || substr(gen_random_uuid()::text, 1, 8));

  update wallets set escrow_held = greatest(0, escrow_held - v_rent_amount), updated_at = now() where user_id = v_landlord_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_landlord_id, 'escrow_held', least(v_rent_amount, coalesce(v_landlord_held, 0)), 'debit',
    'Tenancy reversed — refunded to tenant (' || v_reason_text || ')',
    'REFUND-' || substr(gen_random_uuid()::text, 1, 8));

  -- Remove every commission record belonging to this payment, so
  -- Platform Earnings never counts money that went back to the payer.
  delete from transaction_commissions
    where tenancy_id = v_tenancy_id
      and (rent_payment_id = p_rent_payment_id or (v_is_first_payment and rent_payment_id is null));

  -- released_at stays set so every existing guard (auto-release job, manual
  -- release) keeps refusing to touch this payment; refunded_at distinguishes
  -- "refunded to the tenant" from "paid out to the landlord" for any audit.
  update rent_payments set released_at = now(), refunded_at = now(), refund_reason = v_reason_text where id = p_rent_payment_id;

  if v_is_first_payment then
    update tenancies set status = 'ended' where id = v_tenancy_id;
    update properties set status = 'active' where id = v_property_id and status = 'rented';
  end if;

  perform notify_user(v_landlord_id, '⚠️ Tenancy reversed — refund issued',
    'The rent for ' || v_property_title || ' (' || v_rent_amount || ' held) has been reversed and refunded to your tenant. Reason: ' || v_reason_text || '.' ||
    case when v_is_first_payment then ' This tenancy is now ended and your property is listed as available again.' else '' end,
    '/owner');
  perform notify_user(v_tenant_id, '✓ Refund issued',
    'Your refund of ' || v_real_refund || ' for ' || v_property_title || ' has been credited to your wallet.' ||
    case when v_processing_fee > 0 then ' This is your full payment, less a real, non-refundable bank processing fee of ' || v_processing_fee || ' — CHS''s own commission has been fully returned to you.' else '' end,
    '/wallet');

  perform log_audit_event('request_rent_refund', 'rent_payments', p_rent_payment_id,
    v_property_title || ' — refunded ' || v_real_refund || ' (' || v_reason_text || ')', null);
end;
$$;

revoke all on function request_rent_refund(uuid, text) from public, anon;
grant execute on function request_rent_refund(uuid, text) to authenticated, service_role;

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
  v_seller_pct numeric;
  v_buyer_commission numeric;
  v_seller_commission numeric;
  v_deal_seller_net numeric;
  v_seller_held numeric;
  v_processing_fee numeric;
  v_real_refund numeric;
  v_is_admin_action boolean := false;
  v_reason_text text;
begin
  select buyer_id, property_id, document_deadline, payment_status, legal_transfer_confirmed, amount
    into v_buyer_id, v_property_id, v_deadline, v_payment_status, v_legal_confirmed, v_offer_amount
    from offers where id = p_offer_id;

  if v_buyer_id is null then
    raise exception 'This real offer does not exist.';
  end if;

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
    raise exception 'This offer was never paid for, or has already been refunded.';
  end if;
  if v_legal_confirmed then
    raise exception 'The real legal document transfer has already been confirmed complete — a refund is no longer available.';
  end if;
  if v_deadline is not null and now() < v_deadline then
    raise exception 'The document delivery window has not yet passed. It ends on %.', v_deadline;
  end if;

  if exists (select 1 from transaction_commissions where offer_id = p_offer_id and transaction_type = 'agent_managed_sale') then
    raise exception 'This was an agent-managed sale — the agent has already been paid directly, so reversing it needs manual review by CHS finance rather than an automatic refund.';
  end if;

  select owner_id, title into v_seller_id, v_property_title from properties where id = v_property_id;

  select value::numeric into v_buyer_pct from platform_settings where key = 'sale_commission_buyer_percentage';
  select value::numeric into v_seller_pct from platform_settings where key = 'sale_commission_seller_percentage';
  v_buyer_commission := round(v_offer_amount * v_buyer_pct / 100, 2);

  -- Prefer the real recorded seller commission for this very deal;
  -- fall back to the configured percentage only if none was recorded.
  select commission_amount into v_seller_commission from transaction_commissions
    where offer_id = p_offer_id and payer_role = 'seller' limit 1;
  v_seller_commission := coalesce(v_seller_commission, round(v_offer_amount * v_seller_pct / 100, 2));
  v_deal_seller_net := v_offer_amount - v_seller_commission;

  v_processing_fee := calculate_real_processing_fee(v_buyer_commission);
  v_real_refund := v_offer_amount + v_buyer_commission - v_processing_fee;
  v_reason_text := case when v_is_admin_action then p_admin_reason else 'legal documents not delivered in time' end;

  select escrow_held into v_seller_held from wallets where user_id = v_seller_id;

  update wallets set main_balance = main_balance + v_real_refund, updated_at = now() where user_id = v_buyer_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_buyer_id, 'main', v_real_refund, 'credit',
    'Refund — ' || v_property_title || ', ' || v_reason_text ||
    ' (price ' || v_offer_amount || ' + your commission ' || v_buyer_commission || ', less a real, non-refundable bank processing fee of ' || v_processing_fee || ')',
    'REFUND-' || substr(gen_random_uuid()::text, 1, 8));

  -- Reverse ONLY this deal's own held amount, never the whole balance.
  update wallets set escrow_held = greatest(0, escrow_held - v_deal_seller_net), updated_at = now() where user_id = v_seller_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_seller_id, 'escrow_held', least(v_deal_seller_net, coalesce(v_seller_held, 0)), 'debit',
    'Sale reversed — refunded to buyer (' || v_reason_text || ')',
    'REFUND-' || substr(gen_random_uuid()::text, 1, 8));

  update offers set refund_status = 'refunded', payment_status = 'unpaid', status = 'rejected' where id = p_offer_id;
  update properties set status = 'active' where id = v_property_id;
  delete from transaction_commissions where offer_id = p_offer_id;

  perform notify_user(v_seller_id, '⚠️ Sale reversed — refund issued',
    'The sale of ' || v_property_title || ' has been reversed and ' || v_deal_seller_net || ' removed from your held balance, with the full amount refunded to the buyer. Reason: ' || v_reason_text || '. Your property is listed as available again.',
    '/property/' || v_property_id);
  perform notify_user(v_buyer_id, '✓ Refund issued',
    'Your refund of ' || v_real_refund || ' for ' || v_property_title || ' has been credited to your wallet — your full payment, less a real, non-refundable bank processing fee of ' || v_processing_fee || '. CHS''s own commission has been fully returned to you.',
    '/wallet');

  perform log_audit_event('request_sale_refund', 'offers', p_offer_id,
    v_property_title || ' — refunded ' || v_real_refund || ' (' || v_reason_text || ')', null);
end;
$$;

revoke all on function request_sale_refund(uuid, text) from public, anon;
grant execute on function request_sale_refund(uuid, text) to authenticated, service_role;
