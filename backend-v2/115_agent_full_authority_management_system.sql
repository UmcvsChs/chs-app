-- Real, new feature per direct client design: an owner listing a
-- property can grant an agent full management authority two real
-- ways — entering the agent's real CHS ID directly, or generating a
-- real invite link for an agent who hasn't registered yet. Once
-- linked, every real tool already built for owners (messaging,
-- notices, maintenance, earnings) works identically for that agent,
-- since the underlying manager_id relationship is already
-- role-agnostic — confirmed by checking directly before building.

alter table profiles add column if not exists chs_agent_id text unique;

create or replace function generate_chs_agent_id()
returns text
language plpgsql
as $$
declare
  v_id text;
  v_exists boolean;
begin
  loop
    v_id := 'CHS-AGT-' || lpad(floor(random() * 100000)::text, 5, '0');
    select exists(select 1 from profiles where chs_agent_id = v_id) into v_exists;
    exit when not v_exists;
  end loop;
  return v_id;
end;
$$;

create or replace function assign_chs_agent_id()
returns trigger
language plpgsql
as $$
begin
  if new.role = 'agent' and new.chs_agent_id is null then
    new.chs_agent_id := generate_chs_agent_id();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_chs_agent_id on profiles;
create trigger trg_assign_chs_agent_id
  before insert or update on profiles
  for each row execute function assign_chs_agent_id();

update profiles set chs_agent_id = generate_chs_agent_id() where role = 'agent' and chs_agent_id is null;

alter table properties add column if not exists managing_agent_id uuid references profiles(id);
alter table properties add column if not exists agent_invite_token text unique;

create or replace function link_managing_agent_by_id(p_property_id uuid, p_chs_agent_id text)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_agent_id uuid;
begin
  select owner_id into v_owner_id from properties where id = p_property_id;
  if v_owner_id != auth.uid() then
    raise exception 'Only the real property owner can link a managing agent.';
  end if;

  select id into v_agent_id from profiles where chs_agent_id = p_chs_agent_id and role = 'agent';
  if v_agent_id is null then
    raise exception 'No real, registered agent found with that CHS ID. Please double-check the ID with your agent.';
  end if;

  update properties set managing_agent_id = v_agent_id where id = p_property_id;

  perform notify_user(v_agent_id, '🤝 You''ve been granted management authority',
    'A real property owner has named you as the managing agent with full authority for one of their listings.');
end;
$$;

create or replace function generate_agent_invite_link(p_property_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_token text;
begin
  select owner_id into v_owner_id from properties where id = p_property_id;
  if v_owner_id != auth.uid() then
    raise exception 'Only the real property owner can generate this invite.';
  end if;

  v_token := 'INV-' || substr(gen_random_uuid()::text, 1, 12);
  update properties set agent_invite_token = v_token where id = p_property_id;

  return v_token;
end;
$$;

create or replace function link_agent_via_invite(p_agent_id uuid, p_invite_token text)
returns void
language plpgsql
security definer
as $$
declare
  v_property_id uuid;
begin
  select id into v_property_id from properties where agent_invite_token = p_invite_token;
  if v_property_id is null then
    return;
  end if;

  update properties set managing_agent_id = p_agent_id where id = v_property_id;
end;
$$;

create or replace function apply_managing_agent_to_tenancy()
returns trigger
language plpgsql
security definer
as $$
declare
  v_managing_agent_id uuid;
begin
  select managing_agent_id into v_managing_agent_id from properties where id = new.property_id;
  if v_managing_agent_id is not null then
    new.manager_id := v_managing_agent_id;
    new.management_delegated := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_managing_agent on tenancies;
create trigger trg_apply_managing_agent
  before insert on tenancies
  for each row execute function apply_managing_agent_to_tenancy();
