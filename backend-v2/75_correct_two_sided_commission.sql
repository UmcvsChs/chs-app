-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Correction: Two-Sided Commission, Per the Real,
-- Client-Confirmed Reference Document
-- ═══════════════════════════════════════════════════════════════
-- Replaces the incorrect, invented 5%-seller-only commission with the
-- real, documented rates: Sale — Buyer 6.5%, Seller 6%. Rental —
-- Tenant 5%, Landlord 5.5%. Sourced from
-- CHS_Commission_Pricing_Model_Reference.md, matching the real
-- Terms & Conditions text verbatim — not a new guess.

select count(*) as schema_already_set_up from tenancies;

drop function if exists pay_sale_commission(uuid);
drop function if exists generate_sale_commission(uuid);
drop table if exists sale_commissions;

delete from platform_settings where key = 'sale_commission_percentage';
insert into platform_settings (key, value) values
  ('sale_commission_buyer_percentage', '6.5'),
  ('sale_commission_seller_percentage', '6'),
  ('rental_commission_tenant_percentage', '5'),
  ('rental_commission_landlord_percentage', '5.5')
on conflict (key) do nothing;

-- ───────────────────────────────────────────────────────────────
-- 1. One real, unified table — a transaction commission is either a
--    sale-side or rental-side charge, to either party, always
--    computed from the live, admin-editable settings above.
-- ───────────────────────────────────────────────────────────────

create table transaction_commissions (
  id uuid primary key default uuid_generate_v4(),
  transaction_type text not null check (transaction_type in ('sale', 'rental')),
  offer_id uuid references offers(id) on delete cascade,
  tenancy_id uuid references tenancies(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  payer_id uuid not null references profiles(id) on delete cascade,
  payer_role text not null check (payer_role in ('buyer', 'seller', 'tenant', 'landlord')),
  base_amount numeric(14,2) not null,
  commission_percentage numeric(5,2) not null,
  commission_amount numeric(14,2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'waived')),
  paid_at timestamptz,
  reference text,
  created_at timestamptz default now(),
  check (
    (transaction_type = 'sale' and offer_id is not null and tenancy_id is null and payer_role in ('buyer', 'seller'))
    or
    (transaction_type = 'rental' and tenancy_id is not null and offer_id is null and payer_role in ('tenant', 'landlord'))
  ),
  unique (offer_id, payer_role),
  unique (tenancy_id, payer_role)
);

alter table transaction_commissions enable row level security;
create policy "transaction_commissions_own" on transaction_commissions for select using (auth.uid() = payer_id);
create policy "transaction_commissions_admin_all" on transaction_commissions for all using (staff_can_access('finance'));

-- ───────────────────────────────────────────────────────────────
-- 2. Sale — real, two-sided generation. Still fires automatically
--    the instant a sale is genuinely cleared (see apply_admin_action
--    below) — no separate button for either charge.
-- ───────────────────────────────────────────────────────────────

create or replace function generate_sale_commissions(p_offer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_amount numeric;
  v_property_id uuid;
  v_buyer_id uuid;
  v_seller_id uuid;
  v_buyer_pct numeric;
  v_seller_pct numeric;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can finalize sale commissions.';
  end if;

  select amount, property_id, buyer_id into v_amount, v_property_id, v_buyer_id from offers where id = p_offer_id;
  select owner_id into v_seller_id from properties where id = v_property_id;
  select value::numeric into v_buyer_pct from platform_settings where key = 'sale_commission_buyer_percentage';
  select value::numeric into v_seller_pct from platform_settings where key = 'sale_commission_seller_percentage';

  insert into transaction_commissions (transaction_type, offer_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount)
  values
    ('sale', p_offer_id, v_property_id, v_buyer_id, 'buyer', v_amount, v_buyer_pct, round(v_amount * v_buyer_pct / 100, 2)),
    ('sale', p_offer_id, v_property_id, v_seller_id, 'seller', v_amount, v_seller_pct, round(v_amount * v_seller_pct / 100, 2))
  on conflict do nothing;

  perform notify_user(v_buyer_id, '💰 Sale commission invoice generated',
    'A real ' || v_buyer_pct || '% commission (' || round(v_amount * v_buyer_pct / 100, 2) || ') is due on your recent purchase. Please settle it from your CHS wallet.');
  perform notify_user(v_seller_id, '💰 Sale commission invoice generated',
    'A real ' || v_seller_pct || '% commission (' || round(v_amount * v_seller_pct / 100, 2) || ') is due on your recent sale. Please settle it from your CHS wallet.');
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 3. Rental — the real, deeper fix. Approving a rental application
--    never actually created a tenancy anywhere in the app; it only
--    flipped a status flag. This closes that gap AND generates the
--    real, two-sided rental commission at the exact same real
--    moment, matching the same reliable, automatic pattern as sale.
-- ───────────────────────────────────────────────────────────────

create or replace function approve_rental_application(p_application_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_property_id uuid;
  v_tenant_id uuid;
  v_owner_id uuid;
  v_annual_rent numeric;
  v_move_in date;
  v_new_tenancy_id uuid;
  v_tenant_pct numeric;
  v_landlord_pct numeric;
begin
  select property_id, tenant_id, move_in_date into v_property_id, v_tenant_id, v_move_in from rental_applications where id = p_application_id;
  select owner_id, price into v_owner_id, v_annual_rent from properties where id = v_property_id;

  if v_owner_id != auth.uid() and not is_admin() then
    raise exception 'Only the property owner can approve this application.';
  end if;

  update rental_applications set status = 'approved' where id = p_application_id;

  -- The real, missing piece: an approved application now genuinely
  -- becomes a real tenancy, not just a status label.
  insert into tenancies (property_id, tenant_id, landlord_id, lease_start, lease_end, annual_rent, status)
  values (v_property_id, v_tenant_id, v_owner_id, coalesce(v_move_in, current_date), coalesce(v_move_in, current_date) + interval '1 year', v_annual_rent, 'active')
  returning id into v_new_tenancy_id;

  select value::numeric into v_tenant_pct from platform_settings where key = 'rental_commission_tenant_percentage';
  select value::numeric into v_landlord_pct from platform_settings where key = 'rental_commission_landlord_percentage';

  insert into transaction_commissions (transaction_type, tenancy_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount)
  values
    ('rental', v_new_tenancy_id, v_property_id, v_tenant_id, 'tenant', v_annual_rent, v_tenant_pct, round(v_annual_rent * v_tenant_pct / 100, 2)),
    ('rental', v_new_tenancy_id, v_property_id, v_owner_id, 'landlord', v_annual_rent, v_landlord_pct, round(v_annual_rent * v_landlord_pct / 100, 2))
  on conflict do nothing;

  perform notify_user(v_tenant_id, '🏠 Your rental application was approved!',
    'A real ' || v_tenant_pct || '% commission (' || round(v_annual_rent * v_tenant_pct / 100, 2) || ') is due — please settle it from your CHS wallet.');
  perform notify_user(v_owner_id, '💰 Rental commission invoice generated',
    'A real ' || v_landlord_pct || '% commission (' || round(v_annual_rent * v_landlord_pct / 100, 2) || ') is due on this new tenancy.');

  return v_new_tenancy_id;
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 4. One real, generic payment function for either side, either type.
-- ───────────────────────────────────────────────────────────────

create or replace function pay_transaction_commission(p_commission_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_amount numeric;
  v_payer_id uuid;
  v_status text;
  v_balance numeric;
  v_reference text;
begin
  select commission_amount, payer_id, status into v_amount, v_payer_id, v_status from transaction_commissions where id = p_commission_id;

  if v_payer_id != auth.uid() then
    raise exception 'This commission invoice does not belong to you.';
  end if;
  if v_status = 'paid' then
    raise exception 'This commission has already been paid.';
  end if;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_amount then
    raise exception 'Insufficient wallet balance to settle this commission.';
  end if;

  v_reference := 'COMM-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - v_amount, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', v_amount, 'debit', 'Transaction commission payment', v_reference);

  update transaction_commissions set status = 'paid', paid_at = now(), reference = v_reference where id = p_commission_id;
end;
$$;

-- Real fix to the trigger point built earlier — calls the corrected,
-- two-sided function instead of the old, single-sided one.
create or replace function apply_admin_action(p_request_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  req record;
  v_property record;
  v_artisan record;
  interested record;
begin
  select * into req from admin_action_requests where id = p_request_id;

  if req.action_type = 'verify_property' then
    update properties set verification_status = req.proposed_changes->>'verification_status' where id = req.target_id
      returning * into v_property;
    perform notify_user(
      v_property.owner_id,
      case when req.proposed_changes->>'verification_status' = 'verified' then 'Your property listing is now live!'
           else 'Your property listing needs attention' end,
      case when req.proposed_changes->>'verification_status' = 'verified'
           then '"' || v_property.title || '" has been verified and is now publicly visible.'
           else '"' || v_property.title || '" could not be verified. Please contact CHS support for details.' end,
      '/property/' || v_property.id::text
    );

    if req.proposed_changes->>'verification_status' = 'verified' then
      for interested in select user_id from property_interest where property_id = req.target_id loop
        perform notify_user(
          interested.user_id,
          'A property you''re interested in is now verified!',
          '"' || v_property.title || '" is now CHS Verified — you can go ahead with what you were trying to do.',
          '/property/' || v_property.id::text
        );
      end loop;
    end if;

  elsif req.action_type = 'clear_sale' then
    update offers set chs_cleared = true where id = req.target_id;
    perform generate_sale_commissions(req.target_id);

  elsif req.action_type = 'approve_profile' then
    update profiles set status = req.proposed_changes->>'status' where id = req.target_id;
    perform notify_user(
      req.target_id,
      case when req.proposed_changes->>'status' = 'approved' then 'Your CHS account is approved!'
           else 'Your CHS registration needs attention' end,
      case when req.proposed_changes->>'status' = 'approved' then 'You can now fully use CHS.'
           else 'Your registration could not be approved. Please contact CHS support for details.' end
    );

  elsif req.action_type = 'review_liveness' then
    update liveness_submissions set status = req.proposed_changes->>'status' where id = req.target_id;
    if (req.proposed_changes->>'status') = 'approved' then
      update profiles set liveness_verified = true
        where id = (select user_id from liveness_submissions where id = req.target_id);
    end if;

  elsif req.action_type = 'verify_artisan' then
    update artisans set verification_status = req.proposed_changes->>'verification_status' where id = req.target_id
      returning * into v_artisan;
    perform notify_user(
      v_artisan.user_id,
      case when req.proposed_changes->>'verification_status' = 'verified' then 'You''re now a verified CHS artisan!'
           else 'Your artisan registration needs attention' end,
      case when req.proposed_changes->>'verification_status' = 'verified'
           then 'You can now quote on real maintenance jobs matching your trade and location.'
           else 'Your registration could not be verified. Please contact CHS support for details.' end,
      '/artisan'
    );

  elsif req.action_type = 'verify_vendor' then
    update marketplace_vendors set verification_status = req.proposed_changes->>'verification_status' where id = req.target_id;

  elsif req.action_type = 'review_developer' then
    update developer_applications set status = req.proposed_changes->>'status' where id = req.target_id;

  elsif req.action_type = 'freeze_wallet' then
    update wallets set frozen = (req.proposed_changes->>'frozen')::boolean,
      frozen_reason = req.proposed_changes->>'frozen_reason' where user_id = req.target_id;

  elsif req.action_type = 'mark_referral_paid' then
    update referral_fees_owed set status = 'paid' where id = req.target_id;
  end if;
end;
$$;

select count(*) from platform_settings where key like '%commission_percentage';
-- Should return 4.
