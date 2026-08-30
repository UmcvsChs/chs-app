-- Real, new feature per direct client request: an owner can relieve
-- an agent of management duty at any time. This immediately blocks
-- the old agent's real access (clearing manager_id/management_delegated
-- on every real tenancy tied to the property, not just the property
-- record itself), notifies both the old agent and the current tenant
-- honestly, and — deliberately unlike the original onboarding flow —
-- routes the replacement agent's identity to CHS for real admin
-- review before any new access is granted, since replacing a trusted
-- party is a more sensitive action than the initial appointment.

create table agent_change_requests (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  owner_id uuid not null references profiles(id),
  requested_agent_chs_id text,
  requested_agent_name text,
  requested_agent_phone text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_reviewed_by uuid references profiles(id),
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

alter table agent_change_requests enable row level security;
create policy "agent_change_owner" on agent_change_requests for all using (auth.uid() = owner_id);
create policy "agent_change_admin_all" on agent_change_requests for all using (staff_can_access('owner_buyer_tenant'));

create or replace function revoke_managing_agent(p_property_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_old_agent_id uuid;
  v_tenant_id uuid;
begin
  select owner_id, managing_agent_id into v_owner_id, v_old_agent_id from properties where id = p_property_id;

  if v_owner_id != auth.uid() then
    raise exception 'Only the real property owner can revoke a managing agent.';
  end if;
  if v_old_agent_id is null then
    raise exception 'This property has no real managing agent to revoke.';
  end if;

  update tenancies set manager_id = null, management_delegated = false
  where property_id = p_property_id and manager_id = v_old_agent_id;

  update properties set managing_agent_id = null where id = p_property_id;

  perform notify_user(v_old_agent_id, '⚠️ Management authority revoked',
    'The property owner has relieved you of management duty on this property. Your access to its tenant, notices, and maintenance tools has been removed immediately.');

  select tenant_id into v_tenant_id from tenancies where property_id = p_property_id and status = 'active' limit 1;
  if v_tenant_id is not null then
    perform notify_user(v_tenant_id, 'ℹ️ A change in property management',
      'Your landlord has changed who manages this property on their behalf. You''ll be notified directly once a new arrangement is confirmed — for now, please reach your landlord through CHS as usual.');
  end if;
end;
$$;

create or replace function request_agent_replacement(p_property_id uuid, p_chs_id text, p_name text, p_phone text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_new_id uuid;
begin
  select owner_id into v_owner_id from properties where id = p_property_id;
  if v_owner_id != auth.uid() then
    raise exception 'Only the real property owner can request this.';
  end if;

  insert into agent_change_requests (property_id, owner_id, requested_agent_chs_id, requested_agent_name, requested_agent_phone)
  values (p_property_id, auth.uid(), nullif(p_chs_id, ''), nullif(p_name, ''), nullif(p_phone, ''))
  returning id into v_new_id;

  insert into notifications (user_id, title, body)
  select id, '🤝 Real agent replacement request',
    'A property owner has requested a new managing agent be linked — please review and confirm identity before granting access.'
  from profiles where is_super_admin = true;

  return v_new_id;
end;
$$;
