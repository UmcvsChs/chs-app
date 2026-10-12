-- 483: "CHS-approved agent" badge. A CHS admin approves an agent; the badge is drawn from this table only, so an agent
-- cannot give it to themselves. The badge shows only while the agent is still approved, verified and in good standing.

create table if not exists public.agent_approvals (
  agent_id uuid primary key references public.profiles(id) on delete cascade,
  approved_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id),
  note text,
  revoked_at timestamptz,
  revoked_note text
);
alter table public.agent_approvals enable row level security;
revoke all on public.agent_approvals from anon, authenticated;

-- true only while approved, not revoked, and the agent is still approved + identity verified
create or replace function public._agent_badge_active(p_agent uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from agent_approvals a join profiles p on p.id = a.agent_id
    where a.agent_id = p_agent and a.revoked_at is null
      and (p.role = 'agent' or 'agent' = any(coalesce(p.secondary_roles, '{}')))
      and p.status = 'approved' and p.verification_status = 'verified' and p.suspended_at is null);
$$;

create or replace function public.get_agent_badge(p_agent uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare p profiles%rowtype; a agent_approvals%rowtype;
begin
  if p_agent is null or not _agent_badge_active(p_agent) then return json_build_object('approved', false); end if;
  select * into p from profiles where id = p_agent;
  select * into a from agent_approvals where agent_id = p_agent;
  return json_build_object('approved', true, 'chs_agent_id', p.chs_agent_id,
    'name', split_part(coalesce(p.full_name, ''), ' ', 1) || ' ' || left(coalesce(nullif(split_part(coalesce(p.full_name, ''), ' ', 2), ''), ''), 1),
    'since', a.approved_at, 'deals', coalesce(p.deals_completed, 0));
end $$;

create or replace function public.verify_chs_agent(p_chs_agent_id text) returns json
language plpgsql stable security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from profiles where upper(chs_agent_id) = upper(trim(p_chs_agent_id)) and (role = 'agent' or 'agent' = any(coalesce(secondary_roles, '{}')));
  if v_id is null then return json_build_object('found', false); end if;
  return (json_build_object('found', true)::jsonb || (get_agent_badge(v_id))::jsonb)::json;
end $$;

create or replace function public.get_my_agent_approval() returns json
language plpgsql stable security definer set search_path = public as $$
declare a agent_approvals%rowtype; p profiles%rowtype; v_has boolean;
begin
  select * into p from profiles where id = auth.uid();
  select * into a from agent_approvals where agent_id = auth.uid();
  v_has := found;
  return json_build_object('approved', v_has and a.revoked_at is null, 'active', _agent_badge_active(auth.uid()),
    'since', a.approved_at, 'revoked', v_has and a.revoked_at is not null, 'verified', p.verification_status = 'verified',
    'profile_status', p.status, 'chs_agent_id', p.chs_agent_id);
end $$;

create or replace function public.admin_set_agent_approval(p_agent uuid, p_approve boolean, p_note text default null) returns json
language plpgsql security definer set search_path = public as $$
declare p profiles%rowtype;
begin
  if not coalesce(is_admin(), false) then raise exception 'admin_only'; end if;
  select * into p from profiles where id = p_agent;
  if not found or not (p.role = 'agent' or 'agent' = any(coalesce(p.secondary_roles, '{}'))) then raise exception 'This person is not a registered agent.'; end if;
  if p_approve then
    if p.status <> 'approved' then raise exception 'The agent''s registration is not approved yet.'; end if;
    if p.verification_status <> 'verified' then raise exception 'The agent''s identity is not verified yet.'; end if;
    if p.suspended_at is not null then raise exception 'The agent is suspended.'; end if;
    if p.chs_agent_id is null then raise exception 'The agent has no CHS agent ID yet.'; end if;
    insert into agent_approvals(agent_id, approved_by, note) values (p_agent, auth.uid(), p_note)
    on conflict (agent_id) do update set approved_at = now(), approved_by = auth.uid(), note = p_note, revoked_at = null, revoked_note = null;
    perform notify_user(p_agent, '✓ You are now a CHS-approved agent', 'Your listings now show the CHS-approved agent badge with your CHS agent ID ' || p.chs_agent_id || '. Anyone can check it on CHS.', '/agent');
  else
    if coalesce(trim(p_note), '') = '' then raise exception 'Please give a reason for removing the badge.'; end if;
    update agent_approvals set revoked_at = now(), revoked_note = p_note where agent_id = p_agent;
    if not found then raise exception 'This agent was never approved.'; end if;
    perform notify_user(p_agent, 'Your CHS-approved agent badge was removed', 'Reason: ' || p_note, '/agent');
  end if;
  perform log_audit_event('agent_approval_set', 'profiles', p_agent, p.full_name, jsonb_build_object('approve', p_approve, 'note', p_note));
  return json_build_object('agent', p_agent, 'approved', p_approve);
end $$;

create or replace function public.admin_list_agents_for_approval(p_search text default null) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(is_admin(), false) then raise exception 'admin_only'; end if;
  return coalesce((select json_agg(x order by x.approved desc, x.name) from (
    select p.id, p.full_name as name, p.chs_agent_id, p.status, p.verification_status, p.deals_completed, p.trust_score, p.agent_tier, p.created_at,
           (a.agent_id is not null and a.revoked_at is null) as approved, a.approved_at, a.revoked_at, a.revoked_note,
           (p.status = 'approved' and p.verification_status = 'verified' and p.suspended_at is null and p.chs_agent_id is not null) as eligible
    from profiles p left join agent_approvals a on a.agent_id = p.id
    where (p.role = 'agent' or 'agent' = any(coalesce(p.secondary_roles, '{}')))
      and (p_search is null or p_search = '' or p.full_name ilike '%' || p_search || '%' or p.chs_agent_id ilike '%' || p_search || '%')
    limit 100) x), '[]'::json);
end $$;

do $$
declare f text;
begin
  foreach f in array array['_agent_badge_active(uuid)','get_agent_badge(uuid)','verify_chs_agent(text)','get_my_agent_approval()','admin_set_agent_approval(uuid,boolean,text)','admin_list_agents_for_approval(text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  grant execute on function public.get_agent_badge(uuid) to anon, authenticated;
  grant execute on function public.verify_chs_agent(text) to anon, authenticated;
  grant execute on function public.get_my_agent_approval() to authenticated;
  grant execute on function public.admin_set_agent_approval(uuid,boolean,text) to authenticated;
  grant execute on function public.admin_list_agents_for_approval(text) to authenticated;
end $$;
