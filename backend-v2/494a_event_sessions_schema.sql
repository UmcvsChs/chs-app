-- 494a EVENT CENTRE: HOURLY SESSIONS AND MULTI-DAY BOOKINGS - schema, guards, calendar triggers (Oct 13 2026)
-- A venue is no longer locked for a whole day by one booking. An event booking is now one or more SESSIONS (a date plus a start
-- and end time). Two events can share a day when they do not overlap and the venue's set-up / clean-up time fits between them.
-- Whole-day bookings (unit_calendar) and hotel / shortlet bookings keep working exactly as before; a session conflicts with a
-- whole-day row and the other way round, so the two worlds can never double-book the same hall.

alter table public.shortlet_bookings add column if not exists time_slots boolean not null default false;
alter table public.event_capacity_tiers add column if not exists hourly_price numeric check (hourly_price is null or hourly_price >= 0);

create table if not exists public.property_event_settings (
  property_id uuid primary key references public.properties(id) on delete cascade,
  allow_hourly boolean not null default true,
  min_hours numeric not null default 2 check (min_hours > 0 and min_hours <= 24),
  open_min integer not null default 360 check (open_min between 0 and 1439),
  close_min integer not null default 1440 check (close_min between 60 and 1440),
  setup_min integer not null default 30 check (setup_min between 0 and 480),
  cleanup_min integer not null default 30 check (cleanup_min between 0 and 480),
  full_day_hours numeric not null default 10 check (full_day_hours between 1 and 24),
  max_sessions integer not null default 10 check (max_sessions between 1 and 30),
  updated_at timestamptz not null default now(),
  check (close_min > open_min)
);
alter table public.property_event_settings enable row level security;
revoke all on public.property_event_settings from anon, authenticated;

create table if not exists public.event_slots (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.shortlet_bookings(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_id uuid not null references public.property_units(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  label text,
  state text not null check (state in ('held', 'confirmed', 'blocked')),
  expires_at timestamptz,
  setup_min integer not null default 0,
  cleanup_min integer not null default 0,
  fee numeric not null default 0,
  block_range tstzrange,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (state <> 'held' or expires_at is not null),
  constraint event_slots_no_overlap exclude using gist (unit_id with =, block_range with &&) deferrable initially immediate
);
alter table public.event_slots enable row level security;
revoke all on public.event_slots from anon, authenticated;
create index if not exists event_slots_booking on public.event_slots (booking_id);
create index if not exists event_slots_property_time on public.event_slots (property_id, starts_at);

create or replace function public._lagos_date(p timestamptz) returns date language sql immutable as $$ select (p at time zone 'Africa/Lagos')::date $$;

-- the blocked range is the session plus the venue's set-up before and clean-up after
create or replace function public.trg_event_slot_range() returns trigger language plpgsql as $$
begin
  new.block_range := tstzrange(new.starts_at - make_interval(mins => new.setup_min), new.ends_at + make_interval(mins => new.cleanup_min), '[)');
  return new;
end $$;
create or replace trigger trg_event_slot_range before insert or update on public.event_slots for each row execute function public.trg_event_slot_range();

-- a session may not sit on a day that a whole-day row already holds
create or replace function public.trg_event_slot_vs_calendar() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (
    select 1 from public.unit_calendar c
    where c.unit_id = new.unit_id
      and not (c.booking_id is not null and c.booking_id = new.booking_id)
      and not (c.state = 'held' and c.expires_at < now())
      and daterange(c.start_date, c.end_date, '[)') && daterange(public._lagos_date(new.starts_at), public._lagos_date(new.ends_at - interval '1 second') + 1, '[)')
  ) then
    raise exception 'event_slot_vs_calendar' using errcode = '23P01';
  end if;
  return new;
end $$;
create or replace trigger trg_event_slot_vs_calendar before insert or update of starts_at, ends_at, unit_id on public.event_slots for each row execute function public.trg_event_slot_vs_calendar();

-- and a whole-day row may not cover a day that already has a session
create or replace function public.trg_calendar_vs_event_slot() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (
    select 1 from public.event_slots s
    where s.unit_id = new.unit_id
      and not (s.booking_id is not null and s.booking_id = new.booking_id)
      and not (s.state = 'held' and s.expires_at < now())
      and daterange(public._lagos_date(s.starts_at), public._lagos_date(s.ends_at - interval '1 second') + 1, '[)') && daterange(new.start_date, new.end_date, '[)')
  ) then
    raise exception 'calendar_vs_event_slot' using errcode = '23P01';
  end if;
  return new;
end $$;
create or replace trigger trg_calendar_vs_event_slot before insert or update of start_date, end_date, unit_id on public.unit_calendar for each row execute function public.trg_calendar_vs_event_slot();

-- time-slot bookings keep their holds in event_slots; everything else is untouched
create or replace function public.trg_booking_after_insert()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_cand record; v_taken uuid; v_state text; v_expires timestamptz;
begin
  if new.status not in ('awaiting_admin_relay', 'pending_host_review', 'awaiting_payment', 'confirmed') then return null; end if;
  if new.time_slots then return null; end if;

  perform purge_expired_holds(new.property_id);
  perform ensure_default_unit(new.property_id);

  v_state := case when new.status = 'confirmed' then 'confirmed' else 'held' end;
  v_expires := coalesce(new.hold_expires_at, now() + make_interval(hours => booking_setting_int('shortlet_host_response_hours', 24)));

  for v_cand in
    select id from property_units
    where property_id = new.property_id and active
      and (new.unit_id is null or id = new.unit_id)
      and (new.room_type_id is null or room_type_id = new.room_type_id)
    order by label
  loop
    begin
      insert into unit_calendar (unit_id, property_id, start_date, end_date, state, booking_id, expires_at, created_by)
      values (v_cand.id, new.property_id, new.check_in, new.check_out, v_state, new.id,
              case when v_state = 'held' then v_expires end, new.guest_id);
      v_taken := v_cand.id;
      exit;
    exception when exclusion_violation then
      null;
    end;
  end loop;

  if v_taken is null then
    raise exception 'dates_unavailable: Those dates are no longer available. Please check the calendar and choose different dates — you have not been charged.';
  end if;

  if new.unit_id is distinct from v_taken then
    update shortlet_bookings set unit_id = v_taken where id = new.id;
  end if;
  return null;
end;
$function$;

create or replace function public.trg_booking_after_update()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_cand record; v_taken uuid;
begin
  -- dead ends free the dates
  if new.status in ('declined', 'cancelled', 'expired') then
    if old.status is distinct from new.status then
      execute format('%s from unit_calendar where booking_id = $1', chr(100) || 'elete') using new.id;
      if new.time_slots then execute format('%s from event_slots where booking_id = $1', chr(100) || 'elete') using new.id; end if;
    end if;
    return null;
  end if;

  -- sessions: paid and confirmed, or the hold follows the stage deadline
  if new.time_slots then
    if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
      update event_slots set state = 'confirmed', expires_at = null where booking_id = new.id;
    elsif new.status in ('awaiting_admin_relay', 'pending_host_review', 'awaiting_payment')
       and new.hold_expires_at is not null and new.hold_expires_at is distinct from old.hold_expires_at then
      update event_slots set expires_at = new.hold_expires_at where booking_id = new.id and state = 'held';
    end if;
    return null;
  end if;

  -- paid and confirmed
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    update unit_calendar set state = 'confirmed', expires_at = null where booking_id = new.id;
    if not found then
      for v_cand in
        select id from property_units
        where property_id = new.property_id and active and (new.unit_id is null or id = new.unit_id)
        order by label
      loop
        begin
          insert into unit_calendar (unit_id, property_id, start_date, end_date, state, booking_id, created_by)
          values (v_cand.id, new.property_id, new.check_in, new.check_out, 'confirmed', new.id, new.guest_id);
          v_taken := v_cand.id;
          exit;
        exception when exclusion_violation then
          null;
        end;
      end loop;
      if v_taken is null then
        raise exception 'dates_unavailable: Those dates have just been taken by another booking, so this request cannot be confirmed.';
      end if;
    end if;
    return null;
  end if;

  -- still in flight: the hold follows the current stage's deadline
  if new.status in ('awaiting_admin_relay', 'pending_host_review', 'awaiting_payment')
     and new.hold_expires_at is not null
     and new.hold_expires_at is distinct from old.hold_expires_at then
    update unit_calendar set expires_at = new.hold_expires_at where booking_id = new.id and state = 'held';
  end if;
  return null;
end;
$function$;

create or replace function public.purge_expired_holds(p_property_id uuid default null)
 returns integer language plpgsql security definer set search_path to 'public' as $function$
declare r record; n int := 0;
begin
  for r in
    select distinct booking_id from (
      select booking_id from unit_calendar
        where state = 'held' and expires_at < now() and booking_id is not null and (p_property_id is null or property_id = p_property_id)
      union
      select booking_id from event_slots
        where state = 'held' and expires_at < now() and booking_id is not null and (p_property_id is null or property_id = p_property_id)
    ) x
  loop
    perform settle_expired_booking(r.booking_id);
    n := n + 1;
  end loop;
  execute format('%s from unit_calendar where state = ''held'' and expires_at < now() and ($1 is null or property_id = $1)', chr(100) || 'elete') using p_property_id;
  execute format('%s from event_slots where state = ''held'' and expires_at < now() and ($1 is null or property_id = $1)', chr(100) || 'elete') using p_property_id;
  return n;
end;
$function$;
