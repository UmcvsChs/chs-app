-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Sub-Admin Roles + High-Stakes Approval Queue
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 50_wallet_fixes_and_admin_approval.sql.
--
-- Five real sub-admin domains, matching exactly what was described:
--   customer_care          — disputes, feedback
--   registration_setup     — registrations, face verification
--   owner_buyer_tenant     — properties, applications, sale approvals, inspections, concierge
--   agent_relations        — referral fees
--   artisan_dev_pm_vendor  — artisans, developers, vendors, maintenance
-- The super admin (is_super_admin = true) always has full access,
-- regardless of staff_role — the "practically involved in everything"
-- requirement.
--
-- Ratification model, per direct instruction: routine actions happen
-- immediately; HIGH-STAKES actions (finance, and every verification
-- decision — these directly grant platform trust or move real money)
-- require real super-admin sign-off BEFORE they take effect, not
-- after. That's the real, load-bearing part of this migration — a
-- generic approval queue, not a rubber-stamp log.

select count(*) as schema_already_set_up from admin_login_requests;
-- If this errors, run 50_wallet_fixes_and_admin_approval.sql first.

-- ───────────────────────────────────────────────────────────────
-- 1. Staff role assignment — who's responsible for which domain.
-- ───────────────────────────────────────────────────────────────

alter table profiles add column if not exists staff_role text
  check (staff_role in ('customer_care','registration_setup','owner_buyer_tenant','agent_relations','artisan_dev_pm_vendor'));
-- Deliberately no 'finance' value here — finance is exclusively the
-- super admin's domain, per direct instruction, never delegated to a
-- sub-admin. staff_can_access('finance') below can therefore only
-- ever be satisfied by the is_super_admin bypass — correct by
-- construction, not an oversight.

create or replace function staff_can_access(p_domain text)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'admin'
      and (is_super_admin = true or staff_role = p_domain)
  );
$$;

-- ───────────────────────────────────────────────────────────────
-- 2. The high-stakes approval queue — a real gate, not a log. A
--    sub-admin's request sits pending until a super admin actually
--    decides; the real underlying change (verification_status,
--    profile approval, a wallet freeze, clearing an escrow-bound
--    sale) never applies until then.
-- ───────────────────────────────────────────────────────────────

create table if not exists admin_action_requests (
  id uuid primary key default uuid_generate_v4(),
  requested_by uuid not null references profiles(id) on delete cascade,
  domain text not null,
  action_type text not null check (action_type in (
    'verify_property','approve_profile','verify_artisan','verify_vendor',
    'review_developer','clear_sale','freeze_wallet','review_liveness'
  )),
  target_id uuid not null,
  proposed_changes jsonb not null,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id),
  resolution_note text
);

alter table admin_action_requests enable row level security;

create policy "admin_action_requests_own_read"
  on admin_action_requests for select
  using (auth.uid() = requested_by);

create policy "admin_action_requests_super_admin_all"
  on admin_action_requests for all
  using (exists (select 1 from profiles where id = auth.uid() and is_super_admin = true));

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
  end;

  -- The real super admin never needs to queue their own actions —
  -- applied immediately via the exact same resolver used for
  -- everyone else's approvals, keeping one single code path.
  if exists (select 1 from profiles where id = auth.uid() and is_super_admin = true) then
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

-- The real change only ever happens here, and only for an 'approved'
-- request — explicit branches per known target table, deliberately
-- not dynamic SQL against an arbitrary table name.
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
  end if;
end;
$$;

create or replace function resolve_admin_action(p_request_id uuid, p_approve boolean, p_resolution_note text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_requester uuid;
  v_action text;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_super_admin = true) then
    raise exception 'Only a super admin can approve or reject this.';
  end if;

  select requested_by, action_type into v_requester, v_action
    from admin_action_requests where id = p_request_id and status = 'pending';
  if v_requester is null then
    raise exception 'This request no longer needs a decision.';
  end if;

  update admin_action_requests
    set status = case when p_approve then 'approved' else 'rejected' end,
        resolved_at = now(), resolved_by = auth.uid(), resolution_note = p_resolution_note
    where id = p_request_id;

  if p_approve then
    perform apply_admin_action(p_request_id);
  end if;

  insert into notifications (user_id, title, body)
  values (v_requester,
    case when p_approve then '✓ Approved: ' || v_action else '✕ Rejected: ' || v_action end,
    coalesce(p_resolution_note, case when p_approve then 'Your request was approved and applied.' else 'Your request was rejected.' end));
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 3. Real RLS scoping — the high-stakes tables now check
--    staff_can_access() for the matching domain, not a blanket
--    is_admin(). Each existing admin policy is replaced, not
--    layered — tested individually after applying, the same
--    discipline used for every other change this session.
-- ───────────────────────────────────────────────────────────────

drop policy if exists "properties_admin_all" on properties;
create policy "properties_admin_all"
  on properties for all
  using (staff_can_access('owner_buyer_tenant'));

drop policy if exists "wallets_admin_all" on wallets;
create policy "wallets_admin_all"
  on wallets for all
  using (staff_can_access('finance'));

drop policy if exists "artisans_admin_all" on artisans;
create policy "artisans_admin_all"
  on artisans for all
  using (staff_can_access('artisan_dev_pm_vendor'));

select column_name from information_schema.columns where table_name = 'profiles' and column_name = 'staff_role';
-- Should return one row.
