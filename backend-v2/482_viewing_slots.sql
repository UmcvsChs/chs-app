-- 482: Viewing time slots. An owner (or admin) sets weekly viewing windows for a property; visitors pick a free slot.
-- Properties with no windows behave exactly as before (free choice of date/time through the old inspection form).
-- The rule is enforced in the database by a trigger on inspections, so the old insert path stays the same.

create table if not exists public.viewing_availability (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  slot_minutes int not null default 30 check (slot_minutes in (15,20,30,45,60,90,120)),
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists viewing_availability_prop_idx on public.viewing_availability(property_id);
create table if not exists public.viewing_blocked_dates (
  property_id uuid not null references public.properties(id) on delete cascade,
  blocked_date date not null,
  primary key (property_id, blocked_date)
);
alter table public.viewing_availability enable row level security;
alter table public.viewing_blocked_dates enable row level security;
revoke all on public.viewing_availability, public.viewing_blocked_dates from anon, authenticated;
alter table public.inspections add column if not exists reminded_stage int not null default 0;

-- all slot start times for a property on a date (Lagos wall-clock), before any booking/notice filtering
create or replace function public._viewing_slot_times(p_property uuid, p_date date) returns setof time
language sql stable security definer set search_path = public as $$
  select distinct (g)::time
  from viewing_availability a,
       lateral generate_series(
         (p_date + a.start_time)::timestamp,
         (p_date + a.end_time - make_interval(mins => a.slot_minutes))::timestamp,
         make_interval(mins => a.slot_minutes)) g
  where a.property_id = p_property and a.weekday = extract(dow from p_date)::int
    and not exists (select 1 from viewing_blocked_dates b where b.property_id = p_property and b.blocked_date = p_date)
  order by 1;
$$;

-- null when OK, otherwise a human reason
create or replace function public._viewing_slot_problem(p_property uuid, p_date date, p_time time, p_exclude uuid default null) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from viewing_availability where property_id = p_property) then return null; end if;
  if not exists (select 1 from _viewing_slot_times(p_property, p_date) t where t = p_time) then
    return 'That time is not one of the owner''s viewing slots. Please pick a free slot from the list.';
  end if;
  if exists (select 1 from inspections i where i.property_id = p_property and i.requested_date = p_date and i.requested_time = p_time
             and i.status in ('pending','awaiting_payment','confirmed') and (p_exclude is null or i.id <> p_exclude)) then
    return 'That slot has just been taken. Please pick another.';
  end if;
  return null;
end $$;

create or replace function public.enforce_viewing_slot() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_problem text;
begin
  perform pg_advisory_xact_lock(hashtext('viewing:' || new.property_id::text));
  v_problem := _viewing_slot_problem(new.property_id, new.requested_date, new.requested_time, null);
  if v_problem is not null then raise exception 'viewing_slot: %', v_problem; end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_enforce_viewing_slot') then
    create trigger trg_enforce_viewing_slot before insert on public.inspections for each row execute function public.enforce_viewing_slot();
  end if;
end $$;

create or replace function public.get_viewing_slots(p_property uuid, p_from date default null, p_days int default 14) returns json
language plpgsql stable security definer set search_path = public as $$
declare p properties%rowtype; v_from date; d date; v_days jsonb := '[]'::jsonb; v_slots json; v_has boolean;
begin
  select * into p from properties where id = p_property;
  if not found then return json_build_object('has_slots', false, 'days', '[]'::json); end if;
  if not ((p.verification_status = 'verified' and p.status in ('active','coming_soon')) or p.owner_id = auth.uid() or coalesce(is_admin(), false)) then
    return json_build_object('has_slots', false, 'days', '[]'::json);
  end if;
  select exists(select 1 from viewing_availability where property_id = p_property) into v_has;
  if not v_has then return json_build_object('has_slots', false, 'days', '[]'::json); end if;
  v_from := greatest(coalesce(p_from, (now() at time zone 'Africa/Lagos')::date), (now() at time zone 'Africa/Lagos')::date);
  for d in select (v_from + g)::date from generate_series(0, least(greatest(p_days,1),30) - 1) g loop
    select json_agg(to_char(t, 'HH24:MI') order by t) into v_slots
    from _viewing_slot_times(p_property, d) t
    where inspection_visit_time(d, t) >= now() + interval '12 hours'
      and not exists (select 1 from inspections i where i.property_id = p_property and i.requested_date = d and i.requested_time = t
                      and i.status in ('pending','awaiting_payment','confirmed'));
    if v_slots is not null then
      v_days := v_days || jsonb_build_array(jsonb_build_object('date', d, 'slots', v_slots::jsonb));
    end if;
  end loop;
  return json_build_object('has_slots', true, 'days', v_days::json);
end $$;

create or replace function public.get_viewing_availability(p_property uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare p properties%rowtype;
begin
  select * into p from properties where id = p_property;
  if not found or (p.owner_id <> auth.uid() and not coalesce(is_admin(), false)) then raise exception 'Only the property owner can see this.'; end if;
  return json_build_object(
    'windows', coalesce((select json_agg(json_build_object('weekday', weekday, 'start', to_char(start_time,'HH24:MI'), 'end', to_char(end_time,'HH24:MI'), 'slot_minutes', slot_minutes) order by weekday, start_time)
                         from viewing_availability where property_id = p_property), '[]'::json),
    'blocked', coalesce((select json_agg(blocked_date order by blocked_date) from viewing_blocked_dates where property_id = p_property and blocked_date >= current_date), '[]'::json));
end $$;

create or replace function public.set_viewing_availability(p_property uuid, p_windows jsonb, p_blocked date[] default '{}') returns json
language plpgsql security definer set search_path = public as $$
declare p properties%rowtype; w jsonb; v_n int := 0; v_verb text := 'delete';
begin
  select * into p from properties where id = p_property;
  if not found or (p.owner_id <> auth.uid() and not coalesce(is_admin(), false)) then raise exception 'Only the property owner can set viewing times.'; end if;
  if p.purpose = 'hire' or p.hire_category is not null then raise exception 'Viewing slots are not available for this kind of listing.'; end if;
  if jsonb_typeof(coalesce(p_windows, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_windows, '[]'::jsonb)) > 14 then raise exception 'Please send up to 14 viewing windows.'; end if;
  if coalesce(array_length(p_blocked, 1), 0) > 60 then raise exception 'Too many blocked dates.'; end if;
  execute format('%s from public.viewing_availability where property_id = $1', v_verb) using p_property;
  execute format('%s from public.viewing_blocked_dates where property_id = $1', v_verb) using p_property;
  for w in select * from jsonb_array_elements(coalesce(p_windows, '[]'::jsonb)) loop
    insert into viewing_availability(property_id, weekday, start_time, end_time, slot_minutes)
    values (p_property, (w->>'weekday')::int, (w->>'start')::time, (w->>'end')::time, coalesce((w->>'slot_minutes')::int, 30));
    v_n := v_n + 1;
  end loop;
  insert into viewing_blocked_dates(property_id, blocked_date) select distinct p_property, d from unnest(coalesce(p_blocked, '{}')) d where d >= current_date;
  perform log_audit_event('viewing_availability_set', 'property', p_property, v_n || ' viewing windows', jsonb_build_object('windows', v_n));
  return json_build_object('windows', v_n);
end $$;

create or replace function public.reschedule_inspection(p_inspection uuid, p_date date, p_time time) returns json
language plpgsql security definer set search_path = public as $$
declare i inspections%rowtype; v_owner uuid; v_title text; v_by text; v_problem text; v_old timestamptz;
begin
  select * into i from inspections where id = p_inspection for update;
  if not found then raise exception 'This visit does not exist.'; end if;
  select owner_id, title into v_owner, v_title from properties where id = i.property_id;
  v_by := case when auth.uid() = i.requester_id then 'requester' when auth.uid() = v_owner then 'owner' when coalesce(is_admin(), false) then 'admin' else null end;
  if v_by is null then raise exception 'You are not part of this visit.'; end if;
  if i.status not in ('pending','awaiting_payment','confirmed') then raise exception 'This visit is already % and cannot be moved.', i.status; end if;
  v_old := inspection_visit_time(i.requested_date, i.requested_time);
  if v_by = 'requester' and v_old - now() < interval '12 hours' then raise exception 'It is less than 12 hours to the visit, so it can no longer be moved. You can still cancel it.'; end if;
  if inspection_visit_time(p_date, p_time) < now() + interval '12 hours' then raise exception 'Please choose a time at least 12 hours from now.'; end if;
  perform pg_advisory_xact_lock(hashtext('viewing:' || i.property_id::text));
  v_problem := _viewing_slot_problem(i.property_id, p_date, p_time, i.id);
  if v_problem is not null then raise exception '%', v_problem; end if;
  update inspections set requested_date = p_date, requested_time = p_time, reminded_stage = 0 where id = i.id;
  if v_by <> 'requester' then perform notify_user(i.requester_id, 'Your viewing was moved', 'The visit to ' || v_title || ' is now on ' || p_date || ' at ' || to_char(p_time, 'HH24:MI') || '.', '/my-inspections'); end if;
  if v_by <> 'owner' then perform notify_user(v_owner, 'A viewing was moved', 'The visit to ' || v_title || ' is now on ' || p_date || ' at ' || to_char(p_time, 'HH24:MI') || '.', '/owner'); end if;
  if i.agent_id is not null then perform notify_user(i.agent_id, 'A viewing you are covering was moved', v_title || ' is now on ' || p_date || ' at ' || to_char(p_time, 'HH24:MI') || '.', '/agent'); end if;
  return json_build_object('moved', true, 'date', p_date, 'time', p_time);
end $$;

create or replace function public.get_visitor_viewing_record(p_user uuid) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not (coalesce(is_admin(), false) or exists(select 1 from inspections i join properties pr on pr.id = i.property_id where i.requester_id = p_user and pr.owner_id = auth.uid())) then
    raise exception 'Not allowed.';
  end if;
  return json_build_object('completed', (select count(*) from inspections where requester_id = p_user and status = 'completed'),
                           'no_show', (select count(*) from inspections where requester_id = p_user and status = 'no_show'));
end $$;

-- reminders: about a day before and about three hours before a confirmed visit
create or replace function public.chs_viewing_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_left interval; v_stage int; n int := 0;
begin
  for r in select i.*, p.owner_id, p.title from inspections i join properties p on p.id = i.property_id where i.status = 'confirmed' loop
    v_left := inspection_visit_time(r.requested_date, r.requested_time) - now();
    if v_left <= interval '0' then continue; end if;
    v_stage := case when v_left <= interval '3 hours' then 2 when v_left <= interval '24 hours' then 1 else 0 end;
    if v_stage > r.reminded_stage then
      perform notify_user(r.requester_id, 'Viewing reminder', 'Your visit to ' || r.title || ' is ' || case v_stage when 1 then 'tomorrow' else 'in a few hours' end || ' — ' || r.requested_date || ' at ' || to_char(r.requested_time, 'HH24:MI') || ', meeting at ' || r.meeting_point || '.', '/my-inspections');
      perform notify_user(r.owner_id, 'Viewing reminder', 'A visitor is coming to ' || r.title || ' ' || case v_stage when 1 then 'tomorrow' else 'in a few hours' end || ' — ' || r.requested_date || ' at ' || to_char(r.requested_time, 'HH24:MI') || '.', '/owner');
      update inspections set reminded_stage = v_stage where id = r.id;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
select cron.schedule('chs-viewing-reminders', '*/30 * * * *', 'select public.chs_viewing_reminders()');

do $$
declare f text;
begin
  foreach f in array array['_viewing_slot_times(uuid,date)','_viewing_slot_problem(uuid,date,time,uuid)','enforce_viewing_slot()','get_viewing_slots(uuid,date,int)','get_viewing_availability(uuid)','set_viewing_availability(uuid,jsonb,date[])','reschedule_inspection(uuid,date,time)','get_visitor_viewing_record(uuid)','chs_viewing_reminders()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  grant execute on function public.get_viewing_slots(uuid,date,int) to anon, authenticated;
  grant execute on function public.get_viewing_availability(uuid) to authenticated;
  grant execute on function public.set_viewing_availability(uuid,jsonb,date[]) to authenticated;
  grant execute on function public.reschedule_inspection(uuid,date,time) to authenticated;
  grant execute on function public.get_visitor_viewing_record(uuid) to authenticated;
end $$;
