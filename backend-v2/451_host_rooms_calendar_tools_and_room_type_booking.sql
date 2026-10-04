-- ============================================================================
-- 451 — STEP 2 (database layer) of the hotel / lodge / event-centre booking
-- system: host tools for rooms and the calendar, room-type aware pricing and
-- booking, the "calendar is accurate" stamp, and the stale-calendar alert and
-- daily reminder. (Step 1 is migration 450.)
-- ============================================================================
-- What a host can now do (every function checks the caller owns the listing,
-- or is admin; a guest or stranger is refused):
--   host_save_room_type    create / update a room type (name, max guests, optional price)
--   host_add_rooms         add rooms in bulk; the placeholder "Whole property" room is
--                          retired automatically unless it holds a real booking
--   host_update_room       rename, change type, switch off (refused if the room has
--                          upcoming guest bookings or requests)
--   host_block_dates       block a room, or record a walk-in guest (name required);
--                          clashes give a plain-words reason (confirmed booking /
--                          guest request / own block / walk-in)
--   host_remove_block      remove a block or walk-in; guest bookings and requests can
--                          NOT be removed this way
--   host_block_all_rooms   "fully booked / closed" for a period; rooms that already
--                          have something are skipped and reported
--   host_confirm_calendar  one-tap "my calendar is accurate" stamp
--                          (properties.calendar_confirmed_at)
--   get_host_calendar      rooms, types and entries (with guest names) for the console
-- Guest side:
--   get_available_room_types  room types with how many rooms are free for given dates
--   request_shortlet_booking  gains p_room_type_id (the old 13-argument version is
--                             dropped, not left beside it); also now refuses a
--                             check-in in the past and a check-out not after check-in
--   get_real_shortlet_pricing gains p_room_type_id; a room type's own nightly price
--                             overrides the listing price (old 4-argument version dropped)
--   trg_booking_after_insert  assigns a room of the chosen type
-- Admin / reminders:
--   get_stale_calendars              active hotel/venue listings whose calendar has not
--                                    been confirmed in N days (default 3), admin only
--   remind_hosts_to_confirm_calendar daily nudge, one per host, never twice in 20 hours
--                                    (scheduled in migration 452)
--
-- Verified by direct tests against the live schema (all rolled back):
--   * a stranger cannot manage a hotel or read its host calendar
--   * 2 room types + 5 rooms created; blank and duplicate entries handled
--   * walk-in recorded, clash messages correct, no-name walk-in refused, past dates
--     refused; a guest's hold cannot be deleted or its room switched off
--   * "mark everything full": 4 rooms blocked, the 1 with a guest request skipped
--   * placeholder room: retired on a hotel with no bookings; on the demo hotel (which
--     holds a real pending request) it is kept and renamed to a real room, keeping
--     the booking
--   * Executive booking: 2 nights x 45,000 = 90,000 + 7% commission = 96,300 charged;
--     guest-commission record 'paid'; host notified; both Executive rooms taken ->
--     third Executive guest refused, Standard still bookable
--   * old-style calls (4-argument pricing, no room type) still work
--   * admin stale list works and is admin-only; reminder notified 4 hosts once and
--     0 on an immediate second run; a confirmed hotel drops off the stale list
--
-- NOTE: the listing's "Whole property" placeholder keeps appearing as a room until
-- the host renames it (the console prompts) — it cannot be silently dropped while it
-- holds a real booking.
-- ============================================================================

alter table properties add column if not exists calendar_confirmed_at timestamptz;
alter table shortlet_bookings add column if not exists room_type_id uuid references room_types(id) on delete set null;

-- ---------------------------------------------------------------- ownership
create or replace function assert_listing_owner(p_property_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if not exists (select 1 from properties where id = p_property_id and owner_id = auth.uid()) and not is_admin() then
    raise exception 'Only the owner of this listing can manage its rooms and calendar.';
  end if;
end;
$$;
revoke all on function assert_listing_owner(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- room types
create or replace function host_save_room_type(
  p_property_id uuid, p_name text, p_max_guests int default null, p_price numeric default null, p_room_type_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  perform assert_listing_owner(p_property_id);
  if p_name is null or trim(p_name) = '' then
    raise exception 'A room type needs a name, e.g. Executive or Standard.';
  end if;
  if p_price is not null and p_price <= 0 then
    raise exception 'The nightly price must be more than zero (or leave it empty to use the listing price).';
  end if;

  if p_room_type_id is null then
    insert into room_types (property_id, name, max_guests, price_per_night)
    values (p_property_id, trim(p_name), p_max_guests, p_price)
    on conflict (property_id, name) do update
      set max_guests = excluded.max_guests, price_per_night = excluded.price_per_night, active = true
    returning id into v_id;
  else
    update room_types set name = trim(p_name), max_guests = p_max_guests, price_per_night = p_price
    where id = p_room_type_id and property_id = p_property_id
    returning id into v_id;
    if v_id is null then raise exception 'That room type does not belong to this listing.'; end if;
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------- rooms
create or replace function host_add_rooms(p_property_id uuid, p_room_type_id uuid, p_labels text[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_label text; n int := 0; v_default uuid;
begin
  perform assert_listing_owner(p_property_id);
  if p_labels is null or array_length(p_labels, 1) is null then
    raise exception 'Enter at least one room number or name.';
  end if;
  if array_length(p_labels, 1) > 300 then
    raise exception 'Please add at most 300 rooms at a time.';
  end if;
  if p_room_type_id is not null and not exists (select 1 from room_types where id = p_room_type_id and property_id = p_property_id) then
    raise exception 'That room type does not belong to this listing.';
  end if;

  foreach v_label in array p_labels loop
    v_label := trim(v_label);
    continue when v_label = '';
    insert into property_units (property_id, room_type_id, label)
    values (p_property_id, p_room_type_id, v_label)
    on conflict (property_id, label) do update set active = true, room_type_id = coalesce(excluded.room_type_id, property_units.room_type_id);
    n := n + 1;
  end loop;

  -- The placeholder "Whole property" room that every listing starts with must
  -- not linger as a phantom extra room once real rooms exist — unless it holds
  -- real bookings, in which case the host can rename it to a real room.
  select id into v_default from property_units where property_id = p_property_id and label = 'Whole property' and active;
  if v_default is not null and n > 0
     and not exists (select 1 from unit_calendar where unit_id = v_default and end_date > current_date) then
    update property_units set active = false where id = v_default;
  end if;

  return n;
end;
$$;

create or replace function host_update_room(
  p_unit_id uuid, p_label text default null, p_room_type_id uuid default null, p_clear_type boolean default false, p_active boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_prop uuid;
begin
  select property_id into v_prop from property_units where id = p_unit_id;
  if v_prop is null then raise exception 'That room does not exist.'; end if;
  perform assert_listing_owner(v_prop);

  if p_active is false and exists (
    select 1 from unit_calendar where unit_id = p_unit_id and end_date > current_date and state in ('held', 'confirmed')
  ) then
    raise exception 'This room has upcoming guest bookings or requests, so it cannot be switched off. Answer or move those first.';
  end if;
  if p_room_type_id is not null and not exists (select 1 from room_types where id = p_room_type_id and property_id = v_prop) then
    raise exception 'That room type does not belong to this listing.';
  end if;
  if p_label is not null and trim(p_label) = '' then
    raise exception 'A room needs a number or name.';
  end if;

  update property_units set
    label = coalesce(nullif(trim(p_label), ''), label),
    room_type_id = case when p_clear_type then null else coalesce(p_room_type_id, room_type_id) end,
    active = coalesce(p_active, active)
  where id = p_unit_id;
exception when unique_violation then
  raise exception 'Another room in this listing already has that number or name.';
end;
$$;

-- ------------------------------------------------- blocking / walk-in guests
create or replace function host_block_dates(
  p_unit_id uuid, p_start date, p_end date, p_kind text default 'blocked', p_label text default null, p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_prop uuid; v_room text; v_id uuid; v_clash record;
begin
  select property_id, label into v_prop, v_room from property_units where id = p_unit_id and active;
  if v_prop is null then raise exception 'That room does not exist or is switched off.'; end if;
  perform assert_listing_owner(v_prop);

  if p_kind not in ('blocked', 'walk_in') then raise exception 'Not a recognised kind of entry.'; end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'The end date must be after the start date.';
  end if;
  if p_start < current_date then
    raise exception 'You can only block or record dates from today onwards.';
  end if;
  if p_kind = 'walk_in' and (p_label is null or trim(p_label) = '') then
    raise exception 'Enter the walk-in guest''s name so the room is recorded properly.';
  end if;

  perform purge_expired_holds(v_prop);

  begin
    insert into unit_calendar (unit_id, property_id, start_date, end_date, state, guest_label, note, created_by)
    values (p_unit_id, v_prop, p_start, p_end, p_kind, nullif(trim(p_label), ''), nullif(trim(p_note), ''), auth.uid())
    returning id into v_id;
  exception when exclusion_violation then
    select c.state, c.start_date, c.end_date, b.guest_full_name into v_clash
    from unit_calendar c left join shortlet_bookings b on b.id = c.booking_id
    where c.unit_id = p_unit_id and daterange(c.start_date, c.end_date, '[)') && daterange(p_start, p_end, '[)')
    order by c.start_date limit 1;
    raise exception 'dates_unavailable: Room % is not free then — %.', v_room,
      case v_clash.state
        when 'confirmed' then 'a confirmed guest booking (' || coalesce(v_clash.guest_full_name, 'guest') || ', ' || v_clash.start_date || ' to ' || v_clash.end_date || ')'
        when 'held' then 'a guest has requested these dates (' || v_clash.start_date || ' to ' || v_clash.end_date || '); please answer that request first'
        when 'walk_in' then 'a walk-in guest you already recorded (' || v_clash.start_date || ' to ' || v_clash.end_date || ')'
        else 'dates you already blocked (' || v_clash.start_date || ' to ' || v_clash.end_date || ')' end;
  end;
  return v_id;
end;
$$;

create or replace function host_remove_block(p_calendar_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_prop uuid; v_state text;
begin
  select property_id, state into v_prop, v_state from unit_calendar where id = p_calendar_id;
  if v_prop is null then raise exception 'That calendar entry no longer exists.'; end if;
  perform assert_listing_owner(v_prop);
  if v_state not in ('blocked', 'walk_in') then
    raise exception 'Guest bookings and requests cannot be removed here — answer or cancel them from your requests list.';
  end if;
  delete from unit_calendar where id = p_calendar_id;
end;
$$;

-- "We are fully booked / closed for these dates" in one action.
create or replace function host_block_all_rooms(p_property_id uuid, p_start date, p_end date, p_note text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare r record; n int := 0; v_skipped json[] := '{}';
begin
  perform assert_listing_owner(p_property_id);
  if p_start is null or p_end is null or p_end <= p_start then raise exception 'The end date must be after the start date.'; end if;
  if p_start < current_date then raise exception 'You can only block dates from today onwards.'; end if;
  perform purge_expired_holds(p_property_id);

  for r in select id, label from property_units where property_id = p_property_id and active order by label loop
    begin
      insert into unit_calendar (unit_id, property_id, start_date, end_date, state, note, created_by)
      values (r.id, p_property_id, p_start, p_end, 'blocked', nullif(trim(p_note), ''), auth.uid());
      n := n + 1;
    exception when exclusion_violation then
      v_skipped := v_skipped || json_build_object('room', r.label, 'reason', 'already has a booking, request or block in that period');
    end;
  end loop;
  return json_build_object('blocked', n, 'skipped', to_json(v_skipped));
end;
$$;

-- One tap: "my calendar is accurate" (also the freshness stamp Instant Confirm
-- will later rely on).
create or replace function host_confirm_calendar(p_property_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare v_now timestamptz := now();
begin
  perform assert_listing_owner(p_property_id);
  update properties set calendar_confirmed_at = v_now where id = p_property_id;
  return v_now;
end;
$$;

-- ------------------------------------------------------- host's own calendar
create or replace function get_host_calendar(p_property_id uuid, p_from date default current_date, p_days int default 14)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_to date;
begin
  perform assert_listing_owner(p_property_id);
  perform purge_expired_holds(p_property_id);
  p_from := coalesce(p_from, current_date);
  v_to := p_from + least(greatest(coalesce(p_days, 14), 1), 62);

  return json_build_object(
    'property', (select json_build_object('id', id, 'title', title, 'calendar_confirmed_at', calendar_confirmed_at, 'purpose', purpose) from properties where id = p_property_id),
    'from', p_from, 'to', v_to,
    'room_types', coalesce((select json_agg(json_build_object('id', id, 'name', name, 'max_guests', max_guests, 'price_per_night', price_per_night) order by sort_order, name)
                  from room_types where property_id = p_property_id and active), '[]'::json),
    'units', coalesce((select json_agg(json_build_object('id', id, 'label', label, 'room_type_id', room_type_id) order by label)
                  from property_units where property_id = p_property_id and active), '[]'::json),
    'entries', coalesce((
      select json_agg(json_build_object(
        'id', c.id, 'unit_id', c.unit_id, 'start', c.start_date, 'end', c.end_date, 'state', c.state,
        'label', coalesce(b.guest_full_name, c.guest_label, c.note),
        'note', c.note, 'booking_id', c.booking_id, 'expires_at', c.expires_at) order by c.start_date)
      from unit_calendar c left join shortlet_bookings b on b.id = c.booking_id
      where c.property_id = p_property_id and c.start_date < v_to and c.end_date > p_from
        and (c.state <> 'held' or c.expires_at > now())), '[]'::json)
  );
end;
$$;

-- ----------------------------------------------- guest: rooms free for dates
create or replace function get_available_room_types(p_property_id uuid, p_check_in date, p_check_out date)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with unit_free as (
    select u.id, u.room_type_id,
      not exists (
        select 1 from unit_calendar c
        where c.unit_id = u.id
          and daterange(c.start_date, c.end_date, '[)') && daterange(p_check_in, p_check_out, '[)')
          and (c.state <> 'held' or c.expires_at > now())
      ) as free
    from property_units u where u.property_id = p_property_id and u.active
  ),
  grouped as (
    select room_type_id, count(*) as total_units, count(*) filter (where free) as free_units
    from unit_free group by room_type_id
  )
  select coalesce(json_agg(json_build_object(
    'room_type_id', g.room_type_id,
    'name', coalesce(rt.name, case when exists (select 1 from grouped where room_type_id is not null) then 'Standard room' else 'Whole property' end),
    'description', rt.description, 'max_guests', rt.max_guests,
    'price_per_night', coalesce(rt.price_per_night, p.price_per_night, p.price),
    'free_units', g.free_units, 'total_units', g.total_units)
    order by coalesce(rt.sort_order, 999), coalesce(rt.name, 'zzz')), '[]'::json)
  from grouped g
  left join room_types rt on rt.id = g.room_type_id
  cross join properties p
  where p.id = p_property_id;
$$;

-- ---------------------------------------- pricing + booking: room-type aware
drop function if exists get_real_shortlet_pricing(uuid, date, date, uuid);
create or replace function get_real_shortlet_pricing(
  p_property_id uuid, p_check_in date, p_check_out date, p_guest_id uuid default null, p_room_type_id uuid default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_price_per_night numeric;
  v_type_price numeric;
  v_hire_category text;
  v_nights int;
  v_guest_pct numeric;
  v_host_pct numeric;
  v_base_amount numeric;
  v_guest_commission numeric;
  v_host_commission numeric;
  v_deposit_enabled boolean;
  v_deposit_amount numeric;
  v_is_first_time boolean;
  v_real_deposit numeric := 0;
begin
  select coalesce(price_per_night, price), coalesce(hire_category, 'shortlet'), security_deposit_enabled, security_deposit_amount
    into v_price_per_night, v_hire_category, v_deposit_enabled, v_deposit_amount
    from properties where id = p_property_id;

  if p_room_type_id is not null then
    select price_per_night into v_type_price from room_types
      where id = p_room_type_id and property_id = p_property_id and active;
    if v_type_price is not null then v_price_per_night := v_type_price; end if;
  end if;

  v_nights := greatest(p_check_out - p_check_in, 1);
  v_base_amount := v_nights * v_price_per_night;

  if v_hire_category = 'shortlet' then
    if v_nights <= 3 then
      select value::numeric into v_guest_pct from platform_settings where key = 'shortlet_short_guest_pct';
      select value::numeric into v_host_pct from platform_settings where key = 'shortlet_short_host_pct';
    elsif v_nights <= 13 then
      select value::numeric into v_guest_pct from platform_settings where key = 'shortlet_medium_guest_pct';
      select value::numeric into v_host_pct from platform_settings where key = 'shortlet_medium_host_pct';
    else
      select value::numeric into v_guest_pct from platform_settings where key = 'shortlet_long_guest_pct';
      select value::numeric into v_host_pct from platform_settings where key = 'shortlet_long_host_pct';
    end if;
  else
    select value::numeric into v_guest_pct from platform_settings where key = 'hire_booking_guest_pct';
    select value::numeric into v_host_pct from platform_settings where key = 'hire_booking_host_pct';
  end if;

  v_guest_commission := round(v_base_amount * v_guest_pct / 100, 2);
  v_host_commission := round(v_base_amount * v_host_pct / 100, 2);

  if v_deposit_enabled and p_guest_id is not null then
    select (count(*) < 3) into v_is_first_time from shortlet_ratings where rated_user = p_guest_id and role = 'host_rating_guest';
    if coalesce(v_is_first_time, true) then
      v_real_deposit := coalesce(v_deposit_amount, 0);
    end if;
  end if;

  return json_build_object(
    'nights', v_nights,
    'price_per_night', v_price_per_night,
    'base_amount', v_base_amount,
    'guest_commission_pct', v_guest_pct,
    'guest_commission_amount', v_guest_commission,
    'security_deposit_required', v_real_deposit > 0,
    'security_deposit_amount', v_real_deposit,
    'real_total_guest_pays', v_base_amount + v_guest_commission + v_real_deposit,
    'host_commission_pct', v_host_pct,
    'host_commission_amount', v_host_commission,
    'real_net_host_receives', v_base_amount - v_host_commission
  );
end;
$$;

-- The trigger now respects a chosen room type when assigning a room.
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
    where property_id = new.property_id and active
      and (new.unit_id is null or id = new.unit_id)
      and (new.room_type_id is null or room_type_id = new.room_type_id)
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

drop function if exists request_shortlet_booking(uuid, date, date, integer, text, text, text, boolean, boolean, boolean, boolean, integer, text);
create or replace function request_shortlet_booking(
  p_property_id uuid, p_check_in date, p_check_out date, p_guests integer,
  p_guest_full_name text, p_guest_phone text, p_guest_id_document_url text,
  p_house_rules_acknowledged boolean default false,
  p_wants_music_band boolean default false, p_wants_caterer boolean default false,
  p_wants_ushers boolean default false, p_number_of_ushers integer default null,
  p_additional_event_requests text default null,
  p_room_type_id uuid default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_pricing json;
  v_real_total numeric;
  v_real_deposit numeric;
  v_balance numeric;
  v_booking_id uuid;
  v_host_id uuid;
  v_property_title text;
  v_has_rules boolean;
  v_addon_summary text := '';
  v_guest_commission numeric;
begin
  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    raise exception 'Please choose a check-out date after your check-in date.';
  end if;
  if p_check_in < current_date then
    raise exception 'Check-in cannot be in the past.';
  end if;
  if p_room_type_id is not null and not exists (
    select 1 from room_types where id = p_room_type_id and property_id = p_property_id and active
  ) then
    raise exception 'That room type is not available at this property.';
  end if;

  select owner_id, title into v_host_id, v_property_title from properties where id = p_property_id;

  select (document_url is not null) into v_has_rules from property_house_rules where property_id = p_property_id;
  if coalesce(v_has_rules, false) and not p_house_rules_acknowledged then
    raise exception 'You must read and acknowledge the real house rules before requesting to book.';
  end if;

  v_pricing := get_real_shortlet_pricing(p_property_id, p_check_in, p_check_out, auth.uid(), p_room_type_id);
  v_real_total := (v_pricing->>'real_total_guest_pays')::numeric;
  v_real_deposit := (v_pricing->>'security_deposit_amount')::numeric;
  v_guest_commission := (v_pricing->>'guest_commission_amount')::numeric;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_real_total then
    raise exception 'insufficient_balance';
  end if;

  insert into shortlet_bookings (
    property_id, guest_id, check_in, check_out, total_price,
    guest_commission_amount, host_commission_amount,
    guests, guest_full_name, guest_phone, guest_id_document_url,
    status, payment_status, house_rules_acknowledged,
    security_deposit_amount, security_deposit_status,
    wants_music_band, wants_caterer, wants_ushers, number_of_ushers, additional_event_requests,
    room_type_id
  ) values (
    p_property_id, auth.uid(), p_check_in, p_check_out, (v_pricing->>'base_amount')::numeric,
    v_guest_commission, (v_pricing->>'host_commission_amount')::numeric,
    p_guests, p_guest_full_name, p_guest_phone, p_guest_id_document_url,
    'pending_host_review', 'held_escrow', p_house_rules_acknowledged,
    v_real_deposit, case when v_real_deposit > 0 then 'held' else 'not_applicable' end,
    p_wants_music_band, p_wants_caterer, p_wants_ushers, p_number_of_ushers, p_additional_event_requests,
    p_room_type_id
  ) returning id into v_booking_id;

  update wallets set main_balance = main_balance - v_real_total, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (auth.uid(), 'main', v_real_total, 'debit',
      'Real shortlet/hire booking request (held in escrow, pending host review)' || case when v_real_deposit > 0 then ', includes a real ' || v_real_deposit || ' security deposit' else '' end,
      'REQ-' || substr(v_booking_id::text, 1, 8));

  if v_guest_commission > 0 then
    insert into transaction_commissions (transaction_type, shortlet_booking_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount, status, paid_at)
    values ('shortlet_hire', v_booking_id, p_property_id, auth.uid(), 'guest', (v_pricing->>'base_amount')::numeric,
      round(v_guest_commission / nullif((v_pricing->>'base_amount')::numeric, 0) * 100, 2), v_guest_commission, 'paid', now());
  end if;

  if p_wants_music_band then v_addon_summary := v_addon_summary || ' 🎵 Music band.'; end if;
  if p_wants_caterer then v_addon_summary := v_addon_summary || ' 🍽️ Caterer.'; end if;
  if p_wants_ushers then v_addon_summary := v_addon_summary || ' 🙋 ' || coalesce(p_number_of_ushers::text, '?') || ' usher(s).'; end if;

  perform notify_user(v_host_id, '🔔 Real new booking request',
    p_guest_full_name || ' has requested to book ' || v_property_title || ' from ' || p_check_in || ' to ' || p_check_out || '. Real funds are held — review and accept or decline.' ||
    case when v_addon_summary != '' then ' Event requests:' || v_addon_summary else '' end,
    '/owner');
  perform notify_admins_by_domain('owner_buyer_tenant', '📋 Real new shortlet/hire booking request',
    p_guest_full_name || ' has requested ' || v_property_title || '. Funds held in escrow pending the host''s real decision.',
    '/admin?tab=shortletbookings');

  return v_booking_id;
end;
$$;

-- --------------------------------------- admin: stale calendars + daily nudge
create or replace function get_stale_calendars(p_stale_days int default 3)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  return (
    select coalesce(json_agg(row_to_json(t) order by t.days_since desc nulls first), '[]'::json) from (
      select p.id, p.title, o.full_name as owner_name, o.phone as owner_phone,
        p.calendar_confirmed_at,
        extract(day from now() - p.calendar_confirmed_at)::int as days_since,
        (select count(*) from property_units u where u.property_id = p.id and u.active) as rooms,
        (select count(*) from shortlet_bookings b where b.property_id = p.id and b.status = 'pending_host_review') as pending_requests
      from properties p join profiles o on o.id = p.owner_id
      where p.purpose in ('shortlet', 'hire') and p.status = 'active'
        and (p.calendar_confirmed_at is null or p.calendar_confirmed_at < now() - make_interval(days => greatest(p_stale_days, 1)))
      limit 100
    ) t
  );
end;
$$;
revoke all on function get_stale_calendars(int) from public, anon;
grant execute on function get_stale_calendars(int) to authenticated, service_role;

create or replace function remind_hosts_to_confirm_calendar()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare r record; n int := 0;
begin
  for r in
    select p.owner_id, count(*) as listings
    from properties p
    where p.purpose in ('shortlet', 'hire') and p.status = 'active'
      and (p.calendar_confirmed_at is null or p.calendar_confirmed_at < now() - interval '24 hours')
    group by p.owner_id
  loop
    if not exists (
      select 1 from notifications where user_id = r.owner_id and title = '📅 Please confirm your availability today'
        and created_at > now() - interval '20 hours'
    ) then
      perform notify_user(r.owner_id, '📅 Please confirm your availability today',
        'Guests book on what your calendar shows. Record any walk-in guests from today, then tap "My calendar is accurate" — it takes one tap. ' ||
        r.listings || ' of your listings need it.', '/host');
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke all on function remind_hosts_to_confirm_calendar() from public, anon, authenticated;

-- ------------------------------------------------------------------- grants
revoke all on function host_save_room_type(uuid, text, int, numeric, uuid) from public, anon;
revoke all on function host_add_rooms(uuid, uuid, text[]) from public, anon;
revoke all on function host_update_room(uuid, text, uuid, boolean, boolean) from public, anon;
revoke all on function host_block_dates(uuid, date, date, text, text, text) from public, anon;
revoke all on function host_remove_block(uuid) from public, anon;
revoke all on function host_block_all_rooms(uuid, date, date, text) from public, anon;
revoke all on function host_confirm_calendar(uuid) from public, anon;
revoke all on function get_host_calendar(uuid, date, int) from public, anon;
grant execute on function host_save_room_type(uuid, text, int, numeric, uuid) to authenticated, service_role;
grant execute on function host_add_rooms(uuid, uuid, text[]) to authenticated, service_role;
grant execute on function host_update_room(uuid, text, uuid, boolean, boolean) to authenticated, service_role;
grant execute on function host_block_dates(uuid, date, date, text, text, text) to authenticated, service_role;
grant execute on function host_remove_block(uuid) to authenticated, service_role;
grant execute on function host_block_all_rooms(uuid, date, date, text) to authenticated, service_role;
grant execute on function host_confirm_calendar(uuid) to authenticated, service_role;
grant execute on function get_host_calendar(uuid, date, int) to authenticated, service_role;
grant execute on function get_available_room_types(uuid, date, date) to anon, authenticated, service_role;
revoke all on function get_real_shortlet_pricing(uuid, date, date, uuid, uuid) from public, anon;
grant execute on function get_real_shortlet_pricing(uuid, date, date, uuid, uuid) to authenticated, service_role;
revoke all on function request_shortlet_booking(uuid, date, date, integer, text, text, text, boolean, boolean, boolean, boolean, integer, text, uuid) from public, anon;
grant execute on function request_shortlet_booking(uuid, date, date, integer, text, text, text, boolean, boolean, boolean, boolean, integer, text, uuid) to authenticated, service_role;
