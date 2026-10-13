-- 488 HOST CONSOLE (Oct 13 2026)
-- 1. Every host notification about a booking now opens the Host console (not the Owner dashboard).
-- 2. booking_services: each service a guest asks for (ushers, caterer, live band, security, others) with the
--    host's answer (we supply / guest arranges / cannot provide). The guest sees the answer.
-- 3. booking_change_requests: a guest asks to change the number of guests or add services after booking;
--    the host approves or declines; the guest is told.
-- 4. get_host_console(): one read for the whole host screen (requests, awaiting payment, paid and deposits,
--    changes, services, stays), for the owner and for staff with a role on the property.
-- All new tables are RPC-only (RLS on, no policies, no grants).

create or replace function public.booking_request_link(p_user uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select '/host?tab=requests'::text;
$$;

create table if not exists public.booking_services (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.shortlet_bookings(id),
  property_id uuid not null,
  service text not null check (service ~ '^[a-z_]{2,30}$'),
  quantity integer check (quantity is null or (quantity between 1 and 5000)),
  status text not null default 'requested' check (status in ('requested','supplied','guest_arranges','declined','cancelled')),
  provider_name text,
  price numeric check (price is null or price >= 0),
  note text,
  source text not null default 'guest',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, service)
);
alter table public.booking_services enable row level security;
revoke all on public.booking_services from anon, authenticated;

create table if not exists public.booking_change_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.shortlet_bookings(id),
  property_id uuid not null,
  requested_by uuid not null,
  old_guests integer,
  new_guests integer check (new_guests is null or (new_guests between 1 and 100000)),
  services jsonb not null default '[]'::jsonb,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','declined','withdrawn')),
  host_note text,
  over_capacity boolean not null default false,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.booking_change_requests enable row level security;
revoke all on public.booking_change_requests from anon, authenticated;

create or replace function public._service_label(p_service text) returns text language sql immutable as $$
  select case p_service
    when 'ushers' then 'Ushers' when 'caterer' then 'Caterer' when 'band' then 'Live band / entertainment'
    when 'security' then 'Security' when 'decoration' then 'Decoration' when 'mc' then 'MC'
    when 'photographer' then 'Photographer' when 'dj' then 'DJ / sound' when 'parking' then 'Parking attendants'
    when 'other' then 'Other request' else initcap(replace(p_service, '_', ' ')) end;
$$;

-- turn the flags on a booking into service lines (safe to call again)
create or replace function public._sync_booking_services(p_booking uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare b record;
begin
  select * into b from shortlet_bookings where id = p_booking;
  if not found then return; end if;
  if coalesce(b.wants_ushers, false) then
    insert into booking_services(booking_id, property_id, service, quantity, source) values (b.id, b.property_id, 'ushers', b.number_of_ushers, 'guest') on conflict do nothing;
  end if;
  if coalesce(b.wants_caterer, false) then
    insert into booking_services(booking_id, property_id, service, source) values (b.id, b.property_id, 'caterer', 'guest') on conflict do nothing;
  end if;
  if coalesce(b.wants_music_band, false) then
    insert into booking_services(booking_id, property_id, service, source) values (b.id, b.property_id, 'band', 'guest') on conflict do nothing;
  end if;
  if coalesce(b.wants_security, false) then
    insert into booking_services(booking_id, property_id, service, quantity, source) values (b.id, b.property_id, 'security', b.number_of_security, 'guest') on conflict do nothing;
  end if;
  if nullif(trim(coalesce(b.additional_event_requests, '')), '') is not null then
    insert into booking_services(booking_id, property_id, service, note, source) values (b.id, b.property_id, 'other', trim(b.additional_event_requests), 'guest') on conflict do nothing;
  end if;
end $$;

create or replace function public.get_booking_services_host(p_booking uuid) returns json
language plpgsql security definer set search_path to 'public' as $$
declare v_prop uuid;
begin
  select property_id into v_prop from shortlet_bookings where id = p_booking;
  if v_prop is null or not public.can_manage_arrivals(v_prop) then raise exception 'You do not have access to this booking.'; end if;
  perform public._sync_booking_services(p_booking);
  return coalesce((select json_agg(json_build_object('id', s.id, 'service', s.service, 'label', public._service_label(s.service), 'quantity', s.quantity,
    'status', s.status, 'provider_name', s.provider_name, 'price', s.price, 'note', s.note, 'source', s.source, 'decided_at', s.decided_at) order by s.created_at)
    from booking_services s where s.booking_id = p_booking), '[]'::json);
end $$;

create or replace function public.get_my_booking_services(p_booking uuid) returns json
language plpgsql security definer set search_path to 'public' as $$
declare v_guest uuid;
begin
  select guest_id into v_guest from shortlet_bookings where id = p_booking;
  if v_guest is null or v_guest <> auth.uid() then raise exception 'This is not your booking.'; end if;
  perform public._sync_booking_services(p_booking);
  return coalesce((select json_agg(json_build_object('id', s.id, 'service', s.service, 'label', public._service_label(s.service), 'quantity', s.quantity,
    'status', s.status, 'provider_name', s.provider_name, 'price', s.price, 'note', s.note, 'decided_at', s.decided_at) order by s.created_at)
    from booking_services s where s.booking_id = p_booking), '[]'::json);
end $$;

-- the host (owner or manager) answers a service request
create or replace function public.host_set_service(p_booking uuid, p_service text, p_status text, p_quantity integer default null,
  p_price numeric default null, p_provider text default null, p_note text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare b record; v_role text; v_title text; v_label text; v_msg text;
begin
  select * into b from shortlet_bookings where id = p_booking;
  if not found then raise exception 'This booking does not exist.'; end if;
  v_role := coalesce(public.my_property_role(b.property_id), 'none');
  if v_role not in ('owner', 'manager') then raise exception 'Only the host or a manager can answer service requests.'; end if;
  if p_status not in ('supplied', 'guest_arranges', 'declined', 'requested') then raise exception 'Not a recognised answer.'; end if;
  if b.status in ('cancelled', 'declined', 'expired') then raise exception 'This booking is closed.'; end if;
  if p_status = 'declined' and nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'Please give the guest a short reason when you cannot provide a service.'; end if;
  if p_price is not null and p_price < 0 then raise exception 'Price cannot be negative.'; end if;
  perform public._sync_booking_services(p_booking);
  insert into booking_services(booking_id, property_id, service, quantity, status, provider_name, price, note, source, decided_by, decided_at)
  values (p_booking, b.property_id, p_service, p_quantity, p_status, nullif(trim(coalesce(p_provider, '')), ''), p_price, nullif(trim(coalesce(p_note, '')), ''), 'host', auth.uid(), now())
  on conflict (booking_id, service) do update set status = excluded.status, quantity = coalesce(excluded.quantity, booking_services.quantity),
    provider_name = excluded.provider_name, price = excluded.price, note = excluded.note, decided_by = auth.uid(), decided_at = now(), updated_at = now();
  select title into v_title from properties where id = b.property_id;
  v_label := public._service_label(p_service);
  v_msg := case p_status
    when 'supplied' then v_label || ' for ' || v_title || ' (' || b.check_in || '): the venue will supply this.' || case when p_price is not null then ' Price: ' || fmt_naira(p_price) || ', agreed with the venue.' else '' end
    when 'guest_arranges' then v_label || ' for ' || v_title || ' (' || b.check_in || '): the venue says you arrange this yourself.'
    when 'declined' then v_label || ' for ' || v_title || ' (' || b.check_in || '): the venue cannot provide this.'
    else v_label || ' for ' || v_title || ' is back under review.' end
    || case when nullif(trim(coalesce(p_note, '')), '') is not null then E'\nNote: ' || trim(p_note) else '' end;
  perform notify_user(b.guest_id, case p_status when 'supplied' then '✓ Service confirmed: ' when 'declined' then 'Service not available: ' else 'Service update: ' end || v_label, v_msg, '/my-bookings?b=' || b.id);
  perform log_audit_event('booking_service_set', 'booking_services', b.id, p_service, jsonb_build_object('status', p_status));
end $$;

-- the guest adds a service after booking, or changes the quantity
create or replace function public.guest_add_service(p_booking uuid, p_service text, p_quantity integer default null, p_note text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare b record; v_host uuid; v_title text;
begin
  select * into b from shortlet_bookings where id = p_booking;
  if not found or b.guest_id <> auth.uid() then raise exception 'This is not your booking.'; end if;
  if b.status not in ('pending_host_review', 'awaiting_payment', 'confirmed') then raise exception 'You can only add services to a live booking.'; end if;
  if b.check_out < (now() at time zone 'Africa/Lagos')::date then raise exception 'This booking has already ended.'; end if;
  if p_service !~ '^[a-z_]{2,30}$' or p_service not in ('ushers','caterer','band','security','decoration','mc','photographer','dj','parking','other') then raise exception 'Not a recognised service.'; end if;
  perform public._sync_booking_services(p_booking);
  insert into booking_services(booking_id, property_id, service, quantity, status, note, source)
  values (p_booking, b.property_id, p_service, p_quantity, 'requested', nullif(trim(coalesce(p_note, '')), ''), 'guest')
  on conflict (booking_id, service) do update set quantity = coalesce(excluded.quantity, booking_services.quantity),
    note = coalesce(excluded.note, booking_services.note), status = 'requested', decided_at = null, updated_at = now();
  select owner_id, title into v_host, v_title from properties where id = b.property_id;
  perform notify_user(v_host, '🙋 New service request: ' || public._service_label(p_service),
    b.guest_full_name || ' asked for ' || public._service_label(p_service) || coalesce(' (' || p_quantity || ')', '') || ' for ' || v_title || ' on ' || b.check_in || '. Please say whether you can supply it.', '/host?tab=services');
end $$;

create or replace function public.guest_cancel_service(p_booking uuid, p_service text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare b record; v_host uuid;
begin
  select * into b from shortlet_bookings where id = p_booking;
  if not found or b.guest_id <> auth.uid() then raise exception 'This is not your booking.'; end if;
  update booking_services set status = 'cancelled', updated_at = now() where booking_id = p_booking and service = p_service and status <> 'cancelled';
  select owner_id into v_host from properties where id = b.property_id;
  perform notify_user(v_host, 'Service request withdrawn: ' || public._service_label(p_service), b.guest_full_name || ' no longer needs ' || public._service_label(p_service) || ' on ' || b.check_in || '.', '/host?tab=services');
end $$;

-- change requests
create or replace function public.request_booking_change(p_booking uuid, p_new_guests integer default null, p_services jsonb default '[]'::jsonb, p_note text default null) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare b record; v_id uuid; v_host uuid; v_title text; v_max integer; v_over boolean := false; v_text text;
begin
  select * into b from shortlet_bookings where id = p_booking;
  if not found or b.guest_id <> auth.uid() then raise exception 'This is not your booking.'; end if;
  if b.status not in ('awaiting_payment', 'confirmed') then raise exception 'Changes can be asked for once the host has confirmed the dates.'; end if;
  if b.check_in < (now() at time zone 'Africa/Lagos')::date then raise exception 'This booking has already started.'; end if;
  if p_new_guests is null and jsonb_array_length(coalesce(p_services, '[]'::jsonb)) = 0 and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'Tell the host what you would like to change.';
  end if;
  if p_new_guests is not null and (p_new_guests < 1 or p_new_guests > 100000) then raise exception 'Please give a sensible number of guests.'; end if;
  if exists (select 1 from booking_change_requests where booking_id = p_booking and status = 'pending') then
    raise exception 'You already have a change waiting for the host. Please wait for the answer or withdraw it first.';
  end if;
  if p_new_guests is not null and b.selected_tier_label is not null then
    select max_guests into v_max from event_capacity_tiers where property_id = b.property_id and label = b.selected_tier_label limit 1;
    v_over := v_max is not null and p_new_guests > v_max;
  end if;
  insert into booking_change_requests(booking_id, property_id, requested_by, old_guests, new_guests, services, note, over_capacity)
  values (p_booking, b.property_id, auth.uid(), b.guests, p_new_guests, coalesce(p_services, '[]'::jsonb), nullif(trim(coalesce(p_note, '')), ''), v_over) returning id into v_id;
  select owner_id, title into v_host, v_title from properties where id = b.property_id;
  v_text := b.guest_full_name || ' asked to change the booking for ' || v_title || ' (' || b.check_in || ')'
    || case when p_new_guests is not null then ': guests ' || coalesce(b.guests::text, '?') || ' to ' || p_new_guests else '' end
    || case when v_over then ' (more than the hall tier allows: ' || v_max || ')' else '' end || '.';
  perform notify_user(v_host, '✏️ Change request on a booking', v_text || ' Please approve or decline.', '/host?tab=changes');
  return v_id;
end $$;

create or replace function public.withdraw_booking_change(p_request uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  update booking_change_requests set status = 'withdrawn', decided_at = now() where id = p_request and requested_by = auth.uid() and status = 'pending';
  if not found then raise exception 'That change request cannot be withdrawn.'; end if;
end $$;

create or replace function public.host_decide_change(p_request uuid, p_decision text, p_note text default null) returns json
language plpgsql security definer set search_path to 'public' as $$
declare r record; b record; v_role text; v_title text; s jsonb; v_svc text; v_qty integer; v_body text;
begin
  select * into r from booking_change_requests where id = p_request for update;
  if not found then raise exception 'This change request does not exist.'; end if;
  v_role := coalesce(public.my_property_role(r.property_id), 'none');
  if v_role not in ('owner', 'manager') then raise exception 'Only the host or a manager can answer change requests.'; end if;
  if r.status <> 'pending' then raise exception 'This change was already answered (%).', r.status; end if;
  if p_decision not in ('approved', 'declined') then raise exception 'Not a recognised decision.'; end if;
  if p_decision = 'declined' and nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'Please give the guest a short reason.'; end if;
  select * into b from shortlet_bookings where id = r.booking_id for update;
  select title into v_title from properties where id = r.property_id;
  update booking_change_requests set status = p_decision, host_note = nullif(trim(coalesce(p_note, '')), ''), decided_by = auth.uid(), decided_at = now() where id = r.id;
  if p_decision = 'approved' then
    if r.new_guests is not null then update shortlet_bookings set guests = r.new_guests where id = b.id; end if;
    for s in select * from jsonb_array_elements(r.services) loop
      v_svc := s->>'service'; v_qty := nullif(s->>'quantity', '')::integer;
      if v_svc in ('ushers','caterer','band','security','decoration','mc','photographer','dj','parking','other') then
        insert into booking_services(booking_id, property_id, service, quantity, status, note, source)
        values (b.id, r.property_id, v_svc, v_qty, 'requested', nullif(s->>'note', ''), 'guest')
        on conflict (booking_id, service) do update set quantity = coalesce(excluded.quantity, booking_services.quantity), status = 'requested', updated_at = now();
      end if;
    end loop;
  end if;
  if p_decision = 'approved' then
    v_body := 'About ' || v_title || ' (' || b.check_in || '): the venue approved your change' || case when r.new_guests is not null then ' to ' || r.new_guests || ' guests' else '' end || '.'
      || case when r.over_capacity then ' The venue may send you a revised quotation for the larger hall or extra facilities.' else '' end;
  else
    v_body := 'About ' || v_title || ' (' || b.check_in || '): the venue could not accept your change.';
  end if;
  if nullif(trim(coalesce(p_note, '')), '') is not null then v_body := v_body || E'\nNote: ' || trim(p_note); end if;
  perform notify_user(b.guest_id, case p_decision when 'approved' then '✓ Your change was approved' else 'Your change was not approved' end, v_body, '/my-bookings?b=' || b.id);
  perform log_audit_event('booking_change_decided', 'booking_change_requests', r.id, p_decision, jsonb_build_object('new_guests', r.new_guests));
  return json_build_object('status', p_decision, 'over_capacity', r.over_capacity);
end $$;

create or replace function public.get_my_booking_changes(p_booking uuid) returns json
language plpgsql security definer set search_path to 'public' as $$
declare v_guest uuid;
begin
  select guest_id into v_guest from shortlet_bookings where id = p_booking;
  if v_guest is null or v_guest <> auth.uid() then raise exception 'This is not your booking.'; end if;
  return coalesce((select json_agg(json_build_object('id', c.id, 'old_guests', c.old_guests, 'new_guests', c.new_guests, 'services', c.services, 'note', c.note,
    'status', c.status, 'host_note', c.host_note, 'created_at', c.created_at, 'decided_at', c.decided_at) order by c.created_at desc)
    from booking_change_requests c where c.booking_id = p_booking), '[]'::json);
end $$;

-- the whole host screen in one read
create or replace function public.get_host_console() returns json
language plpgsql security definer set search_path to 'public' as $$
declare v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  return (
    with props as (
      select p.id, p.title, p.property_type, p.hire_category,
        case when p.hire_category = 'event_centre' or p.property_type ilike '%event%' then 'event'
             when p.hire_category = 'hotel_lodge' then 'hotel'
             when p.purpose = 'shortlet' then 'shortlet' else 'other' end as cat,
        coalesce(public.my_property_role(p.id), 'none') as myrole
      from properties p
      where (p.purpose = 'shortlet' or (p.purpose = 'hire' and p.hire_category is not null))
        and coalesce(public.my_property_role(p.id), 'none') not in ('none', 'accountant')
    ), bk as (
      select b.*, pr.title as ptitle, pr.cat, pr.myrole
      from shortlet_bookings b join props pr on pr.id = b.property_id
      where b.status in ('pending_host_review', 'awaiting_payment', 'confirmed')
         or (b.status in ('cancelled', 'declined', 'expired') and b.created_at > now() - interval '30 days')
    ), qt as (
      select q.booking_id, q.status as qstatus, q.total,
        (select coalesce(sum(m.amount), 0) from event_quote_milestones m where m.quote_id = q.id and m.paid_at is not null) as paid,
        (select count(*) from event_quote_milestones m where m.quote_id = q.id) as nms,
        (select count(*) from event_quote_milestones m where m.quote_id = q.id and m.paid_at is not null) as nms_paid
      from event_quotes q where q.status in ('sent', 'accepted')
    )
    select json_build_object(
      'categories', (select coalesce(json_agg(distinct cat), '[]'::json) from props),
      'properties', (select coalesce(json_agg(json_build_object('id', id, 'title', title, 'cat', cat, 'role', myrole)), '[]'::json) from props),
      'bookings', (select coalesce(json_agg(json_build_object(
        'id', bk.id, 'ref', 'REQ-' || substr(bk.id::text, 1, 8), 'property_id', bk.property_id, 'property_title', bk.ptitle, 'cat', bk.cat, 'my_role', bk.myrole,
        'status', bk.status, 'payment_status', bk.payment_status, 'check_in', bk.check_in, 'check_out', bk.check_out, 'guests', bk.guests,
        'guest_name', bk.guest_full_name, 'guest_id', bk.guest_id, 'guest_verified', coalesce(bk.guest_verified, false),
        'total_price', bk.total_price, 'host_commission', bk.host_commission_amount, 'net', bk.total_price - coalesce(bk.host_commission_amount, 0),
        'deposit_amount', bk.security_deposit_amount, 'deposit_status', bk.security_deposit_status,
        'event_type', bk.event_type, 'tier', bk.selected_tier_label, 'facilities_total', bk.facilities_total,
        'expires_at', bk.hold_expires_at, 'created_at', bk.created_at, 'paid_at', bk.paid_at, 'arrived_at', bk.arrived_at, 'checked_in_at', bk.checked_in_at,
        'expected_arrival_time', bk.expected_arrival_time, 'lane', bk.booking_lane,
        'wants_band', bk.wants_music_band, 'wants_caterer', bk.wants_caterer, 'wants_ushers', bk.wants_ushers, 'ushers', bk.number_of_ushers,
        'wants_security', bk.wants_security, 'security', bk.number_of_security, 'extra', bk.additional_event_requests,
        'quote', (select json_build_object('status', qt.qstatus, 'total', qt.total, 'paid', qt.paid, 'milestones', qt.nms, 'milestones_paid', qt.nms_paid) from qt where qt.booking_id = bk.id limit 1),
        'services_open', (select count(*) from booking_services s where s.booking_id = bk.id and s.status = 'requested'),
        'changes_open', (select count(*) from booking_change_requests c where c.booking_id = bk.id and c.status = 'pending')
      ) order by bk.check_in), '[]'::json) from bk),
      'changes', (select coalesce(json_agg(json_build_object('id', c.id, 'booking_id', c.booking_id, 'property_title', pr.title, 'cat', pr.cat, 'my_role', pr.myrole,
        'guest_name', b.guest_full_name, 'check_in', b.check_in, 'old_guests', c.old_guests, 'new_guests', c.new_guests, 'services', c.services, 'note', c.note,
        'status', c.status, 'host_note', c.host_note, 'over_capacity', c.over_capacity, 'tier', b.selected_tier_label, 'created_at', c.created_at, 'decided_at', c.decided_at)
        order by (c.status = 'pending') desc, c.created_at desc), '[]'::json)
        from booking_change_requests c join props pr on pr.id = c.property_id join shortlet_bookings b on b.id = c.booking_id
        where c.status = 'pending' or c.created_at > now() - interval '30 days'),
      'services', (select coalesce(json_agg(json_build_object('booking_id', s.booking_id, 'service', s.service, 'label', public._service_label(s.service), 'quantity', s.quantity,
        'status', s.status, 'provider_name', s.provider_name, 'price', s.price, 'note', s.note, 'property_title', pr.title, 'cat', pr.cat, 'my_role', pr.myrole,
        'guest_name', b.guest_full_name, 'check_in', b.check_in, 'booking_status', b.status)
        order by (s.status = 'requested') desc, b.check_in), '[]'::json)
        from booking_services s join props pr on pr.id = s.property_id join shortlet_bookings b on b.id = s.booking_id
        where b.status in ('pending_host_review', 'awaiting_payment', 'confirmed') and b.check_out >= v_today and s.status <> 'cancelled')
    )
  );
end $$;

-- flags that have not become lines yet should still show as requested: sync on read for the host's live bookings
create or replace function public.host_sync_all_services() returns void
language plpgsql security definer set search_path to 'public' as $$
declare r record;
begin
  if auth.uid() is null then return; end if;
  for r in select b.id from shortlet_bookings b join properties p on p.id = b.property_id
    where coalesce(public.my_property_role(p.id), 'none') not in ('none', 'accountant')
      and b.status in ('pending_host_review', 'awaiting_payment', 'confirmed') and b.check_out >= (now() at time zone 'Africa/Lagos')::date
      and (b.wants_ushers or b.wants_caterer or b.wants_music_band or coalesce(b.wants_security, false) or nullif(trim(coalesce(b.additional_event_requests, '')), '') is not null)
  loop
    perform public._sync_booking_services(r.id);
  end loop;
end $$;

grant execute on function public.get_booking_services_host(uuid), public.get_my_booking_services(uuid),
  public.host_set_service(uuid, text, text, integer, numeric, text, text), public.guest_add_service(uuid, text, integer, text),
  public.guest_cancel_service(uuid, text), public.request_booking_change(uuid, integer, jsonb, text), public.withdraw_booking_change(uuid),
  public.host_decide_change(uuid, text, text), public.get_my_booking_changes(uuid), public.get_host_console(), public.host_sync_all_services() to authenticated;

-- Also applied: refund_shortlet_booking host notification now links to /host?tab=history, and old unread booking
-- notifications that pointed at /owner were repointed to /host?tab=requests.
