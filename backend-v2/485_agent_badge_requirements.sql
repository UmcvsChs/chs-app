-- 485: CHS-approved agent badge — hard requirements. Supersedes the light approval in 483.
-- The badge vouches for an agent's integrity, so the database itself enforces:
--   1. Complete, current KYC (identity verified, valid ID, liveness, NIN, address, phone, email; verified within 12 months)
--      plus an admin checklist of deeper checks, every item ticked.
--   2. At least 10 income-generating transactions for CHS in the last 180 days (direct or as an affiliate).
--   3. A registered corporate body: CAC company, ESVARBON-registered firm or QSRBN-registered firm. Individuals are not eligible.
--   4. Acceptance of the badge terms (version in platform_settings).
-- Valid for 12 months; the badge hides itself on lapse, expired registration, stale KYC, suspension or loss of verification.

insert into public.platform_settings(key, value) values
  ('agent_badge_min_deals', '10'), ('agent_badge_window_days', '180'), ('agent_badge_kyc_max_age_days', '365'),
  ('agent_badge_valid_months', '12'), ('agent_badge_terms_version', '1')
on conflict (key) do nothing;

create table if not exists public.agent_badge_applications (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  reg_body text not null check (reg_body in ('CAC_COMPANY','ESVARBON_FIRM','QSRBN_FIRM')),
  reg_number text not null,
  entity_name text not null,
  registered_on date,
  reg_expiry date,
  certificate_url text not null,
  office_address text not null,
  principals jsonb not null,
  terms_version text not null,
  terms_accepted_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id),
  decision_note text,
  checklist jsonb,
  auto_checks jsonb
);
create unique index if not exists agent_badge_one_open on public.agent_badge_applications(agent_id) where status = 'pending';
alter table public.agent_badge_applications enable row level security;
revoke all on public.agent_badge_applications from anon, authenticated;

alter table public.agent_approvals
  add column if not exists valid_until timestamptz,
  add column if not exists reg_body text, add column if not exists reg_number text, add column if not exists entity_name text,
  add column if not exists reg_expiry date, add column if not exists application_id uuid,
  add column if not exists checklist jsonb, add column if not exists expiry_notified_at timestamptz, add column if not exists lapsed_notified_at timestamptz;

create or replace function public._setting_num(p_key text, p_default numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select nullif(value, '')::numeric from platform_settings where key = p_key), p_default);
$$;

-- distinct income-generating deals in the window: CHS commissions actually paid on properties the agent manages,
-- commissions the agent paid as the agent, and referral deals where the agent was paid.
create or replace function public._agent_income_deals(p_agent uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(distinct k)::int from (
    select coalesce(tc.offer_id::text, tc.tenancy_id::text, tc.shortlet_booking_id::text, tc.rent_to_own_payment_id::text, tc.id::text) as k
    from transaction_commissions tc
    where tc.status = 'paid' and coalesce(tc.commission_amount, 0) > 0 and tc.transaction_type <> 'maintenance_job'
      and tc.paid_at >= now() - make_interval(days => _setting_num('agent_badge_window_days', 180)::int)
      and ((tc.payer_id = p_agent and tc.payer_role = 'agent')
           or exists (select 1 from properties pr where pr.id = tc.property_id and pr.managing_agent_id = p_agent))
    union all
    select 'ref:' || r.id::text from agent_referrals r
    where (r.listing_agent_id = p_agent or r.referring_agent_id = p_agent) and coalesce(r.agent_payout, 0) > 0
      and r.created_at >= now() - make_interval(days => _setting_num('agent_badge_window_days', 180)::int)
  ) x;
$$;

create or replace function public.agent_badge_eligibility(p_agent uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p profiles%rowtype; v_missing text[] := '{}'; v_max int; v_deals int; v_need int; v_app agent_badge_applications%rowtype;
        v_corp boolean := false; v_corp_note text; v_terms boolean := false; v_kyc boolean; v_found boolean;
begin
  select * into p from profiles where id = p_agent;
  v_max := _setting_num('agent_badge_kyc_max_age_days', 365)::int;
  if p.verification_status is distinct from 'verified' then v_missing := array_append(v_missing, 'Identity is not verified'); end if;
  if p.valid_id_verified is not true then v_missing := array_append(v_missing, 'Valid ID is not verified'); end if;
  if p.liveness_verified is not true then v_missing := array_append(v_missing, 'Liveness check not passed'); end if;
  if coalesce(p.nin, '') = '' then v_missing := array_append(v_missing, 'NIN missing'); end if;
  if coalesce(p.residential_address, '') = '' then v_missing := array_append(v_missing, 'Residential address missing'); end if;
  if coalesce(p.phone, '') = '' then v_missing := array_append(v_missing, 'Phone number missing'); end if;
  if coalesce(p.email, '') = '' then v_missing := array_append(v_missing, 'Email missing'); end if;
  if p.verified_at is null or p.verified_at < now() - make_interval(days => v_max) then v_missing := array_append(v_missing, 'KYC is older than ' || v_max || ' days and must be refreshed'); end if;
  if p.status <> 'approved' or p.suspended_at is not null then v_missing := array_append(v_missing, 'Account is not in good standing'); end if;
  v_kyc := coalesce(array_length(v_missing, 1), 0) = 0;
  v_deals := _agent_income_deals(p_agent);
  v_need := _setting_num('agent_badge_min_deals', 10)::int;
  select * into v_app from agent_badge_applications where agent_id = p_agent and status in ('pending','approved') order by submitted_at desc limit 1;
  v_found := found;
  if not v_found then v_corp_note := 'No corporate registration submitted yet';
  elsif v_app.reg_expiry is not null and v_app.reg_expiry < current_date then v_corp_note := 'The registration has expired';
  else v_corp := true; v_corp_note := v_app.entity_name || ' (' || v_app.reg_body || ' ' || v_app.reg_number || ')'; end if;
  v_terms := v_found and v_app.terms_version = (select value from platform_settings where key = 'agent_badge_terms_version');
  return jsonb_build_object('kyc_ok', v_kyc, 'kyc_missing', to_jsonb(v_missing),
    'deals', v_deals, 'deals_needed', v_need, 'deals_ok', v_deals >= v_need, 'window_days', _setting_num('agent_badge_window_days', 180)::int,
    'corporate_ok', v_corp, 'corporate_note', v_corp_note, 'terms_ok', coalesce(v_terms, false),
    'all_ok', v_kyc and v_deals >= v_need and v_corp and coalesce(v_terms, false));
end $$;

create or replace function public._agent_badge_active(p_agent uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from agent_approvals a join profiles p on p.id = a.agent_id
    where a.agent_id = p_agent and a.revoked_at is null
      and a.valid_until is not null and a.valid_until > now()
      and (a.reg_expiry is null or a.reg_expiry >= current_date)
      and (p.role = 'agent' or 'agent' = any(coalesce(p.secondary_roles, '{}')))
      and p.status = 'approved' and p.verification_status = 'verified' and p.suspended_at is null
      and p.verified_at >= now() - make_interval(days => _setting_num('agent_badge_kyc_max_age_days', 365)::int));
$$;

create or replace function public.get_agent_badge(p_agent uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare p profiles%rowtype; a agent_approvals%rowtype;
begin
  if p_agent is null or not _agent_badge_active(p_agent) then return json_build_object('approved', false); end if;
  select * into p from profiles where id = p_agent;
  select * into a from agent_approvals where agent_id = p_agent;
  return json_build_object('approved', true, 'chs_agent_id', p.chs_agent_id, 'entity_name', a.entity_name, 'reg_body', a.reg_body,
    'reg_number', a.reg_number, 'since', a.approved_at, 'valid_until', a.valid_until, 'deals', coalesce(p.deals_completed, 0));
end $$;

create or replace function public.submit_agent_badge_application(p_reg_body text, p_reg_number text, p_entity_name text, p_registered_on date,
  p_reg_expiry date, p_certificate_url text, p_office_address text, p_principals jsonb, p_terms_version text) returns json
language plpgsql security definer set search_path = public as $$
declare p profiles%rowtype; e jsonb; v_id uuid; pr jsonb;
begin
  select * into p from profiles where id = auth.uid();
  if not found or not (p.role = 'agent' or 'agent' = any(coalesce(p.secondary_roles, '{}'))) then raise exception 'Only registered agents can apply.'; end if;
  if p_terms_version is distinct from (select value from platform_settings where key = 'agent_badge_terms_version') then raise exception 'Please read and accept the current badge terms.'; end if;
  if p_reg_body not in ('CAC_COMPANY','ESVARBON_FIRM','QSRBN_FIRM') then raise exception 'Only a CAC-registered company, an ESVARBON-registered firm or a QSRBN-registered firm can hold the badge. Individuals are not eligible.'; end if;
  if coalesce(trim(p_reg_number), '') = '' or coalesce(trim(p_entity_name), '') = '' or coalesce(trim(p_office_address), '') = '' or coalesce(p_certificate_url, '') = '' then
    raise exception 'Registration number, registered name, office address and the registration certificate are all required.'; end if;
  if p_reg_body <> 'CAC_COMPANY' and p_reg_expiry is null then raise exception 'Please give the date your current registration or practising licence expires.'; end if;
  if p_reg_expiry is not null and p_reg_expiry < current_date then raise exception 'That registration has expired. Renew it first.'; end if;
  if jsonb_typeof(p_principals) <> 'array' or jsonb_array_length(p_principals) < 1 then raise exception 'List at least one director or principal.'; end if;
  for pr in select * from jsonb_array_elements(p_principals) loop
    if coalesce(trim(pr->>'name'), '') = '' or coalesce(trim(pr->>'role'), '') = '' then raise exception 'Every director or principal needs a name and a role.'; end if;
  end loop;
  e := agent_badge_eligibility(auth.uid());
  if not (e->>'kyc_ok')::boolean then raise exception 'Your KYC must be complete and current first: %', (select string_agg(x, '; ') from jsonb_array_elements_text(e->'kyc_missing') x); end if;
  if not (e->>'deals_ok')::boolean then raise exception 'You need % income-generating transactions in the last % days. You have %.', e->>'deals_needed', e->>'window_days', e->>'deals'; end if;
  if exists(select 1 from agent_badge_applications where agent_id = auth.uid() and status = 'pending') then raise exception 'You already have an application under review.'; end if;
  insert into agent_badge_applications(agent_id, reg_body, reg_number, entity_name, registered_on, reg_expiry, certificate_url, office_address, principals, terms_version)
  values (auth.uid(), p_reg_body, trim(p_reg_number), trim(p_entity_name), p_registered_on, p_reg_expiry, p_certificate_url, trim(p_office_address), p_principals, p_terms_version)
  returning id into v_id;
  perform notify_admins_by_domain('owner_buyer_tenant', 'Agent badge application', coalesce(p.full_name, 'An agent') || ' (' || coalesce(p.chs_agent_id, '') || ') applied for the CHS-approved agent badge for ' || trim(p_entity_name) || '.', '/admin?tab=chsstamp');
  return json_build_object('id', v_id);
end $$;

create or replace function public.withdraw_agent_badge_application() returns void
language plpgsql security definer set search_path = public as $$
begin
  update agent_badge_applications set status = 'withdrawn', decided_at = now() where agent_id = auth.uid() and status = 'pending';
end $$;

create or replace function public.admin_decide_agent_badge(p_application uuid, p_approve boolean, p_checklist jsonb default null, p_note text default null) returns json
language plpgsql security definer set search_path = public as $$
declare a agent_badge_applications%rowtype; e jsonb; k text; v_months int; v_until timestamptz;
begin
  if not coalesce(is_admin(), false) then raise exception 'admin_only'; end if;
  select * into a from agent_badge_applications where id = p_application for update;
  if not found or a.status <> 'pending' then raise exception 'This application is not open.'; end if;
  if not p_approve then
    if coalesce(trim(p_note), '') = '' then raise exception 'Please give the reason, so the agent knows what to fix.'; end if;
    update agent_badge_applications set status = 'rejected', decided_at = now(), decided_by = auth.uid(), decision_note = p_note, checklist = p_checklist where id = a.id;
    perform notify_user(a.agent_id, 'Your CHS-approved agent application was not approved', 'Reason: ' || p_note, '/agent');
    perform log_audit_event('agent_badge_rejected', 'agent_badge_applications', a.id, a.entity_name, jsonb_build_object('note', p_note));
    return json_build_object('approved', false);
  end if;
  e := agent_badge_eligibility(a.agent_id);
  if not (e->>'all_ok')::boolean then raise exception 'The agent does not meet the automatic requirements: %', e::text; end if;
  foreach k in array array['id_matches_nin','address_verified','principals_kyc','registration_verified_at_source','office_verified','references_checked','adverse_record_check','fee_conduct_ok'] loop
    if coalesce((p_checklist->>k)::boolean, false) is not true then raise exception 'Checklist item "%" has not been ticked.', k; end if;
  end loop;
  if a.reg_expiry is not null and a.reg_expiry < current_date then raise exception 'The registration has expired.'; end if;
  v_months := _setting_num('agent_badge_valid_months', 12)::int;
  v_until := now() + make_interval(months => v_months);
  insert into agent_approvals(agent_id, approved_by, note, valid_until, reg_body, reg_number, entity_name, reg_expiry, application_id, checklist)
  values (a.agent_id, auth.uid(), p_note, v_until, a.reg_body, a.reg_number, a.entity_name, a.reg_expiry, a.id, p_checklist)
  on conflict (agent_id) do update set approved_at = now(), approved_by = auth.uid(), note = p_note, revoked_at = null, revoked_note = null,
    valid_until = v_until, reg_body = a.reg_body, reg_number = a.reg_number, entity_name = a.entity_name, reg_expiry = a.reg_expiry,
    application_id = a.id, checklist = p_checklist, expiry_notified_at = null, lapsed_notified_at = null;
  update agent_badge_applications set status = 'approved', decided_at = now(), decided_by = auth.uid(), decision_note = p_note, checklist = p_checklist, auto_checks = e where id = a.id;
  perform notify_user(a.agent_id, '✓ You are now a CHS-approved agent', a.entity_name || ' now carries the CHS-approved agent badge until ' || to_char(v_until, 'DD Mon YYYY') || '. Keep your registration and KYC current to keep it.', '/agent');
  perform log_audit_event('agent_badge_approved', 'agent_badge_applications', a.id, a.entity_name, jsonb_build_object('until', v_until, 'checks', e));
  return json_build_object('approved', true, 'valid_until', v_until);
end $$;

-- removal only; approval goes through the application above
create or replace function public.admin_set_agent_approval(p_agent uuid, p_approve boolean, p_note text default null) returns json
language plpgsql security definer set search_path = public as $$
declare p profiles%rowtype;
begin
  if not coalesce(is_admin(), false) then raise exception 'admin_only'; end if;
  if p_approve then raise exception 'Approval now goes through the badge application review.'; end if;
  select * into p from profiles where id = p_agent;
  if coalesce(trim(p_note), '') = '' then raise exception 'Please give a reason for removing the badge.'; end if;
  update agent_approvals set revoked_at = now(), revoked_note = p_note where agent_id = p_agent;
  if not found then raise exception 'This agent was never approved.'; end if;
  perform notify_user(p_agent, 'Your CHS-approved agent badge was removed', 'Reason: ' || p_note, '/agent');
  perform log_audit_event('agent_approval_set', 'profiles', p_agent, p.full_name, jsonb_build_object('approve', false, 'note', p_note));
  return json_build_object('agent', p_agent, 'approved', false);
end $$;

create or replace function public.get_my_agent_approval() returns json
language plpgsql stable security definer set search_path = public as $$
declare a agent_approvals%rowtype; p profiles%rowtype; v_has boolean; app agent_badge_applications%rowtype; v_app json := null; v_app_found boolean;
begin
  select * into p from profiles where id = auth.uid();
  select * into a from agent_approvals where agent_id = auth.uid();
  v_has := found;
  select * into app from agent_badge_applications where agent_id = auth.uid() order by submitted_at desc limit 1;
  v_app_found := found;
  if v_app_found then v_app := json_build_object('id', app.id, 'status', app.status, 'decision_note', app.decision_note, 'entity_name', app.entity_name, 'submitted_at', app.submitted_at); end if;
  return json_build_object('approved', v_has and a.revoked_at is null, 'active', _agent_badge_active(auth.uid()),
    'since', a.approved_at, 'valid_until', a.valid_until, 'revoked', v_has and a.revoked_at is not null, 'revoked_note', a.revoked_note,
    'chs_agent_id', p.chs_agent_id, 'eligibility', agent_badge_eligibility(auth.uid()), 'application', v_app,
    'terms_version', (select value from platform_settings where key = 'agent_badge_terms_version'));
end $$;

create or replace function public.admin_list_agent_badge_applications() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(is_admin(), false) then raise exception 'admin_only'; end if;
  return json_build_object(
    'pending', coalesce((select json_agg(x order by x.submitted_at) from (
        select ap.id, ap.agent_id, p.full_name as agent_name, p.chs_agent_id, ap.reg_body, ap.reg_number, ap.entity_name, ap.registered_on, ap.reg_expiry,
               ap.certificate_url, ap.office_address, ap.principals, ap.submitted_at, agent_badge_eligibility(ap.agent_id) as eligibility,
               p.id_document_url, p.valid_id_document_url, p.reference_1, p.reference_2, p.residential_address
        from agent_badge_applications ap join profiles p on p.id = ap.agent_id where ap.status = 'pending') x), '[]'::json),
    'approved', coalesce((select json_agg(y order by y.entity_name) from (
        select a.agent_id, p.full_name as agent_name, p.chs_agent_id, a.entity_name, a.reg_body, a.reg_number, a.valid_until, a.reg_expiry, a.revoked_at, a.revoked_note,
               _agent_badge_active(a.agent_id) as active
        from agent_approvals a join profiles p on p.id = a.agent_id) y), '[]'::json),
    'recent', coalesce((select json_agg(z order by z.decided_at desc) from (
        select ap.id, ap.entity_name, ap.status, ap.decision_note, ap.decided_at from agent_badge_applications ap where ap.status in ('rejected','approved') order by ap.decided_at desc limit 20) z), '[]'::json));
end $$;

-- daily: warn agents before the badge, registration or KYC lapses; tell admins when a badge has lapsed
create or replace function public.chs_agent_badge_monitor() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_kyc_max int := _setting_num('agent_badge_kyc_max_age_days', 365)::int;
begin
  for r in select a.*, p.full_name, p.chs_agent_id, p.verified_at from agent_approvals a join profiles p on p.id = a.agent_id where a.revoked_at is null loop
    if r.valid_until < now() then
      if r.lapsed_notified_at is null then
        perform notify_user(r.agent_id, 'Your CHS-approved agent badge has lapsed', 'It was valid until ' || to_char(r.valid_until, 'DD Mon YYYY') || '. Apply again to renew it.', '/agent');
        perform notify_admins_by_domain('owner_buyer_tenant', 'Agent badge lapsed', coalesce(r.entity_name, r.full_name) || ' (' || coalesce(r.chs_agent_id, '') || ') badge lapsed.', '/admin?tab=chsstamp');
        update agent_approvals set lapsed_notified_at = now() where agent_id = r.agent_id; n := n + 1;
      end if;
    elsif (r.valid_until < now() + interval '30 days' or (r.reg_expiry is not null and r.reg_expiry < current_date + 30) or r.verified_at < now() - make_interval(days => v_kyc_max - 30))
          and (r.expiry_notified_at is null or r.expiry_notified_at < now() - interval '25 days') then
      perform notify_user(r.agent_id, 'Your CHS-approved agent badge needs renewing soon', 'Within 30 days your badge, your registration or your KYC will expire. Renew them to keep the badge.', '/agent');
      update agent_approvals set expiry_notified_at = now() where agent_id = r.agent_id; n := n + 1;
    end if;
  end loop;
  return n;
end $$;
select cron.schedule('chs-agent-badge-monitor', '40 7 * * *', 'select public.chs_agent_badge_monitor()');

do $$
declare f text;
begin
  foreach f in array array['_setting_num(text,numeric)','_agent_income_deals(uuid)','agent_badge_eligibility(uuid)','_agent_badge_active(uuid)','get_agent_badge(uuid)',
    'submit_agent_badge_application(text,text,text,date,date,text,text,jsonb,text)','withdraw_agent_badge_application()','admin_decide_agent_badge(uuid,boolean,jsonb,text)',
    'admin_set_agent_approval(uuid,boolean,text)','get_my_agent_approval()','admin_list_agent_badge_applications()','chs_agent_badge_monitor()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  grant execute on function public.get_agent_badge(uuid) to anon, authenticated;
  grant execute on function public.submit_agent_badge_application(text,text,text,date,date,text,text,jsonb,text) to authenticated;
  grant execute on function public.withdraw_agent_badge_application() to authenticated;
  grant execute on function public.admin_decide_agent_badge(uuid,boolean,jsonb,text) to authenticated;
  grant execute on function public.admin_set_agent_approval(uuid,boolean,text) to authenticated;
  grant execute on function public.get_my_agent_approval() to authenticated;
  grant execute on function public.admin_list_agent_badge_applications() to authenticated;
end $$;
