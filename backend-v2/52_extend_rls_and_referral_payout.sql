-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Extend RLS Scoping to Remaining Admin Tables
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 51_subadmin_roles_and_approval_queue.sql.

select count(*) as schema_already_set_up from admin_action_requests;

-- ───────────────────────────────────────────────────────────────
-- 1. profiles — split, not blanket-replaced. Every admin domain
--    legitimately needs to READ other users' names/details for
--    context (a customer_care admin viewing a dispute needs to see
--    who's involved; an agent_relations admin needs agent details for
--    a referral fee). Only the WRITE (approving a registration) is
--    genuinely registration_setup's — and that write now goes through
--    the approval queue's apply_admin_action (security definer), not
--    a client-side .update() at all, so profiles_admin_all can be
--    narrowed to read-only without breaking anyone's real workflow.
-- ───────────────────────────────────────────────────────────────

drop policy if exists "profiles_admin_all" on profiles;
create policy "profiles_admin_read"
  on profiles for select
  using (is_admin());

-- ───────────────────────────────────────────────────────────────
-- 2. Domain-specific tables — each genuinely belongs to one admin,
--    per direct instruction, with no legitimate cross-domain need.
-- ───────────────────────────────────────────────────────────────

drop policy if exists "disputes_admin_all" on disputes;
create policy "disputes_admin_all" on disputes for all using (staff_can_access('customer_care'));

drop policy if exists "community_admin_all" on community_feedback;
create policy "community_admin_all" on community_feedback for all using (staff_can_access('customer_care'));

drop policy if exists "liveness_admin_all" on liveness_submissions;
create policy "liveness_admin_all" on liveness_submissions for all using (staff_can_access('registration_setup'));

drop policy if exists "rental_applications_admin_all" on rental_applications;
create policy "rental_applications_admin_all" on rental_applications for all using (staff_can_access('owner_buyer_tenant'));
drop policy if exists "rental_applications_admin_update" on rental_applications;

drop policy if exists "offers_admin_all" on offers;
create policy "offers_admin_all" on offers for all using (staff_can_access('owner_buyer_tenant'));

drop policy if exists "inspections_admin_all" on inspections;
create policy "inspections_admin_all" on inspections for all using (staff_can_access('owner_buyer_tenant'));

drop policy if exists "concierge_requests_admin_all" on concierge_requests;
create policy "concierge_requests_admin_all" on concierge_requests for all using (staff_can_access('owner_buyer_tenant'));

drop policy if exists "referral_fees_owed_admin_all" on referral_fees_owed;
create policy "referral_fees_owed_admin_all" on referral_fees_owed for all using (staff_can_access('agent_relations'));

drop policy if exists "marketplace_vendors_admin_all" on marketplace_vendors;
create policy "marketplace_vendors_admin_all" on marketplace_vendors for all using (staff_can_access('artisan_dev_pm_vendor'));

drop policy if exists "developer_applications_admin_all" on developer_applications;
create policy "developer_applications_admin_all" on developer_applications for all using (staff_can_access('artisan_dev_pm_vendor'));

drop policy if exists "faults_admin_all" on fault_reports;
create policy "faults_admin_all" on fault_reports for all using (staff_can_access('artisan_dev_pm_vendor'));

-- ───────────────────────────────────────────────────────────────
-- 3. Engage CHS — exclusively the super admin's, per direct
--    instruction ("finance, supervision, and engagement... admin 1").
--    Not routed through staff_can_access at all, since no sub-admin
--    should ever be assignable here — a direct is_super_admin check
--    instead, so this can never accidentally be opened by adding a
--    new staff_role value later.
-- ───────────────────────────────────────────────────────────────

drop policy if exists "engage_admin_all" on engage_chs_requests;
create policy "engage_admin_all"
  on engage_chs_requests for all
  using (exists (select 1 from profiles where id = auth.uid() and is_super_admin = true));

-- ───────────────────────────────────────────────────────────────
-- 4. Referral fee payout — a real financial disbursement, so it
--    joins the same high-stakes queue as the others, even though
--    day-to-day referral triage belongs to agent_relations.
-- ───────────────────────────────────────────────────────────────

alter table admin_action_requests drop constraint if exists admin_action_requests_action_type_check;
alter table admin_action_requests add constraint admin_action_requests_action_type_check
  check (action_type in (
    'verify_property','approve_profile','verify_artisan','verify_vendor',
    'review_developer','clear_sale','freeze_wallet','review_liveness','mark_referral_paid'
  ));

create or replace function apply_admin_action(p_request_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  req record;
begin
  select * into req from admin_action_requests where id = p_request_id;

  if req.action_type = 'verify_property' then
    update properties set verification_status = req.proposed_changes->>'verification_status' where id = req.target_id;
  elsif req.action_type = 'clear_sale' then
    update offers set chs_cleared = true where id = req.target_id;
  elsif req.action_type = 'approve_profile' then
    update profiles set status = req.proposed_changes->>'status' where id = req.target_id;
  elsif req.action_type = 'review_liveness' then
    update liveness_submissions set status = req.proposed_changes->>'status' where id = req.target_id;
    if (req.proposed_changes->>'status') = 'approved' then
      update profiles set valid_id_verified = true
        where id = (select user_id from liveness_submissions where id = req.target_id);
    end if;
  elsif req.action_type = 'verify_artisan' then
    update artisans set verification_status = req.proposed_changes->>'verification_status' where id = req.target_id;
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

create or replace function request_admin_action(
  p_action_type text, p_target_id uuid, p_proposed_changes jsonb, p_note text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_domain text;
  v_id uuid;
  v_requester_name text;
  v_is_super boolean;
begin
  v_domain := case p_action_type
    when 'verify_property' then 'owner_buyer_tenant'
    when 'clear_sale' then 'owner_buyer_tenant'
    when 'approve_profile' then 'registration_setup'
    when 'review_liveness' then 'registration_setup'
    when 'verify_artisan' then 'artisan_dev_pm_vendor'
    when 'verify_vendor' then 'artisan_dev_pm_vendor'
    when 'review_developer' then 'artisan_dev_pm_vendor'
    when 'freeze_wallet' then 'finance'
    when 'mark_referral_paid' then 'agent_relations'
  end;

  select is_super_admin into v_is_super from profiles where id = auth.uid();

  if not coalesce(v_is_super, false) then
    if not exists (select 1 from profiles where id = auth.uid() and staff_role = v_domain) then
      raise exception 'This action is outside your assigned admin role.';
    end if;
  end if;

  if coalesce(v_is_super, false) then
    v_id := uuid_generate_v4();
    insert into admin_action_requests (id, requested_by, domain, action_type, target_id, proposed_changes, note, status, resolved_at, resolved_by)
    values (v_id, auth.uid(), v_domain, p_action_type, p_target_id, p_proposed_changes, p_note, 'approved', now(), auth.uid());
    perform apply_admin_action(v_id);
    return v_id;
  end if;

  select full_name into v_requester_name from profiles where id = auth.uid();

  insert into admin_action_requests (requested_by, domain, action_type, target_id, proposed_changes, note)
  values (auth.uid(), v_domain, p_action_type, p_target_id, p_proposed_changes, p_note)
  returning id into v_id;

  insert into notifications (user_id, title, body)
  select id, '⚠️ Approval needed: ' || p_action_type,
    v_requester_name || ' is requesting ' || p_action_type || ' — review before it takes effect.'
  from profiles where is_super_admin = true;

  return v_id;
end;
$$;

select policyname, tablename from pg_policies where tablename in ('profiles','disputes','offers','rental_applications') and policyname ilike '%admin%';
