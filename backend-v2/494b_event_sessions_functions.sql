-- 494b EVENT CENTRE SESSIONS: pricing, availability, booking, host tools, date-move support (Oct 13 2026)
-- Price of a session = the hall tier's hourly rate x hours, never more than the tier's day price. If the host has not set an
-- hourly rate it is the day price divided by the venue's "full day hours" (default 10). Several sessions on one date together
-- never cost more than one day price. Services and facilities are charged once per booking, as before.

-- tidy the two cross-checks so host blocks (no booking) are also caught
create or replace function public.trg_event_slot_vs_calendar() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (
    select 1 from public.unit_calendar c
    where c.unit_id = new.unit_id
      and not (c.booking_id is not null and new.booking_id is not null and c.booking_id = new.booking_id)
      and not (c.state = 'held' and c.expires_at < now())
      and daterange(c.start_date, c.end_date, '[)') && daterange(public._lagos_date(new.starts_at), public._lagos_date(new.ends_at - interval '1 second') + 1, '[)')
  ) then
    raise exception 'event_slot_vs_calendar' using errcode = '23P01';
  end if;
  return new;
end $$;
create or replace function public.trg_calendar_vs_event_slot() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (
    select 1 from public.event_slots s
    where s.unit_id = new.unit_id
      and not (s.booking_id is not null and new.booking_id is not null and s.booking_id = new.booking_id)
      and not (s.state = 'held' and s.expires_at < now())
      and daterange(public._lagos_date(s.starts_at), public._lagos_date(s.ends_at - interval '1 second') + 1, '[)') && daterange(new.start_date, new.end_date, '[)')
  ) then
    raise exception 'calendar_vs_event_slot' using errcode = '23P01';
  end if;
  return new;
end $$;

-- time helpers
create or replace function public._hhmm(m int) returns text language sql immutable as $$
  select lpad((m / 60)::text, 2, '0') || ':' || lpad((m % 60)::text, 2, '0') $$;
create or replace function public._parse_hhmm(t text) returns int language plpgsql immutable as $$
declare h int; mi int;
begin
  if t is null or t !~ '^\d{1,2}:\d{2}$' then return null; end if;
  h := split_part(t, ':', 1)::int; mi := split_part(t, ':', 2)::int;
  if mi > 59 then return null; end if;
  if h = 24 and mi = 0 then return 1440; end if;
  if h > 23 then return null; end if;
  return h * 60 + mi;
end $$;
create or replace function public._ampm(m int) returns text language sql immutable as $$
  select case when m >= 1440 then 'midnight'
    else (case when (m / 60) % 12 = 0 then 12 else (m / 60) % 12 end)::text
      || case when m % 60 > 0 then ':' || lpad((m % 60)::text, 2, '0') else '' end
      || case when (m / 60) < 12 then 'am' else 'pm' end end $$;

create or replace function public._sessions_text(p_sessions jsonb) returns text language sql stable as $$
  select coalesce(string_agg(to_char((e->>'date')::date, 'Dy DD Mon') || ' ' || public._ampm((e->>'sm')::int) || ' to ' || public._ampm((e->>'em')::int), '; ' order by e->>'date', (e->>'sm')::int), '')
  from jsonb_array_elements(p_sessions) e where e->>'reason' is null $$;

create or replace function public._event_settings(p_property uuid) returns public.property_event_settings
language plpgsql security definer set search_path to 'public' as $$
declare st public.property_event_settings;
begin
  insert into property_event_settings(property_id) values (p_property) on conflict do nothing;
  select * into st from property_event_settings where property_id = p_property;
  return st;
end $$;

-- is this hall free for this time (with set-up before and clean-up after), ignoring one booking's own holds?
create or replace function public._event_unit_free(p_unit uuid, p_start timestamptz, p_end timestamptz, p_setup int, p_cleanup int, p_exclude uuid default null)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select not exists (
      select 1 from event_slots s
      where s.unit_id = p_unit
        and s.block_range && tstzrange(p_start - make_interval(mins => p_setup), p_end + make_interval(mins => p_cleanup), '[)')
        and not (s.booking_id is not null and p_exclude is not null and s.booking_id = p_exclude)
        and not (s.state = 'held' and s.expires_at < now()))
    and not exists (
      select 1 from unit_calendar c
      where c.unit_id = p_unit
        and not (c.booking_id is not null and p_exclude is not null and c.booking_id = p_exclude)
        and not (c.state = 'held' and c.expires_at < now())
        and daterange(c.start_date, c.end_date, '[)') && daterange(public._lagos_date(p_start), public._lagos_date(p_end - interval '1 second') + 1, '[)')) $$;

-- facilities and per-guest extras (same sums as before)
create or replace function public._event_facilities_price(p_property uuid, p_ids uuid[], p_qtys integer[], p_max_guests integer) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare f record; i int; v_total numeric := 0; v_sel jsonb := '[]'::jsonb; q int;
begin
  if p_ids is not null then
    for i in 1..coalesce(array_length(p_ids, 1), 0) loop
      select name, price, per_guest into f from event_facilities where id = p_ids[i] and property_id = p_property;
      if f.name is not null then
        q := case when f.per_guest then coalesce(p_qtys[i], p_max_guests) else 1 end;
        v_total := v_total + f.price * q;
        v_sel := v_sel || jsonb_build_object('name', f.name, 'price', f.price, 'per_guest', f.per_guest, 'quantity', q);
      end if;
    end loop;
  end if;
  return jsonb_build_object('total', v_total, 'selected', v_sel);
end $$;

-- check, price and place a set of sessions. p_sessions = [{date:'2026-10-16', start:'16:00', end:'19:00', label:'Traditional wedding'}, ...]
create or replace function public._event_sessions_quote(p_property uuid, p_tier uuid, p_sessions jsonb, p_exclude uuid default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  st public.property_event_settings; t record; el record; u record; rows jsonb := '[]'::jsonb; ent jsonb;
  v_today date := public._lagos_date(now()); d date; sm int; em int; mins int; rate numeric; fee numeric; reason text;
  sa timestamptz; ea timestamptz; i int; n int; prev_end timestamptz; v_unit uuid; all_ok boolean; has_valid boolean := false; flagged int := 0;
  v_total numeric := 0; v_mins int := 0; v_days int := 0; v_ok boolean;
begin
  select id, label, price, hourly_price, max_guests into t from event_capacity_tiers where id = p_tier and property_id = p_property;
  if not found then raise exception 'Not a real, valid capacity tier for this venue.'; end if;
  st := public._event_settings(p_property);
  if p_sessions is null or jsonb_typeof(p_sessions) <> 'array' or jsonb_array_length(p_sessions) = 0 then
    raise exception 'Please add at least one session (a date with a start and end time).';
  end if;
  if jsonb_array_length(p_sessions) > st.max_sessions then raise exception 'This venue takes up to % sessions in one booking.', st.max_sessions; end if;
  perform purge_expired_holds(p_property);
  perform ensure_default_unit(p_property);
  rate := coalesce(t.hourly_price, t.price / st.full_day_hours);

  for el in select value as v from jsonb_array_elements(p_sessions) loop
    reason := null; d := null; sa := null; ea := null;
    begin d := nullif(el.v->>'date', '')::date; exception when others then d := null; end;
    sm := public._parse_hhmm(el.v->>'start'); em := public._parse_hhmm(el.v->>'end');
    if not st.allow_hourly then sm := st.open_min; em := st.close_min; end if;
    if d is null or sm is null or em is null then reason := 'Choose a date and a start and end time.';
    elsif d < v_today then reason := 'This date has passed.';
    elsif d > v_today + 548 then reason := 'Please choose a date within the next 18 months.';
    elsif em <= sm then reason := 'The end time must be after the start time.';
    elsif sm < st.open_min or em > st.close_min then reason := 'The venue takes bookings from ' || public._ampm(st.open_min) || ' to ' || public._ampm(st.close_min) || '.';
    elsif (em - sm) < st.min_hours * 60 then reason := 'The shortest booking is ' || trim_scale(st.min_hours)::text || ' hours.';
    end if;
    mins := case when sm is not null and em is not null and em > sm then em - sm else 0 end;
    if d is not null and sm is not null and em is not null then
      sa := (d::timestamp + make_interval(mins => sm)) at time zone 'Africa/Lagos';
      ea := (d::timestamp + make_interval(mins => em)) at time zone 'Africa/Lagos';
      if reason is null and sa <= now() then reason := 'That time has already passed.'; end if;
    end if;
    fee := case when reason is not null then 0
                when st.allow_hourly then least(t.price, ceil(rate * mins / 60.0)) else t.price end;
    rows := rows || jsonb_build_object('date', d, 'start', case when sm is null then null else public._hhmm(sm) end,
      'end', case when em is null then null else public._hhmm(em) end, 'sm', sm, 'em', em, 'starts_at', sa, 'ends_at', ea,
      'mins', mins, 'fee', fee, 'label', nullif(left(btrim(coalesce(el.v->>'label', '')), 60), ''), 'reason', reason);
  end loop;

  select coalesce(jsonb_agg(e order by e->>'date', (e->>'sm')::int), '[]'::jsonb) into rows from jsonb_array_elements(rows) e;
  n := jsonb_array_length(rows);

  -- sessions of the same booking need the same breathing space as two different events
  prev_end := null;
  for i in 0..n - 1 loop
    ent := rows -> i;
    if ent->>'reason' is null then
      if prev_end is not null and (ent->>'starts_at')::timestamptz < prev_end + make_interval(mins => st.cleanup_min + st.setup_min) then
        rows := jsonb_set(rows, array[i::text, 'reason'], to_jsonb('Leave at least ' || (st.cleanup_min + st.setup_min) || ' minutes between two sessions (clean-up and set-up), or make it one longer session.'::text));
      else
        prev_end := (ent->>'ends_at')::timestamptz;
      end if;
    end if;
  end loop;

  -- find one hall that is free for every session
  for i in 0..n - 1 loop if (rows -> i)->>'reason' is null then has_valid := true; end if; end loop;
  if has_valid then
    for u in select id from property_units where property_id = p_property and active order by label loop
      all_ok := true;
      for i in 0..n - 1 loop
        ent := rows -> i;
        if ent->>'reason' is null and not public._event_unit_free(u.id, (ent->>'starts_at')::timestamptz, (ent->>'ends_at')::timestamptz, st.setup_min, st.cleanup_min, p_exclude) then
          all_ok := false; exit;
        end if;
      end loop;
      if all_ok then v_unit := u.id; exit; end if;
    end loop;
    if v_unit is null then
      for i in 0..n - 1 loop
        ent := rows -> i;
        if ent->>'reason' is null and not exists (
          select 1 from property_units pu where pu.property_id = p_property and pu.active
            and public._event_unit_free(pu.id, (ent->>'starts_at')::timestamptz, (ent->>'ends_at')::timestamptz, st.setup_min, st.cleanup_min, p_exclude)) then
          rows := jsonb_set(rows, array[i::text, 'reason'], to_jsonb('That time is already booked, or too close to another event (the venue needs ' || (st.cleanup_min + st.setup_min) || ' minutes between events). Please pick another time.'::text));
          flagged := flagged + 1;
        end if;
      end loop;
      if flagged = 0 then
        for i in 0..n - 1 loop
          if (rows -> i)->>'reason' is null then
            rows := jsonb_set(rows, array[i::text, 'reason'], to_jsonb('These sessions cannot all be held in the same hall. Please try different times.'::text));
          end if;
        end loop;
      end if;
    end if;
  end if;

  v_ok := v_unit is not null;
  for i in 0..n - 1 loop if (rows -> i)->>'reason' is not null then v_ok := false; end if; end loop;

  select coalesce(sum(least(t.price, s.f)), 0), count(*) into v_total, v_days from (
    select e->>'date' dt, sum((e->>'fee')::numeric) f from jsonb_array_elements(rows) e where e->>'reason' is null group by 1) s;
  select coalesce(sum((e->>'mins')::int), 0) into v_mins from jsonb_array_elements(rows) e where e->>'reason' is null;

  return jsonb_build_object('ok', v_ok, 'unit_id', v_unit, 'sessions', rows, 'sessions_total', v_total, 'minutes', v_mins, 'days', v_days,
    'setup_min', st.setup_min, 'cleanup_min', st.cleanup_min, 'tier_label', t.label, 'max_guests', t.max_guests,
    'tier_price', t.price, 'rate_per_hour', round(rate), 'allow_hourly', st.allow_hourly);
end $$;

-- what the guest sees while building the booking
create or replace function public.quote_event_sessions(p_property_id uuid, p_tier_id uuid, p_sessions jsonb, p_facility_ids uuid[] default null, p_facility_quantities integer[] default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare q jsonb; f jsonb; v_base numeric; v_pct numeric; v_gc numeric;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  q := public._event_sessions_quote(p_property_id, p_tier_id, p_sessions, null);
  f := public._event_facilities_price(p_property_id, p_facility_ids, p_facility_quantities, (q->>'max_guests')::int);
  v_base := (q->>'sessions_total')::numeric + (f->>'total')::numeric;
  select value::numeric into v_pct from platform_settings where key = 'hire_booking_guest_pct';
  v_gc := round(v_base * coalesce(v_pct, 6) / 100, 2);
  return q || jsonb_build_object('facilities_total', (f->>'total')::numeric, 'facilities', f->'selected', 'base_amount', v_base,
    'guest_commission', v_gc, 'total_to_pay', v_base + v_gc);
end $$;

-- the booking itself
create or replace function public.request_event_booking_sessions(
  p_property_id uuid, p_tier_id uuid, p_sessions jsonb, p_event_type text, p_facility_ids uuid[], p_facility_quantities integer[],
  p_guest_full_name text, p_guest_phone text, p_guest_id_document_url text, p_house_rules_acknowledged boolean default false,
  p_wants_music_band boolean default false, p_wants_caterer boolean default false, p_wants_ushers boolean default false, p_number_of_ushers integer default null,
  p_wants_security boolean default false, p_number_of_security integer default null, p_additional_event_requests text default null) returns json
language plpgsql security definer set search_path to 'public' as $$
declare
  q jsonb; f jsonb; el record; v_first date; v_last date; v_when text; v_unit uuid;
  v_base numeric; v_fac numeric; v_guest_pct numeric; v_host_pct numeric; v_guest_comm numeric; v_host_comm numeric; v_total numeric; v_balance numeric;
  v_id uuid; v_host uuid; v_title text; v_has_rules boolean; v_info json; v_lane text; v_manual boolean; v_host_min int; v_pay_min int; v_relay_min int; v_status text; v_expires timestamptz;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  select owner_id, title into v_host, v_title from properties where id = p_property_id;
  select (document_url is not null) into v_has_rules from property_house_rules where property_id = p_property_id;
  if coalesce(v_has_rules, false) and not p_house_rules_acknowledged then
    raise exception 'You must read and acknowledge the real house rules before requesting to book.';
  end if;

  q := public._event_sessions_quote(p_property_id, p_tier_id, p_sessions, null);
  if not (q->>'ok')::boolean then
    raise exception 'dates_unavailable: %', coalesce((select e->>'reason' from jsonb_array_elements(q->'sessions') e where e->>'reason' is not null limit 1), 'Those times are not available.');
  end if;
  f := public._event_facilities_price(p_property_id, p_facility_ids, p_facility_quantities, (q->>'max_guests')::int);
  v_fac := (f->>'total')::numeric;
  v_base := (q->>'sessions_total')::numeric + v_fac;
  v_unit := (q->>'unit_id')::uuid;
  select min((e->>'date')::date), max((e->>'date')::date) into v_first, v_last from jsonb_array_elements(q->'sessions') e;
  v_when := public._sessions_text(q->'sessions');

  select value::numeric into v_guest_pct from platform_settings where key = 'hire_booking_guest_pct';
  select value::numeric into v_host_pct from platform_settings where key = 'hire_booking_host_pct';
  v_guest_pct := coalesce(v_guest_pct, 6); v_host_pct := coalesce(v_host_pct, 4);
  v_host_pct := greatest(v_host_pct - public.host_commission_discount(v_host), 0);
  v_guest_comm := round(v_base * v_guest_pct / 100, 2);
  v_host_comm := round(v_base * v_host_pct / 100, 2);
  v_total := v_base + v_guest_comm;

  v_info := booking_lane_info(v_first);
  v_lane := v_info->>'lane'; v_manual := (v_info->>'manual_relay')::boolean;
  v_host_min := (v_info->>'host_minutes')::int; v_pay_min := (v_info->>'pay_minutes')::int; v_relay_min := (v_info->>'relay_minutes')::int;

  if v_lane in ('soon', 'express') then
    select main_balance into v_balance from wallets where user_id = auth.uid();
    if v_balance is null or v_balance < v_total then raise exception 'insufficient_balance'; end if;
  end if;

  if v_manual then v_status := 'awaiting_admin_relay'; v_expires := now() + make_interval(mins => v_relay_min);
  else v_status := 'pending_host_review'; v_expires := now() + make_interval(mins => v_host_min); end if;

  insert into shortlet_bookings (
    property_id, guest_id, check_in, check_out, total_price, guest_commission_amount, host_commission_amount,
    guests, guest_full_name, guest_phone, guest_id_document_url, status, payment_status, house_rules_acknowledged,
    event_type, selected_tier_label, selected_facilities, facilities_total, booking_lane, hold_expires_at, relay_mode, admin_relayed_at,
    wants_music_band, wants_caterer, wants_ushers, number_of_ushers, wants_security, number_of_security, additional_event_requests,
    time_slots, unit_id
  ) values (
    p_property_id, auth.uid(), v_first, v_last + 1, v_base, v_guest_comm, v_host_comm,
    (q->>'max_guests')::int, p_guest_full_name, p_guest_phone, p_guest_id_document_url, v_status, 'unpaid', p_house_rules_acknowledged,
    p_event_type, q->>'tier_label', f->'selected', v_fac, v_lane, v_expires, case when v_manual then null else 'auto' end, case when v_manual then null else now() end,
    coalesce(p_wants_music_band, false), coalesce(p_wants_caterer, false), coalesce(p_wants_ushers, false), case when p_wants_ushers then p_number_of_ushers end,
    coalesce(p_wants_security, false), case when p_wants_security then p_number_of_security end, nullif(btrim(p_additional_event_requests), ''),
    true, v_unit
  ) returning id into v_id;

  for el in select value as v from jsonb_array_elements(q->'sessions') loop
    begin
      insert into event_slots (booking_id, property_id, unit_id, starts_at, ends_at, label, state, expires_at, setup_min, cleanup_min, fee, created_by)
      values (v_id, p_property_id, v_unit, (el.v->>'starts_at')::timestamptz, (el.v->>'ends_at')::timestamptz, el.v->>'label', 'held', v_expires,
              (q->>'setup_min')::int, (q->>'cleanup_min')::int, (el.v->>'fee')::numeric, auth.uid());
    exception when exclusion_violation then
      raise exception 'dates_unavailable: Someone has just taken one of those times. Please check the times and try again. You have not been charged.';
    end;
  end loop;

  perform notify_user(auth.uid(), '📨 Request received',
    case when v_manual
      then 'CHS has received your request for ' || v_title || ' (' || v_when || ') and will pass it to the venue shortly. Nothing is charged now — you pay only after the venue confirms.'
      else 'Your request for ' || v_title || ' (' || v_when || ') is with the venue, who has ' || booking_duration_text(v_host_min) || ' to reply. Nothing is charged now — you will have ' || booking_duration_text(v_pay_min) || ' to pay once they confirm.' end,
    '/my-bookings');

  if v_manual then
    perform notify_admins_by_domain('owner_buyer_tenant', case when v_lane = 'express' then '⚡ EXPRESS event request — relay to the venue NOW' when v_lane = 'soon' then '🕒 Urgent event request — relay to the venue' else '📋 New event request awaiting your relay' end,
      p_guest_full_name || ' has requested ' || v_title || ': ' || v_when || ' (' || p_event_type || ', ' || fmt_naira(v_total) || ' if confirmed). Relay it from the Shortlet/Hire Bookings tab — it relays automatically in ' || booking_duration_text(v_relay_min) || ' if no one acts.',
      '/admin?tab=shortletbookings');
  else
    perform notify_user(v_host, '🔔 Real new event booking request',
      p_guest_full_name || ' would like ' || v_title || ': ' || v_when || ' (' || (q->>'tier_label') || ', ' || p_event_type || '). Please confirm the times are free within ' || booking_duration_text(v_host_min) || '. The guest has not paid yet — they pay once you confirm.',
      booking_request_link(v_host));
    perform notify_admins_by_domain('owner_buyer_tenant', case when v_lane = 'express' then '⚡ EXPRESS event request' else '🕒 Event request (date soon)' end,
      p_guest_full_name || ' has requested ' || v_title || ': ' || v_when || ' (' || fmt_naira(v_total) || ' if confirmed). Passed straight to the venue, who has ' || booking_duration_text(v_host_min) || ' to reply.',
      '/admin?tab=shortletbookings');
  end if;

  return json_build_object('booking_id', v_id, 'status', v_status, 'lane', v_lane,
    'relay_minutes', case when v_manual then v_relay_min else null end,
    'host_minutes', v_host_min, 'pay_minutes', v_pay_min, 'total_to_pay', v_total,
    'base_amount', v_base, 'facilities_total', v_fac, 'sessions_total', (q->>'sessions_total')::numeric);
end $$;

-- free / busy per day for the booking form
create or replace function public.get_event_availability(p_property_id uuid, p_from date default null, p_days integer default 90) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  st public.property_event_settings; v_from date := coalesce(p_from, public._lagos_date(now())); v_days int := least(greatest(coalesce(p_days, 90), 1), 190);
  res jsonb := '[]'::jsonb; r record; wins jsonb; k int; oc int; cc int; run_start int; prev int;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  st := public._event_settings(p_property_id);
  perform ensure_default_unit(p_property_id);
  perform purge_expired_holds(p_property_id);
  oc := st.open_min / 30; cc := ceil(st.close_min / 30.0)::int;
  for r in
    with days as (select generate_series(v_from::timestamp, (v_from + v_days - 1)::timestamp, interval '1 day')::date as d),
    cells as (select dd.d, g.k, (dd.d::timestamp + make_interval(mins => 30 * g.k)) at time zone 'Africa/Lagos' as cs from days dd, generate_series(oc, cc - 1) as g(k)),
    busy as (
      select c.d, c.k from cells c
      where not exists (
        select 1 from property_units u where u.property_id = p_property_id and u.active
          and not exists (select 1 from event_slots s where s.unit_id = u.id and s.block_range && tstzrange(c.cs, c.cs + interval '30 minutes', '[)') and not (s.state = 'held' and s.expires_at < now()))
          and not exists (select 1 from unit_calendar x where x.unit_id = u.id and not (x.state = 'held' and x.expires_at < now()) and daterange(x.start_date, x.end_date, '[)') @> c.d)))
    select b.d, array_agg(b.k order by b.k) as ks from busy b group by b.d order by b.d
  loop
    wins := '[]'::jsonb; run_start := null; prev := null;
    foreach k in array r.ks loop
      if run_start is null then run_start := k; prev := k;
      elsif k = prev + 1 then prev := k;
      else
        wins := wins || jsonb_build_object('from', public._hhmm(run_start * 30), 'to', public._hhmm(least((prev + 1) * 30, st.close_min)));
        run_start := k; prev := k;
      end if;
    end loop;
    wins := wins || jsonb_build_object('from', public._hhmm(run_start * 30), 'to', public._hhmm(least((prev + 1) * 30, st.close_min)));
    res := res || jsonb_build_object('date', r.d, 'full_day', array_length(r.ks, 1) = (cc - oc), 'busy', wins);
  end loop;
  return jsonb_build_object('rules', jsonb_build_object('allow_hourly', st.allow_hourly, 'min_hours', st.min_hours, 'open', public._hhmm(st.open_min), 'close', public._hhmm(st.close_min),
    'setup_min', st.setup_min, 'cleanup_min', st.cleanup_min, 'full_day_hours', st.full_day_hours, 'max_sessions', st.max_sessions), 'days', res);
end $$;

-- host: the rules of this venue
create or replace function public.get_event_settings(p_property_id uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare st public.property_event_settings;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  st := public._event_settings(p_property_id);
  return jsonb_build_object('allow_hourly', st.allow_hourly, 'min_hours', st.min_hours, 'open', public._hhmm(st.open_min), 'close', public._hhmm(st.close_min),
    'setup_min', st.setup_min, 'cleanup_min', st.cleanup_min, 'full_day_hours', st.full_day_hours, 'max_sessions', st.max_sessions);
end $$;

create or replace function public.set_event_settings(p_property_id uuid, p_allow_hourly boolean, p_min_hours numeric, p_open text, p_close text, p_setup_min integer, p_cleanup_min integer, p_full_day_hours numeric, p_max_sessions integer) returns void
language plpgsql security definer set search_path to 'public' as $$
declare o int := public._parse_hhmm(p_open); c int := public._parse_hhmm(p_close);
begin
  if coalesce(public.my_property_role(p_property_id), 'none') not in ('owner', 'manager') and not public.is_admin() then raise exception 'Only the host or a manager can change this.'; end if;
  if o is null or c is null or o >= 1440 or c <= o then raise exception 'Choose an opening time that is earlier than the closing time (24:00 means midnight).'; end if;
  if p_min_hours is null or p_min_hours <= 0 or p_min_hours > 24 then raise exception 'The shortest booking must be between a little more than 0 and 24 hours.'; end if;
  if p_setup_min is null or p_setup_min < 0 or p_setup_min > 480 or p_cleanup_min is null or p_cleanup_min < 0 or p_cleanup_min > 480 then raise exception 'Set-up and clean-up time must be between 0 and 480 minutes.'; end if;
  if p_full_day_hours is null or p_full_day_hours < 1 or p_full_day_hours > 24 then raise exception 'A full day must be between 1 and 24 hours.'; end if;
  if p_max_sessions is null or p_max_sessions < 1 or p_max_sessions > 30 then raise exception 'Sessions in one booking must be between 1 and 30.'; end if;
  perform public._event_settings(p_property_id);
  update property_event_settings set allow_hourly = coalesce(p_allow_hourly, true), min_hours = p_min_hours, open_min = o, close_min = c,
    setup_min = p_setup_min, cleanup_min = p_cleanup_min, full_day_hours = p_full_day_hours, max_sessions = p_max_sessions, updated_at = now()
  where property_id = p_property_id;
  perform log_audit_event('event_settings', 'property_event_settings', p_property_id, 'updated', null);
end $$;

-- host: set the hourly rate of a hall tier (empty = the day price spread over a full day)
create or replace function public.set_tier_hourly_price(p_tier_id uuid, p_hourly numeric) returns void
language plpgsql security definer set search_path to 'public' as $$
declare t record;
begin
  select * into t from event_capacity_tiers where id = p_tier_id;
  if not found then raise exception 'That hall tier does not exist.'; end if;
  if coalesce(public.my_property_role(t.property_id), 'none') not in ('owner', 'manager') and not public.is_admin() then raise exception 'Only the host or a manager can change prices.'; end if;
  if p_hourly is not null and (p_hourly < 0 or p_hourly > 1000000000) then raise exception 'Enter a sensible hourly price.'; end if;
  update event_capacity_tiers set hourly_price = p_hourly where id = p_tier_id;
end $$;

-- sessions of one booking (guest, the venue's team, or an admin)
create or replace function public.get_booking_sessions(p_booking uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare b record;
begin
  select guest_id, property_id into b from shortlet_bookings where id = p_booking;
  if not found then return '[]'::jsonb; end if;
  if b.guest_id <> auth.uid() and coalesce(public.my_property_role(b.property_id), 'none') = 'none' and not public.is_admin() then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'date', public._lagos_date(s.starts_at),
      'start', to_char(s.starts_at at time zone 'Africa/Lagos', 'HH24:MI'),
      'end', case when public._lagos_date(s.ends_at) > public._lagos_date(s.starts_at) then '24:00' else to_char(s.ends_at at time zone 'Africa/Lagos', 'HH24:MI') end,
      'label', s.label, 'fee', s.fee, 'state', s.state) order by s.starts_at) from event_slots s where s.booking_id = p_booking), '[]'::jsonb);
end $$;

-- host: sessions and hour-blocks on a calendar range
create or replace function public.get_host_event_slots(p_property_id uuid, p_from date default null, p_to date default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_from date := coalesce(p_from, public._lagos_date(now())); v_to date := coalesce(p_to, coalesce(p_from, public._lagos_date(now())) + 120);
begin
  if coalesce(public.my_property_role(p_property_id), 'none') in ('none', 'accountant') and not public.is_admin() then raise exception 'Not allowed.'; end if;
  perform purge_expired_holds(p_property_id);
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'booking_id', s.booking_id, 'date', public._lagos_date(s.starts_at),
      'start', to_char(s.starts_at at time zone 'Africa/Lagos', 'HH24:MI'),
      'end', case when public._lagos_date(s.ends_at) > public._lagos_date(s.starts_at) then '24:00' else to_char(s.ends_at at time zone 'Africa/Lagos', 'HH24:MI') end,
      'label', s.label, 'state', s.state, 'kind', case when s.booking_id is null then 'block' else 'booking' end,
      'guest', b.guest_full_name, 'event_type', b.event_type, 'booking_status', b.status) order by s.starts_at)
    from event_slots s left join shortlet_bookings b on b.id = s.booking_id
    where s.property_id = p_property_id and public._lagos_date(s.starts_at) between v_from and v_to), '[]'::jsonb);
end $$;

-- host: block a few hours (own use, repairs) without closing the whole day
create or replace function public.host_block_hours(p_property_id uuid, p_date date, p_start text, p_end text, p_note text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare sm int := public._parse_hhmm(p_start); em int := public._parse_hhmm(p_end); u record; v_n int := 0;
begin
  if coalesce(public.my_property_role(p_property_id), 'none') not in ('owner', 'manager') and not public.is_admin() then raise exception 'Only the host or a manager can block time.'; end if;
  if p_date is null or p_date < public._lagos_date(now()) then raise exception 'Choose a date that has not passed.'; end if;
  if sm is null or em is null or em <= sm then raise exception 'The end time must be after the start time.'; end if;
  perform purge_expired_holds(p_property_id);
  perform ensure_default_unit(p_property_id);
  for u in select id from property_units where property_id = p_property_id and active loop
    begin
      insert into event_slots (booking_id, property_id, unit_id, starts_at, ends_at, label, state, created_by)
      values (null, p_property_id, u.id, (p_date::timestamp + make_interval(mins => sm)) at time zone 'Africa/Lagos', (p_date::timestamp + make_interval(mins => em)) at time zone 'Africa/Lagos',
              coalesce(nullif(left(btrim(coalesce(p_note, '')), 60), ''), 'Blocked'), 'blocked', auth.uid());
      v_n := v_n + 1;
    exception when exclusion_violation then
      raise exception 'That time overlaps a booking (or its set-up / clean-up time). Pick a time that is free.';
    end;
  end loop;
end $$;

create or replace function public.host_unblock_hours(p_slot uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare s record;
begin
  select * into s from event_slots where id = p_slot;
  if not found or s.booking_id is not null or s.state <> 'blocked' then raise exception 'That is not a blocked time.'; end if;
  if coalesce(public.my_property_role(s.property_id), 'none') not in ('owner', 'manager') and not public.is_admin() then raise exception 'Only the host or a manager can unblock time.'; end if;
  execute format('%s from event_slots where property_id = $1 and booking_id is null and state = ''blocked'' and starts_at = $2 and ends_at = $3', chr(100) || 'elete') using s.property_id, s.starts_at, s.ends_at;
end $$;

-- date moves keep working: the whole event moves by the same number of days, times unchanged
create or replace function public._move_booking_calendar(p_booking uuid, p_in date, p_out date) returns void
language plpgsql security definer set search_path to 'public' as $$
declare b record; delta int;
begin
  select * into b from shortlet_bookings where id = p_booking;
  if b.time_slots then
    delta := p_in - b.check_in;
    if delta <> 0 then
      set constraints public.event_slots_no_overlap deferred;
      update event_slots set starts_at = starts_at + make_interval(days => delta), ends_at = ends_at + make_interval(days => delta) where booking_id = p_booking;
      set constraints public.event_slots_no_overlap immediate;
    end if;
  else
    update unit_calendar set start_date = p_in, end_date = p_out where booking_id = p_booking;
  end if;
end $$;

create or replace function public._booking_dates_free(p_booking uuid, p_in date, p_out date) returns boolean
language plpgsql security definer set search_path to 'public' as $function$
declare b record; delta int;
begin
  select * into b from shortlet_bookings where id = p_booking;
  if not found then return false; end if;
  perform purge_expired_holds(b.property_id);
  if b.time_slots then
    delta := p_in - b.check_in;
    return not exists (
      select 1 from event_slots s where s.booking_id = b.id
        and not public._event_unit_free(s.unit_id, s.starts_at + make_interval(days => delta), s.ends_at + make_interval(days => delta), s.setup_min, s.cleanup_min, b.id));
  end if;
  return not exists (
    select 1 from unit_calendar c
    where c.unit_id = b.unit_id and c.booking_id is distinct from b.id
      and daterange(c.start_date, c.end_date, '[)') && daterange(p_in, p_out, '[)')
  ) and not exists (
    select 1 from event_slots s
    where s.unit_id = b.unit_id and not (s.state = 'held' and s.expires_at < now())
      and daterange(public._lagos_date(s.starts_at), public._lagos_date(s.ends_at - interval '1 second') + 1, '[)') && daterange(p_in, p_out, '[)')
  );
end $function$;

-- what a session booking would cost on another hall tier (used when a guest upgrades or downgrades)
create or replace function public._slots_total_for_tier(p_booking uuid, p_tier uuid) returns numeric
language plpgsql security definer set search_path to 'public' as $$
declare t record; st public.property_event_settings; rate numeric; v numeric;
begin
  select * into t from event_capacity_tiers where id = p_tier;
  if not found then return 0; end if;
  st := public._event_settings(t.property_id);
  rate := coalesce(t.hourly_price, t.price / st.full_day_hours);
  select coalesce(sum(least(t.price, x.f)), 0) into v from (
    select public._lagos_date(starts_at) d,
      sum(case when st.allow_hourly then least(t.price, ceil(rate * extract(epoch from (ends_at - starts_at)) / 3600.0)) else t.price end) f
    from event_slots where booking_id = p_booking group by 1) x;
  return v;
end $$;

-- hook the move helper and tier maths into the existing change / no-fault flows
do $do$
declare v_def text; v_new text;
begin
  v_def := pg_get_functiondef('public._apply_booking_change(uuid)'::regprocedure);
  v_new := replace(v_def, 'update unit_calendar set start_date = r.new_check_in, end_date = r.new_check_out where booking_id = b.id;', 'perform public._move_booking_calendar(b.id, r.new_check_in, r.new_check_out);');
  if v_new = v_def then raise exception 'patch 1 did not apply'; end if;
  execute v_new;

  v_def := pg_get_functiondef('public._claim_reschedule(uuid,text)'::regprocedure);
  v_new := replace(v_def, 'update unit_calendar set start_date = c.new_check_in, end_date = c.new_check_out where booking_id = b.id;', 'perform public._move_booking_calendar(b.id, c.new_check_in, c.new_check_out);');
  if v_new = v_def then raise exception 'patch 2 did not apply'; end if;
  execute v_new;

  v_def := pg_get_functiondef('public.host_decide_change(uuid,text,text,uuid,numeric)'::regprocedure);
  v_new := replace(v_def, 'select price into v_new_price from event_capacity_tiers where id = p_tier_id and property_id = r.property_id;',
    'select case when b.time_slots then public._slots_total_for_tier(b.id, id) else price end into v_new_price from event_capacity_tiers where id = p_tier_id and property_id = r.property_id;');
  if v_new = v_def then raise exception 'patch 3 did not apply'; end if;
  v_def := v_new;
  v_new := replace(v_def, 'select price into v_old_price from event_capacity_tiers where property_id = r.property_id and label = b.selected_tier_label limit 1;',
    'select case when b.time_slots then public._slots_total_for_tier(b.id, id) else price end into v_old_price from event_capacity_tiers where property_id = r.property_id and label = b.selected_tier_label limit 1;');
  if v_new = v_def then raise exception 'patch 4 did not apply'; end if;
  execute v_new;
end $do$;

-- permissions: internal helpers stay private, screens call the public ones
revoke execute on function public._hhmm(int), public._parse_hhmm(text), public._ampm(int), public._sessions_text(jsonb), public._event_settings(uuid),
  public._event_unit_free(uuid, timestamptz, timestamptz, int, int, uuid), public._event_facilities_price(uuid, uuid[], integer[], integer),
  public._event_sessions_quote(uuid, uuid, jsonb, uuid), public._move_booking_calendar(uuid, date, date), public._slots_total_for_tier(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.quote_event_sessions(uuid, uuid, jsonb, uuid[], integer[]), public.request_event_booking_sessions(uuid, uuid, jsonb, text, uuid[], integer[], text, text, text, boolean, boolean, boolean, boolean, integer, boolean, integer, text),
  public.get_event_availability(uuid, date, integer), public.get_event_settings(uuid), public.set_event_settings(uuid, boolean, numeric, text, text, integer, integer, numeric, integer),
  public.set_tier_hourly_price(uuid, numeric), public.get_booking_sessions(uuid), public.get_host_event_slots(uuid, date, date),
  public.host_block_hours(uuid, date, text, text, text), public.host_unblock_hours(uuid) from public, anon;
grant execute on function public.quote_event_sessions(uuid, uuid, jsonb, uuid[], integer[]), public.request_event_booking_sessions(uuid, uuid, jsonb, text, uuid[], integer[], text, text, text, boolean, boolean, boolean, boolean, integer, boolean, integer, text),
  public.get_event_availability(uuid, date, integer), public.get_event_settings(uuid), public.set_event_settings(uuid, boolean, numeric, text, text, integer, integer, numeric, integer),
  public.set_tier_hourly_price(uuid, numeric), public.get_booking_sessions(uuid), public.get_host_event_slots(uuid, date, date),
  public.host_block_hours(uuid, date, text, text, text), public.host_unblock_hours(uuid) to authenticated;
