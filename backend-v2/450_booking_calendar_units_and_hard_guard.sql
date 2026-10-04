-- ============================================================================
-- 450 — STEP 1 of the hotel / lodge / event-centre booking system:
-- rooms, a calendar ledger, a database guard that makes double-booking
-- impossible, and expiring holds.
-- ============================================================================
-- Verified problem (reproduced on real code before building): two guests could
-- both request the same room for overlapping dates; both were charged and told
-- "request sent"; the host then got a raw database error accepting the second;
-- the second guest stayed pending with money held. The only protection was an
-- exclusion constraint on CONFIRMED bookings, firing late.
--
-- This step:
--  * room_types / property_units: a listing (the hotel) has individual rooms
--    underneath, optionally grouped by type. Every existing shortlet/hire
--    listing gets one default unit, so nothing existing changes.
--  * unit_calendar: the single ledger of every taken night per room, in four
--    states (held, confirmed, blocked, walk_in). An EXCLUSION constraint makes
--    two entries for the same room on the same night impossible, whatever
--    code path or timing tries it.
--  * Database triggers keep the ledger in step with bookings, so no booking
--    function needs rewriting and no path can bypass the guard: a request
--    takes a hold BEFORE any money moves (the booking insert fails first, so
--    there is no charge); confirming turns the hold into a confirmation;
--    declining / cancelling / refunding frees the room.
--  * Holds expire (platform_settings.shortlet_host_response_hours, default 24):
--    an unanswered request is declined and refunded in full automatically.
--    Scheduled every 5 minutes by pg_cron job 'chs-expire-booking-holds'
--    (see the end of this file).
--  * get_property_availability(): dates and room counts only — never any
--    guest's details — for the calendar the guest will see.
--  * The old per-PROPERTY confirmed-booking constraint is dropped: with several
--    rooms in one hotel it would wrongly block two guests in different rooms.
--
-- Two real bugs found and fixed on the way:
--  * A host DECLINING a booking refunded price + commission but not the
--    security deposit, and left the deposit marked 'held'. Declines (and
--    expiries) now refund exactly what the guest paid.
--  * host_decide_shortlet_booking never checked the request was still pending,
--    so a host could "confirm" a booking that was already declined/refunded.
--
-- Verified by direct tests against the live schema (all rolled back):
--   * overlapping request, same room -> refused with a friendly message BEFORE
--     any charge (guest balance unchanged)
--   * back-to-back stays (checkout day = next check-in day) accepted
--   * second room added -> overlapping guest placed in Room 2; third overlapping
--     guest refused; direct overlapping write to the ledger refused by the
--     database itself
--   * calendar shows available / requested / booked with room counts and no
--     guest names or booking ids
--   * host confirm -> ledger 'confirmed'; host decline -> dates freed
--   * decline of a booking with a 50,000 deposit -> guest back to exactly their
--     starting balance, deposit marked released; guest cancel 48h+ -> exact
--     refund, dates freed
--   * an expired hold is settled the moment someone else asks for those dates:
--     first guest refunded exactly, second guest accepted; host can no longer
--     "confirm" the refunded request
--   * sweep settles a pending request whose dates have passed, refunding exactly
--     what was debited
--   * event centre: second guest on the same date refused; next day still open
--   * anonymous / unrelated users see 0 raw ledger rows; the venue's host sees
--     his own; internal routines refused to non-admins
--
-- Effect on live data when applied: 46 listings each received one default unit;
-- 3 existing bookings were linked; Danbo's confirmed stay and Philips Edward's
-- pending request were placed on the calendar (Philips' hold runs 24h from
-- the moment of backfill); Femi Sikiru's pending request (18-24 Sept, dates
-- already passed, 22 days unanswered) was settled by the first sweep — declined
-- and refunded in full.
-- ============================================================================

create extension if not exists btree_gist;

-- ------------------------------------------------------------------ tables
create table if not exists room_types (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  description text,
  max_guests int,
  price_per_night numeric,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (property_id, name)
);

create table if not exists property_units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  room_type_id uuid references room_types(id) on delete set null,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (property_id, label)
);
create index if not exists property_units_property_idx on property_units (property_id) where active;

alter table shortlet_bookings add column if not exists unit_id uuid references property_units(id) on delete set null;

create table if not exists unit_calendar (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references property_units(id) on delete cascade,
  property_id uuid not null,
  start_date date not null,
  end_date date not null,
  state text not null check (state in ('held','confirmed','blocked','walk_in')),
  booking_id uuid references shortlet_bookings(id) on delete cascade,
  expires_at timestamptz,
  guest_label text,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint unit_calendar_valid_dates check (end_date > start_date),
  constraint unit_calendar_hold_needs_expiry check (state <> 'held' or expires_at is not null),
  constraint unit_calendar_no_double_booking
    exclude using gist (unit_id with =, daterange(start_date, end_date, '[)') with &&)
);
create index if not exists unit_calendar_property_idx on unit_calendar (property_id, start_date, end_date);
create index if not exists unit_calendar_booking_idx on unit_calendar (booking_id);
create index if not exists unit_calendar_expiry_idx on unit_calendar (expires_at) where state = 'held';

insert into platform_settings (key, value, updated_at)
values ('shortlet_host_response_hours', '24', now())
on conflict (key) do nothing;

-- -------------------------------------------------------------- RLS / access
alter table room_types enable row level security;
alter table property_units enable row level security;
alter table unit_calendar enable row level security;

drop policy if exists room_types_public_read on room_types;
create policy room_types_public_read on room_types for select using (true);
drop policy if exists room_types_owner_manage on room_types;
create policy room_types_owner_manage on room_types for all
  using (exists (select 1 from properties p where p.id = room_types.property_id and p.owner_id = auth.uid()) or is_admin())
  with check (exists (select 1 from properties p where p.id = room_types.property_id and p.owner_id = auth.uid()) or is_admin());

drop policy if exists property_units_public_read on property_units;
create policy property_units_public_read on property_units for select using (true);
drop policy if exists property_units_owner_manage on property_units;
create policy property_units_owner_manage on property_units for all
  using (exists (select 1 from properties p where p.id = property_units.property_id and p.owner_id = auth.uid()) or is_admin())
  with check (exists (select 1 from properties p where p.id = property_units.property_id and p.owner_id = auth.uid()) or is_admin());

-- The ledger holds booking ids and walk-in names: only the property's owner and
-- admin may read it directly. Guests get dates-only through
-- get_property_availability(). Nobody writes to it directly — only the
-- triggers and security-definer functions below.
drop policy if exists unit_calendar_owner_read on unit_calendar;
create policy unit_calendar_owner_read on unit_calendar for select
  using (exists (select 1 from properties p where p.id = unit_calendar.property_id and p.owner_id = auth.uid()));
drop policy if exists unit_calendar_admin_read on unit_calendar;
create policy unit_calendar_admin_read on unit_calendar for select using (is_admin());

-- --------------------------------------------------------------- functions
create or replace function ensure_default_unit(p_property_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v uuid;
begin
  select id into v from property_units where property_id = p_property_id and active order by created_at, label limit 1;
  if v is null then
    insert into property_units (property_id, label) values (p_property_id, 'Whole property')
    on conflict (property_id, label) do update set active = true
    returning id into v;
  end if;
  return v;
end;
$$;

-- Declines a pending request and refunds EXACTLY what the guest was charged
-- (read from their wallet debit — so a security deposit is always included).
create or replace function system_decline_booking(p_booking_id uuid, p_reason text, p_by_system boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b record; v_refund numeric; v_title text; v_host uuid; v_ref text; v_guest_name text;
begin
  select * into b from shortlet_bookings where id = p_booking_id for update;
  if not found or b.status <> 'pending_host_review' then return; end if;

  select title, owner_id into v_title, v_host from properties where id = b.property_id;

  select amount into v_refund from wallet_transactions
    where user_id = b.guest_id and direction = 'debit' and reference = 'REQ-' || substr(b.id::text, 1, 8)
    order by created_at desc limit 1;
  v_refund := coalesce(v_refund, b.total_price + coalesce(b.guest_commission_amount, 0) + coalesce(b.security_deposit_amount, 0));

  v_ref := case when p_by_system then 'EXP-' else 'DEC-' end || substr(b.id::text, 1, 8);

  update wallets set main_balance = main_balance + v_refund, updated_at = now() where user_id = b.guest_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (b.guest_id, 'main', v_refund, 'credit', 'Full refund — ' || v_title || ' (' || p_reason || ')', v_ref);

  update shortlet_bookings set
    status = 'declined', payment_status = 'refunded',
    host_decision_note = coalesce(host_decision_note, p_reason),
    security_deposit_status = case when coalesce(security_deposit_amount, 0) > 0 then 'released_to_guest' else security_deposit_status end
  where id = b.id;

  perform notify_user(b.guest_id,
    case when p_by_system then 'Your booking request was not confirmed' else 'Your booking request was declined' end,
    'Your request for ' || v_title || ' (' || b.check_in || ' to ' || b.check_out || ') was not confirmed — ' || p_reason ||
    '. You have been fully and automatically refunded ' || v_refund || '. Nothing was kept.',
    '/my-bookings');

  if p_by_system then
    select full_name into v_guest_name from profiles where id = b.guest_id;
    perform notify_user(v_host, 'A booking request expired',
      'The request from ' || coalesce(v_guest_name, 'a guest') || ' for ' || v_title || ' (' || b.check_in || ' to ' || b.check_out || ') expired because it was not answered in time. The guest was refunded and the dates are open again. Please reply promptly to requests — slow answers cost you bookings.',
      '/owner');
    perform notify_admins_by_domain('owner_buyer_tenant', '⏱ Booking request expired unanswered',
      coalesce(v_guest_name, 'A guest') || '''s request for ' || v_title || ' (' || b.check_in || ' to ' || b.check_out || ', ' || v_refund || ') expired — ' || p_reason || '. Guest refunded in full; dates released.',
      '/admin?tab=shortletbookings');
  end if;

  perform log_audit_event('booking_request_' || case when p_by_system then 'expired' else 'declined' end, 'shortlet_bookings', b.id,
    v_title || ' — refunded ' || v_refund || ' (' || p_reason || ')', null);
end;
$$;

create or replace function purge_expired_holds(p_property_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare r record; n int := 0;
begin
  for r in
    select distinct booking_id from unit_calendar
    where state = 'held' and expires_at < now() and booking_id is not null
      and (p_property_id is null or property_id = p_property_id)
  loop
    perform system_decline_booking(r.booking_id, 'the host did not respond within the allowed time', true);
    n := n + 1;
  end loop;
  delete from unit_calendar
    where state = 'held' and expires_at < now() and (p_property_id is null or property_id = p_property_id);
  return n;
end;
$$;

create or replace function sweep_expired_booking_holds()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int; r record;
begin
  n := purge_expired_holds(null);
  -- A pending request whose dates have already passed can never be honoured.
  for r in select id from shortlet_bookings where status = 'pending_host_review' and check_in < current_date loop
    perform system_decline_booking(r.id, 'the requested dates passed without a host decision', true);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- --------------------------------------------------------------- triggers
create or replace function trg_booking_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_cand record; v_taken uuid; v_hours int; v_state text;
begin
  if new.status not in ('pending_host_review', 'confirmed') then return null; end if;

  perform purge_expired_holds(new.property_id);
  perform ensure_default_unit(new.property_id);

  select coalesce(value::int, 24) into v_hours from platform_settings where key = 'shortlet_host_response_hours';
  v_hours := coalesce(v_hours, 24);
  v_state := case when new.status = 'confirmed' then 'confirmed' else 'held' end;

  for v_cand in
    select id from property_units
    where property_id = new.property_id and active and (new.unit_id is null or id = new.unit_id)
    order by label
  loop
    begin
      insert into unit_calendar (unit_id, property_id, start_date, end_date, state, booking_id, expires_at, created_by)
      values (v_cand.id, new.property_id, new.check_in, new.check_out, v_state, new.id,
              case when v_state = 'held' then now() + make_interval(hours => v_hours) end, new.guest_id);
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
$$;

create or replace function trg_booking_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_cand record; v_taken uuid;
begin
  if new.status is not distinct from old.status then return null; end if;

  if new.status in ('declined', 'cancelled') then
    delete from unit_calendar where booking_id = new.id;
  elsif new.status = 'confirmed' then
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
        raise exception 'dates_unavailable: Those dates have just been taken by another booking, so this request cannot be confirmed. The guest will be refunded.';
      end if;
    end if;
  end if;
  return null;
end;
$$;

create or replace function trg_property_default_unit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.purpose in ('shortlet', 'hire') then perform ensure_default_unit(new.id); end if;
  return null;
end;
$$;

-- ------------------------------------- guest-facing availability (dates only)
create or replace function get_property_availability(
  p_property_id uuid, p_from date default current_date, p_days int default 60, p_room_type_id uuid default null
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_to date;
begin
  p_from := greatest(coalesce(p_from, current_date), current_date);
  v_to := p_from + least(greatest(coalesce(p_days, 60), 1), 366);
  return (
    with days as (select d::date as day from generate_series(p_from, v_to - 1, interval '1 day') d),
    units as (
      select id from property_units
      where property_id = p_property_id and active and (p_room_type_id is null or room_type_id = p_room_type_id)
    ),
    occ as (
      select d.day, u.id as unit_id,
        coalesce(max(case
          when c.state in ('confirmed', 'blocked', 'walk_in') then 2
          when c.state = 'held' and c.expires_at > now() then 1
          else 0 end), 0) as lvl
      from days d cross join units u
      left join unit_calendar c on c.unit_id = u.id and c.start_date <= d.day and c.end_date > d.day
      group by d.day, u.id
    ),
    per_day as (
      select day, count(*) as total, count(*) filter (where lvl = 0) as free, count(*) filter (where lvl = 1) as held
      from occ group by day
    )
    select json_build_object(
      'property_id', p_property_id, 'from', p_from, 'to', v_to,
      'total_units', (select count(*) from units),
      'days', coalesce((
        select json_agg(json_build_object(
          'date', day, 'free_units', free, 'total_units', total,
          'state', case when free > 0 then 'available' when held > 0 then 'requested' else 'booked' end)
          order by day) from per_day), '[]'::json)
    )
  );
end;
$$;

-- --------------------------------------- host decision: fixes + shared decline
create or replace function host_decide_shortlet_booking(p_booking_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_property_id uuid;
  v_host_id uuid;
  v_guest_id uuid;
  v_status text;
  v_total_price numeric;
  v_guest_commission numeric;
  v_host_commission numeric;
  v_property_title text;
  v_guest_name text;
begin
  select sb.property_id into v_property_id from shortlet_bookings sb where sb.id = p_booking_id;
  if v_property_id is null then
    raise exception 'This booking request does not exist.';
  end if;

  -- An unanswered request past its deadline is settled first, so a host can
  -- never confirm a request whose guest has already been refunded.
  perform purge_expired_holds(v_property_id);

  select sb.guest_id, sb.status, sb.total_price, sb.guest_commission_amount, sb.host_commission_amount
    into v_guest_id, v_status, v_total_price, v_guest_commission, v_host_commission
    from shortlet_bookings sb where sb.id = p_booking_id;

  select owner_id, title into v_host_id, v_property_title from properties where id = v_property_id;

  if v_host_id != auth.uid() then
    raise exception 'You are not the real host of this property.';
  end if;
  if p_decision not in ('confirmed', 'declined') then
    raise exception 'Not a real, recognized decision.';
  end if;
  if v_status <> 'pending_host_review' then
    raise exception 'This request is no longer waiting for a decision (it is now: %). If it expired, the guest was refunded automatically.', v_status;
  end if;

  if p_decision = 'declined' then
    update shortlet_bookings set host_decision_note = p_note where id = p_booking_id;
    perform system_decline_booking(p_booking_id, coalesce(nullif(trim(p_note), ''), 'the host was unable to accept this request'), false);
  else
    update shortlet_bookings set status = 'confirmed', host_decision_note = p_note where id = p_booking_id;
    perform generate_shortlet_commission(p_booking_id);
    perform notify_user(v_guest_id, '🎉 Your booking was accepted',
      'The host has confirmed your booking for ' || v_property_title || '.' || coalesce(E'\nNote: ' || p_note, ''), '/my-bookings');

    select full_name into v_guest_name from profiles where id = v_guest_id;
    perform notify_admins_by_domain('owner_buyer_tenant', '🎉 Real shortlet/hire booking confirmed',
      v_guest_name || '''s booking for ' || v_property_title || ' (' || v_total_price || ') has been confirmed by the host. ' ||
      'Guest''s CHS commission: ' || v_guest_commission || '. Host''s CHS commission (deducted on release): ' || v_host_commission || '. ' ||
      'Total platform earning on this transaction: ' || (v_guest_commission + v_host_commission) || '.',
      '/admin?tab=escrowoversight');
  end if;
end;
$$;

-- -------------------------------------------------------- backfill existing
insert into property_units (property_id, label)
select id, 'Whole property' from properties
where purpose in ('shortlet', 'hire') or id in (select property_id from shortlet_bookings)
on conflict (property_id, label) do nothing;

update shortlet_bookings sb
set unit_id = (select u.id from property_units u where u.property_id = sb.property_id order by u.created_at, u.label limit 1)
where sb.unit_id is null;

do $$
declare r record; n_conf int := 0; n_hold int := 0; n_skip int := 0;
begin
  -- confirmed first (they win any clash), then pending holds with a fresh 24h
  -- window starting NOW (the rule is new, so existing requests get a fair clock).
  for r in select * from shortlet_bookings where status = 'confirmed' and check_out >= current_date and unit_id is not null loop
    begin
      insert into unit_calendar (unit_id, property_id, start_date, end_date, state, booking_id, created_by)
      values (r.unit_id, r.property_id, r.check_in, r.check_out, 'confirmed', r.id, r.guest_id);
      n_conf := n_conf + 1;
    exception when exclusion_violation then n_skip := n_skip + 1; end;
  end loop;
  for r in select * from shortlet_bookings where status = 'pending_host_review' and check_in >= current_date and unit_id is not null order by created_at loop
    begin
      insert into unit_calendar (unit_id, property_id, start_date, end_date, state, booking_id, expires_at, created_by)
      values (r.unit_id, r.property_id, r.check_in, r.check_out, 'held', r.id, now() + interval '24 hours', r.guest_id);
      n_hold := n_hold + 1;
    exception when exclusion_violation then n_skip := n_skip + 1; end;
  end loop;
  raise notice 'backfill: % confirmed, % held, % skipped (clashing)', n_conf, n_hold, n_skip;
end $$;

-- The new per-room ledger replaces the old per-property constraint, which
-- would wrongly block two guests in different rooms of the same hotel.
alter table shortlet_bookings drop constraint if exists shortlet_bookings_property_id_daterange_excl;

drop trigger if exists booking_after_insert on shortlet_bookings;
create trigger booking_after_insert after insert on shortlet_bookings
  for each row execute function trg_booking_after_insert();
drop trigger if exists booking_after_update on shortlet_bookings;
create trigger booking_after_update after update on shortlet_bookings
  for each row execute function trg_booking_after_update();
drop trigger if exists property_default_unit on properties;
create trigger property_default_unit after insert or update of purpose on properties
  for each row execute function trg_property_default_unit();

-- ------------------------------------------------------------------ grants
revoke all on function ensure_default_unit(uuid) from public, anon, authenticated;
revoke all on function system_decline_booking(uuid, text, boolean) from public, anon, authenticated;
revoke all on function purge_expired_holds(uuid) from public, anon, authenticated;
revoke all on function sweep_expired_booking_holds() from public, anon, authenticated;
revoke all on function trg_booking_after_insert() from public, anon, authenticated;
revoke all on function trg_booking_after_update() from public, anon, authenticated;
revoke all on function trg_property_default_unit() from public, anon, authenticated;
grant execute on function get_property_availability(uuid, date, int, uuid) to anon, authenticated, service_role;

-- --------------------------------------------------------------- scheduling
-- (applied separately, right after the migration)
-- select cron.schedule('chs-expire-booking-holds', '*/5 * * * *', $$select sweep_expired_booking_holds();$$);
