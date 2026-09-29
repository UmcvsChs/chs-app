-- SECURITY: close public access to privileged database functions.
--
-- Found during a documentation/Supabase audit. 25 functions run with
-- full database rights (SECURITY DEFINER) yet checked nothing about
-- who was calling, and were executable by anyone -- including people
-- who are not signed in -- through the public API:
--   * money primitives: credit_wallet, debit_wallet_for_withdrawal,
--     credit_back_failed_withdrawal, grant_roadmap_access,
--     generate_shortlet_commission
--   * background jobs: process_auto_pay_rents, run_daily_promo_charges,
--     dispatch_due_reminders, expire_urgent_sales, and others
--   * admin data feeds returning names, phones, ID numbers and ID
--     document links (get_pending_registrations_full,
--     get_recently_handled_registrations, ...) -- confirmed: a caller
--     who was not signed in received 35 records
--   * the rent-escrow release (release_rent_to_landlord, built last
--     week without a caller check -- a landlord could have released
--     their own held rent)
--   * promote_listing, which debited whatever wallet id the caller
--     supplied and did not reject a negative amount.
--
-- Fix: (1) lock the internal ones to the server only (the payment
-- webhook and withdrawal function use the service key; the four
-- scheduled jobs run as the database owner; nothing else calls them).
-- (2) put a real caller check in front of every admin feed, keeping
-- the original logic untouched by wrapping it. (3) make the rest
-- verify the caller.

-- 1) Internal functions: server / scheduler only -------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = any (array[
        'credit_wallet','debit_wallet_for_withdrawal','credit_back_failed_withdrawal',
        'grant_roadmap_access','generate_shortlet_commission',
        'process_auto_pay_rents','process_management_terminations',
        'schedule_maintenance_reminders','schedule_rent_reminders',
        'apply_matured_bank_changes','dispatch_due_reminders','expire_urgent_sales',
        'recompute_promo_rank_categories','run_daily_promo_charges',
        'release_rent_to_landlord'])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- 2) Admin data feeds: wrap the original, add a caller check --------
alter function get_pending_registrations_full()        rename to get_pending_registrations_full_impl;
alter function get_recently_handled_registrations()    rename to get_recently_handled_registrations_impl;
alter function get_admin_processed_history()           rename to get_admin_processed_history_impl;
alter function get_stale_uncollected_commissions()     rename to get_stale_uncollected_commissions_impl;
alter function admin_search_properties(text)           rename to admin_search_properties_impl;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname like '%\_impl' escape '\'
      and p.proname in ('get_pending_registrations_full_impl','get_recently_handled_registrations_impl',
                        'get_admin_processed_history_impl','get_stale_uncollected_commissions_impl','admin_search_properties_impl')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

create function get_pending_registrations_full() returns json
language plpgsql security definer set search_path = public as $$
begin
  if not staff_can_access('registration_setup') then raise exception 'Not authorised: registrations are visible to CHS registration staff only.'; end if;
  return get_pending_registrations_full_impl();
end $$;

create function get_recently_handled_registrations() returns json
language plpgsql security definer set search_path = public as $$
begin
  if not staff_can_access('registration_setup') then raise exception 'Not authorised: registrations are visible to CHS registration staff only.'; end if;
  return get_recently_handled_registrations_impl();
end $$;

create function get_admin_processed_history() returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  return get_admin_processed_history_impl();
end $$;

create function get_stale_uncollected_commissions() returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  return get_stale_uncollected_commissions_impl();
end $$;

create function admin_search_properties(p_query text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  return admin_search_properties_impl(p_query);
end $$;

revoke all on function get_pending_registrations_full(), get_recently_handled_registrations(),
  get_admin_processed_history(), get_stale_uncollected_commissions(), admin_search_properties(text)
  from public, anon;
grant execute on function get_pending_registrations_full(), get_recently_handled_registrations(),
  get_admin_processed_history(), get_stale_uncollected_commissions(), admin_search_properties(text)
  to authenticated, service_role;

-- 3) Admin-only early release of held rent (the app calls this) -----
create function admin_release_rent(p_rent_payment_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not staff_can_access('owner_buyer_tenant') then
    raise exception 'Not authorised: only CHS admins can release held rent early.';
  end if;
  perform release_rent_to_landlord(p_rent_payment_id, 'admin_override');
end $$;
revoke all on function admin_release_rent(uuid) from public, anon;
grant execute on function admin_release_rent(uuid) to authenticated, service_role;

-- 4) Clean-report release: only that tenancy's own tenant (or admin) --
create or replace function check_and_release_on_clean_report(p_report_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tenancy_id uuid; v_report_type text; v_rooms jsonb; v_tenant uuid;
  v_has_issue boolean := false; v_rent_payment_id uuid;
begin
  select tenancy_id, report_type, rooms into v_tenancy_id, v_report_type, v_rooms
    from condition_reports where id = p_report_id;
  if v_report_type is distinct from 'move_in' or v_tenancy_id is null then return; end if;

  select tenant_id into v_tenant from tenancies where id = v_tenancy_id;
  if auth.uid() is null or (auth.uid() <> v_tenant and not is_admin()) then
    raise exception 'Not authorised: only the tenant of this tenancy can release rent with their own clean report.';
  end if;

  select exists(
    select 1 from jsonb_array_elements(v_rooms) as room, jsonb_array_elements(room->'items') as item
    where item->>'condition' != 'good'
  ) into v_has_issue;
  if v_has_issue then return; end if;

  select id into v_rent_payment_id from rent_payments
    where tenancy_id = v_tenancy_id and released_at is null
    order by created_at desc limit 1;
  if v_rent_payment_id is not null then
    perform release_rent_to_landlord(v_rent_payment_id, 'clean_report');
  end if;
end $$;
revoke all on function check_and_release_on_clean_report(uuid) from public, anon;
grant execute on function check_and_release_on_clean_report(uuid) to authenticated, service_role;

-- 5) promote_listing: spend only your own wallet, on your own listing --
create or replace function promote_listing(p_property_id uuid, p_owner_id uuid, p_amount numeric, p_days integer, p_tier_name text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_balance numeric;
begin
  if auth.uid() is null or auth.uid() <> p_owner_id then
    raise exception 'You can only promote your own listings, paying from your own wallet.';
  end if;
  if p_amount is null or p_amount <= 0 or p_days is null or p_days <= 0 then
    raise exception 'Invalid promotion amount or duration.';
  end if;
  if not exists (select 1 from properties where id = p_property_id and owner_id = p_owner_id) then
    raise exception 'This listing does not belong to you.';
  end if;

  select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)
    into v_balance from wallet_transactions where user_id = p_owner_id and wallet_type = 'main';
  if v_balance < p_amount then return false; end if;

  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (p_owner_id, 'main', p_amount, 'debit', p_tier_name || ' listing promotion', 'PROMO-' || substr(p_property_id::text, 1, 8));

  update properties set promoted_until = greatest(coalesce(promoted_until, now()), now()) + (p_days || ' days')::interval
    where id = p_property_id and owner_id = p_owner_id;
  return true;
end $$;
revoke all on function promote_listing(uuid, uuid, numeric, integer, text) from public, anon;
grant execute on function promote_listing(uuid, uuid, numeric, integer, text) to authenticated, service_role;

-- 6) Only signed-in users -----------------------------------------
revoke all on function notify_user(uuid, text, text, text) from public, anon;
grant execute on function notify_user(uuid, text, text, text) to authenticated, service_role;
revoke all on function get_readiness_score(uuid) from public, anon;
grant execute on function get_readiness_score(uuid) to authenticated, service_role;

create function has_approved_admin_login_guarded(p_admin_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_admin_id is distinct from auth.uid() then return false; end if;
  return has_approved_admin_login(p_admin_id);
end $$;
revoke all on function has_approved_admin_login(uuid) from public, anon, authenticated;
grant execute on function has_approved_admin_login(uuid) to service_role;
revoke all on function has_approved_admin_login_guarded(uuid) from public, anon;
grant execute on function has_approved_admin_login_guarded(uuid) to authenticated, service_role;

-- 7) Internal test-results table was open to the public API --------
alter table test_run_results enable row level security;
drop policy if exists test_run_results_admin_read on test_run_results;
create policy test_run_results_admin_read on test_run_results for select using (is_admin());
