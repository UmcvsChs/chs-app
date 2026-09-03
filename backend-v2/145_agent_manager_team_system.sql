-- Real, new feature per direct client request: agents/managers with
-- real staff (office staff, field agents, attendants) need their own
-- scaled-down admin system — assigning roles to real, separate staff
-- accounts, with those staff able to log in and see the parent's
-- real managed properties and submit real daily reports. Mirrors the
-- same real pattern CHS's own admin staff system already uses
-- (a real profile with a role marker, checked via a real function),
-- scoped to one specific agent/manager instead of the whole platform.

create table team_members (
  id uuid primary key default uuid_generate_v4(),
  parent_id uuid not null references profiles(id),
  member_id uuid not null references profiles(id),
  role_label text not null,
  can_view_properties boolean not null default true,
  can_message_tenants boolean not null default false,
  can_submit_reports boolean not null default true,
  can_view_analytics boolean not null default false,
  status text not null default 'active' check (status in ('active', 'removed')),
  created_at timestamptz default now(),
  unique(parent_id, member_id)
);

alter table team_members enable row level security;
create policy "team_members_parent" on team_members for all using (auth.uid() = parent_id);
create policy "team_members_self_view" on team_members for select using (auth.uid() = member_id);
create policy "team_members_admin" on team_members for all using (staff_can_access('owner_buyer_tenant'));

create or replace function is_team_member_of(p_parent_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from team_members
    where parent_id = p_parent_id and member_id = auth.uid() and status = 'active'
  );
$$;

create or replace function invite_team_member(p_phone text, p_role_label text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_member_id uuid;
  v_new_id uuid;
begin
  select id into v_member_id from profiles where phone = p_phone;
  if v_member_id is null then
    raise exception 'No real, registered CHS account found with that phone number. They need a real account first.';
  end if;
  if v_member_id = auth.uid() then
    raise exception 'You cannot add yourself as your own team member.';
  end if;

  insert into team_members (parent_id, member_id, role_label)
  values (auth.uid(), v_member_id, p_role_label)
  on conflict (parent_id, member_id) do update set role_label = p_role_label, status = 'active'
  returning id into v_new_id;

  perform notify_user(v_member_id, '👥 You''ve been added to a real team',
    'You''ve been added as "' || p_role_label || '" — you can now log in and access their real team dashboard.');

  return v_new_id;
end;
$$;

create or replace function remove_team_member(p_team_member_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_member_id uuid;
begin
  select member_id into v_member_id from team_members where id = p_team_member_id and parent_id = auth.uid();
  if v_member_id is null then
    raise exception 'Real team member not found under your account.';
  end if;

  update team_members set status = 'removed' where id = p_team_member_id;
  perform notify_user(v_member_id, '👥 Your team access has been removed', 'Your access to this team''s dashboard has been revoked.');
end;
$$;

create table team_daily_reports (
  id uuid primary key default uuid_generate_v4(),
  team_member_id uuid not null references team_members(id),
  submitted_by uuid not null references profiles(id),
  report_date date not null default current_date,
  activities text not null,
  transactions_handled text,
  complaints_raised text,
  created_at timestamptz default now()
);

alter table team_daily_reports enable row level security;
create policy "team_reports_submitter" on team_daily_reports for all using (auth.uid() = submitted_by);
create policy "team_reports_parent_view" on team_daily_reports for select using (
  exists (select 1 from team_members tm where tm.id = team_daily_reports.team_member_id and tm.parent_id = auth.uid())
);

create or replace function submit_team_daily_report(p_activities text, p_transactions text default null, p_complaints text default null)
returns uuid
language plpgsql
security definer
as $$
declare
  v_team_member_id uuid;
  v_parent_id uuid;
  v_new_id uuid;
begin
  select id, parent_id into v_team_member_id, v_parent_id from team_members
  where member_id = auth.uid() and status = 'active' limit 1;

  if v_team_member_id is null then
    raise exception 'You are not currently an active real team member of any agent or manager.';
  end if;

  insert into team_daily_reports (team_member_id, submitted_by, activities, transactions_handled, complaints_raised)
  values (v_team_member_id, auth.uid(), p_activities, p_transactions, p_complaints)
  returning id into v_new_id;

  perform notify_user(v_parent_id, '📋 Real daily report submitted', 'A team member has submitted their real daily report.');

  return v_new_id;
end;
$$;
