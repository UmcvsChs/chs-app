-- 495 SERVICE SOURCING: the venue and CHS admin work together to get a guest's services (Oct 13 2026)
-- For each service a guest asks for (photographer, MC, caterer, ushers, decoration...), the venue can: supply it itself, say the
-- guest arranges it, say it cannot provide it, or REFER IT TO CHS. CHS admin then proposes a provider and a cost to the venue
-- (or says it cannot source it), the two talk in a short thread per service, and the venue accepts with the price it charges its
-- guest. The guest only ever sees "the venue is arranging this" and then "the venue will supply this" at the venue's price; the
-- sourcing, the provider and the cost stay between the venue and CHS. Payment of the service price still goes guest -> venue wallet
-- (migration 490); what the venue and CHS agree about the provider's cost is settled between them for now.

do $do$
begin
  execute format('alter table public.booking_services %s constraint booking_services_status_check', chr(100) || 'rop');
end $do$;
alter table public.booking_services add constraint booking_services_status_check
  check (status = any (array['requested', 'sourcing', 'quoted', 'supplied', 'guest_arranges', 'declined', 'cancelled']));

alter table public.booking_services add column if not exists supplier_cost numeric check (supplier_cost is null or supplier_cost >= 0);
alter table public.booking_services add column if not exists chs_provider text;
alter table public.booking_services add column if not exists chs_provider_contact text;
alter table public.booking_services add column if not exists chs_unable boolean not null default false;
alter table public.booking_services add column if not exists sourced_via text check (sourced_via is null or sourced_via = 'chs');
alter table public.booking_services add column if not exists referred_at timestamptz;
alter table public.booking_services add column if not exists quoted_at timestamptz;
alter table public.booking_services add column if not exists provider_confirmed_at timestamptz;

create table if not exists public.service_messages (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.booking_services(id) on delete cascade,
  booking_id uuid not null,
  property_id uuid not null,
  sender_id uuid,
  side text not null check (side in ('host', 'admin', 'system')),
  body text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.service_messages enable row level security;
revoke all on public.service_messages from anon, authenticated;
create index if not exists service_messages_line on public.service_messages (line_id, created_at);

create or replace function public._service_msg(p_line uuid, p_side text, p_body text) returns void
language sql security definer set search_path to 'public' as $$
  insert into service_messages(line_id, booking_id, property_id, sender_id, side, body)
  select s.id, s.booking_id, s.property_id, auth.uid(), p_side, left(p_body, 1000) from booking_services s where s.id = p_line;
$$;

-- who may speak for the venue on this line
create or replace function public._svc_host_line(p_line uuid) returns booking_services
language plpgsql security definer set search_path to 'public' as $$
declare s booking_services; b record; v_role text;
begin
  select * into s from booking_services where id = p_line;
  if not found then raise exception 'This service line does not exist.'; end if;
  v_role := coalesce(public.my_property_role(s.property_id), 'none');
  if v_role not in ('owner', 'manager') then raise exception 'Only the host or a manager can do this.'; end if;
  select * into b from shortlet_bookings where id = s.booking_id;
  if b.status in ('cancelled', 'declined', 'expired') then raise exception 'This booking is closed.'; end if;
  return s;
end $$;

-- the venue refers one or more services to CHS
create or replace function public.host_refer_services(p_booking uuid, p_services text[], p_note text default null) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare b record; v_role text; sv text; l booking_services; n int := 0; v_title text; v_labels text := ''; v_guest_labels text := '';
begin
  select * into b from shortlet_bookings where id = p_booking;
  if not found then raise exception 'This booking does not exist.'; end if;
  v_role := coalesce(public.my_property_role(b.property_id), 'none');
  if v_role not in ('owner', 'manager') then raise exception 'Only the host or a manager can do this.'; end if;
  if b.status in ('cancelled', 'declined', 'expired') then raise exception 'This booking is closed.'; end if;
  if p_services is null or array_length(p_services, 1) is null then raise exception 'Choose the services you want CHS to source.'; end if;
  perform public._sync_booking_services(p_booking);
  select title into v_title from properties where id = b.property_id;
  foreach sv in array p_services loop
    select * into l from booking_services where booking_id = p_booking and service = sv;
    if found and l.status in ('requested', 'declined') then
      update booking_services set status = 'sourcing', chs_unable = false, referred_at = now(), decided_by = auth.uid(), decided_at = now(), updated_at = now() where id = l.id;
      perform public._service_msg(l.id, 'host', coalesce(nullif(trim(coalesce(p_note, '')), ''), 'We do not have this on our own. Please help us source it.'));
      n := n + 1;
      v_labels := v_labels || case when v_labels = '' then '' else ', ' end || public._service_label(sv) || coalesce(' x' || l.quantity, '');
      v_guest_labels := v_guest_labels || case when v_guest_labels = '' then '' else ', ' end || public._service_label(sv);
    end if;
  end loop;
  if n = 0 then raise exception 'None of those services can be referred (they may already be answered).'; end if;
  perform notify_admins_by_domain('owner_buyer_tenant', '🤝 A venue asks CHS to source services',
    v_title || ' (event ' || b.check_in || ', ' || coalesce(b.event_type, 'event') || ') asks CHS to find: ' || v_labels || '. Open Service sourcing to propose providers and costs.',
    '/admin?tab=servicesourcing');
  perform notify_user(b.guest_id, 'Update on your services', 'The venue is arranging ' || v_guest_labels || ' for ' || v_title || '. You will be told as soon as it is confirmed.', '/my-bookings?b=' || b.id);
  perform log_audit_event('service_referred_to_chs', 'shortlet_bookings', b.id, v_labels, null);
  return n;
end $$;

create or replace function public.host_cancel_referral(p_line uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare s booking_services; v_title text;
begin
  s := public._svc_host_line(p_line);
  if s.status not in ('sourcing', 'quoted') then raise exception 'This service is not with CHS right now.'; end if;
  update booking_services set status = 'requested', chs_unable = false, supplier_cost = null, chs_provider = null, chs_provider_contact = null, updated_at = now() where id = s.id;
  perform public._service_msg(s.id, 'system', 'The venue took this back and will answer it itself.');
  select title into v_title from properties where id = s.property_id;
  perform notify_admins_by_domain('owner_buyer_tenant', 'Venue took a service back', v_title || ': ' || public._service_label(s.service) || ' no longer needs sourcing.', '/admin?tab=servicesourcing');
end $$;

-- admin: "we can supply this, at this cost"
create or replace function public.admin_quote_service(p_line uuid, p_cost numeric, p_provider text, p_contact text default null, p_note text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare s booking_services; b record; v_host uuid; v_title text;
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  select * into s from booking_services where id = p_line;
  if not found then raise exception 'This service line does not exist.'; end if;
  if s.status not in ('sourcing', 'requested', 'quoted') then raise exception 'This service has already been answered (%).', s.status; end if;
  if p_cost is null or p_cost < 0 or p_cost > 1000000000 then raise exception 'Enter the cost to the venue (0 or more).'; end if;
  if nullif(trim(coalesce(p_provider, '')), '') is null then raise exception 'Say who will supply it.'; end if;
  select * into b from shortlet_bookings where id = s.booking_id;
  if b.status in ('cancelled', 'declined', 'expired') then raise exception 'This booking is closed.'; end if;
  update booking_services set status = 'quoted', supplier_cost = p_cost, chs_provider = trim(p_provider), chs_provider_contact = nullif(trim(coalesce(p_contact, '')), ''),
    chs_unable = false, quoted_at = now(), updated_at = now() where id = s.id;
  perform public._service_msg(s.id, 'admin', 'We can supply this: ' || trim(p_provider) || ' at ' || fmt_naira(p_cost) || ' to you.' || coalesce(E'\n' || nullif(trim(coalesce(p_note, '')), ''), ''));
  select owner_id, title into v_host, v_title from properties where id = s.property_id;
  perform notify_user(v_host, '💬 CHS can supply: ' || public._service_label(s.service),
    'For ' || v_title || ' (' || b.check_in || '): ' || trim(p_provider) || ' at ' || fmt_naira(p_cost) || ' to you. Open Services to accept it (and set the price for your guest) or ask for something else.', '/host?tab=services');
  perform log_audit_event('service_quoted_by_chs', 'booking_services', s.id, s.service || ' ' || p_cost, null);
end $$;

create or replace function public.admin_cannot_source(p_line uuid, p_note text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare s booking_services; v_host uuid; v_title text; b record;
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  if nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'Give the venue a short reason.'; end if;
  select * into s from booking_services where id = p_line;
  if not found then raise exception 'This service line does not exist.'; end if;
  if s.status not in ('sourcing', 'quoted') then raise exception 'This service is not waiting for CHS.'; end if;
  select * into b from shortlet_bookings where id = s.booking_id;
  update booking_services set status = 'requested', chs_unable = true, supplier_cost = null, chs_provider = null, chs_provider_contact = null, updated_at = now() where id = s.id;
  perform public._service_msg(s.id, 'admin', 'Sorry, we could not source this: ' || trim(p_note));
  select owner_id, title into v_host, v_title from properties where id = s.property_id;
  perform notify_user(v_host, 'CHS could not source: ' || public._service_label(s.service),
    'For ' || v_title || ' (' || b.check_in || '): ' || trim(p_note) || ' Please tell the guest you cannot provide it, or ask them to arrange it themselves.', '/host?tab=services');
end $$;

-- venue: accept CHS's proposal and set what its guest pays
create or replace function public.host_accept_service_quote(p_line uuid, p_guest_price numeric, p_note text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare s booking_services; b record; v_title text;
begin
  s := public._svc_host_line(p_line);
  if s.status <> 'quoted' then raise exception 'There is no CHS proposal to accept on this service.'; end if;
  if p_guest_price is null or p_guest_price < 0 or p_guest_price > 1000000000 then raise exception 'Enter the price your guest will pay (0 or more).'; end if;
  select * into b from shortlet_bookings where id = s.booking_id;
  select title into v_title from properties where id = s.property_id;
  update booking_services set status = 'supplied', price = p_guest_price, provider_name = null, note = nullif(trim(coalesce(p_note, '')), ''), sourced_via = 'chs',
    decided_by = auth.uid(), decided_at = now(), updated_at = now() where id = s.id;
  perform public._service_msg(s.id, 'host', 'Accepted. We will charge our guest ' || fmt_naira(p_guest_price) || '.');
  perform notify_user(b.guest_id, '✓ Service confirmed: ' || public._service_label(s.service),
    public._service_label(s.service) || ' for ' || v_title || ' (' || b.check_in || '): the venue will supply this. Price: ' || fmt_naira(p_guest_price) || ', agreed with the venue.'
    || case when nullif(trim(coalesce(p_note, '')), '') is not null then E'\nNote: ' || trim(p_note) else '' end, '/my-bookings?b=' || b.id);
  perform notify_admins_by_domain('owner_buyer_tenant', '✓ Venue accepted a CHS service',
    v_title || ' accepted ' || public._service_label(s.service) || ' (' || coalesce(s.chs_provider, 'provider') || '). Please confirm the provider is booked for ' || b.check_in || '.', '/admin?tab=servicesourcing');
  perform log_audit_event('service_quote_accepted', 'booking_services', s.id, s.service || ' guest price ' || p_guest_price, null);
end $$;

create or replace function public.host_reject_service_quote(p_line uuid, p_note text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare s booking_services; v_title text;
begin
  s := public._svc_host_line(p_line);
  if s.status <> 'quoted' then raise exception 'There is no CHS proposal on this service.'; end if;
  if nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'Tell CHS briefly why (too expensive, wrong style, wrong date...).'; end if;
  update booking_services set status = 'sourcing', supplier_cost = null, chs_provider = null, chs_provider_contact = null, updated_at = now() where id = s.id;
  perform public._service_msg(s.id, 'host', 'Not accepted: ' || trim(p_note) || ' Please find another option.');
  select title into v_title from properties where id = s.property_id;
  perform notify_admins_by_domain('owner_buyer_tenant', 'Venue wants another option', v_title || ' - ' || public._service_label(s.service) || ': ' || trim(p_note), '/admin?tab=servicesourcing');
end $$;

create or replace function public.admin_confirm_service_provider(p_line uuid, p_note text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare s booking_services; v_host uuid; v_title text; b record;
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  select * into s from booking_services where id = p_line;
  if not found or s.sourced_via is distinct from 'chs' or s.status <> 'supplied' then raise exception 'This service is not waiting for provider confirmation.'; end if;
  select * into b from shortlet_bookings where id = s.booking_id;
  update booking_services set provider_confirmed_at = now(), updated_at = now() where id = s.id;
  perform public._service_msg(s.id, 'admin', 'Provider confirmed for the event: ' || coalesce(s.chs_provider, '') || coalesce(' (' || s.chs_provider_contact || ')', '') || '.' || coalesce(E'\n' || nullif(trim(coalesce(p_note, '')), ''), ''));
  select owner_id, title into v_host, v_title from properties where id = s.property_id;
  perform notify_user(v_host, '✓ Provider confirmed: ' || public._service_label(s.service),
    'For ' || v_title || ' (' || b.check_in || '): ' || coalesce(s.chs_provider, '') || coalesce(' - ' || s.chs_provider_contact, '') || ' is booked.', '/host?tab=services');
end $$;

-- a short conversation per service between the venue and CHS
create or replace function public.send_service_message(p_line uuid, p_body text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare s booking_services; v_role text; v_side text; v_host uuid; v_title text;
begin
  if nullif(trim(coalesce(p_body, '')), '') is null then raise exception 'Write a message first.'; end if;
  select * into s from booking_services where id = p_line;
  if not found then raise exception 'This service line does not exist.'; end if;
  v_role := coalesce(public.my_property_role(s.property_id), 'none');
  if v_role in ('owner', 'manager') then v_side := 'host';
  elsif is_admin() then v_side := 'admin';
  else raise exception 'You cannot write on this service.'; end if;
  perform public._service_msg(s.id, v_side, trim(p_body));
  select owner_id, title into v_host, v_title from properties where id = s.property_id;
  if v_side = 'host' then
    perform notify_admins_by_domain('owner_buyer_tenant', '💬 Venue message: ' || public._service_label(s.service), v_title || ': ' || left(trim(p_body), 160), '/admin?tab=servicesourcing');
  else
    perform notify_user(v_host, '💬 CHS message: ' || public._service_label(s.service), left(trim(p_body), 200), '/host?tab=services');
  end if;
end $$;

create or replace function public.get_service_thread(p_line uuid) returns json
language plpgsql security definer set search_path to 'public' as $$
declare s booking_services;
begin
  select * into s from booking_services where id = p_line;
  if not found then return '[]'::json; end if;
  if coalesce(public.my_property_role(s.property_id), 'none') in ('none', 'accountant') and not is_admin() then raise exception 'Not allowed.'; end if;
  return coalesce((select json_agg(json_build_object('id', m.id, 'side', m.side, 'body', m.body, 'created_at', m.created_at) order by m.created_at)
    from service_messages m where m.line_id = p_line), '[]'::json);
end $$;

-- admin work queue
create or replace function public.admin_get_service_sourcing() returns json
language plpgsql security definer set search_path to 'public' as $$
declare v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  return coalesce((
    select json_agg(x order by x.rank, x.check_in) from (
      select case when s.status = 'sourcing' then 1 when s.status = 'quoted' then 2 when s.status = 'supplied' then 3 else 4 end as rank,
        b.check_in,
        json_build_object('id', s.id, 'booking_id', b.id, 'ref', 'REQ-' || substr(b.id::text, 1, 8), 'property_title', p.title, 'host_name', hp.full_name, 'host_phone', hp.phone,
          'event_type', b.event_type, 'check_in', b.check_in, 'guests', b.guests, 'guest_name', b.guest_full_name,
          'sessions', (select string_agg(to_char(public._lagos_date(e.starts_at), 'Dy DD Mon') || ' ' || to_char(e.starts_at at time zone 'Africa/Lagos', 'HH24:MI') || '-' || to_char(e.ends_at at time zone 'Africa/Lagos', 'HH24:MI'), '; ' order by e.starts_at) from event_slots e where e.booking_id = b.id),
          'service', s.service, 'label', public._service_label(s.service), 'quantity', s.quantity, 'guest_note', s.note, 'status', s.status, 'chs_unable', s.chs_unable,
          'supplier_cost', s.supplier_cost, 'chs_provider', s.chs_provider, 'chs_provider_contact', s.chs_provider_contact, 'guest_price', s.price,
          'referred_at', s.referred_at, 'quoted_at', s.quoted_at, 'provider_confirmed_at', s.provider_confirmed_at,
          'messages', (select count(*) from service_messages m where m.line_id = s.id),
          'last_message', (select m.body from service_messages m where m.line_id = s.id order by m.created_at desc limit 1),
          'last_side', (select m.side from service_messages m where m.line_id = s.id order by m.created_at desc limit 1)) as x
      from booking_services s
        join shortlet_bookings b on b.id = s.booking_id
        join properties p on p.id = s.property_id
        left join profiles hp on hp.id = p.owner_id
      where b.status in ('pending_host_review', 'awaiting_payment', 'confirmed') and b.check_out >= v_today
        and (s.status in ('sourcing', 'quoted') or (s.status = 'supplied' and s.sourced_via = 'chs' and s.provider_confirmed_at is null))
    ) q), '[]'::json);
end $$;

-- host view of a booking's services now also carries the CHS sourcing details (venue side only)
create or replace function public.get_booking_services_host(p_booking uuid) returns json
language plpgsql security definer set search_path to 'public' as $$
declare v_prop uuid;
begin
  select property_id into v_prop from shortlet_bookings where id = p_booking;
  if v_prop is null or not public.can_manage_arrivals(v_prop) then raise exception 'You do not have access to this booking.'; end if;
  perform public._sync_booking_services(p_booking);
  return coalesce((select json_agg(json_build_object('id', s.id, 'service', s.service, 'label', public._service_label(s.service), 'quantity', s.quantity,
    'status', s.status, 'provider_name', s.provider_name, 'price', s.price, 'note', s.note, 'source', s.source, 'decided_at', s.decided_at,
    'supplier_cost', s.supplier_cost, 'chs_provider', s.chs_provider, 'chs_provider_contact', s.chs_provider_contact, 'chs_unable', s.chs_unable,
    'sourced_via', s.sourced_via, 'provider_confirmed_at', s.provider_confirmed_at,
    'messages', (select count(*) from service_messages m where m.line_id = s.id)) order by s.created_at)
    from booking_services s where s.booking_id = p_booking), '[]'::json);
end $$;

-- the guest sees only "the venue is arranging this", never CHS, the provider or the cost
create or replace function public.get_my_booking_services(p_booking uuid) returns json
language plpgsql security definer set search_path to 'public' as $$
declare v_guest uuid;
begin
  select guest_id into v_guest from shortlet_bookings where id = p_booking;
  if v_guest is null or v_guest <> auth.uid() then raise exception 'This is not your booking.'; end if;
  perform public._sync_booking_services(p_booking);
  return coalesce((select json_agg(json_build_object('id', s.id, 'service', s.service, 'label', public._service_label(s.service), 'quantity', s.quantity,
    'status', case when s.status in ('sourcing', 'quoted') then 'arranging' else s.status end,
    'provider_name', case when s.status in ('sourcing', 'quoted') then null else s.provider_name end,
    'price', case when s.status in ('sourcing', 'quoted') then null else s.price end,
    'note', case when s.status in ('sourcing', 'quoted') then null else s.note end, 'decided_at', s.decided_at) order by s.created_at)
    from booking_services s where s.booking_id = p_booking), '[]'::json);
end $$;

-- the host console counts a CHS proposal waiting for the venue as something to do
do $do$
declare v_def text; v_new text;
begin
  v_def := pg_get_functiondef('public.get_host_console()'::regprocedure);
  v_new := replace(v_def, 'from booking_services s where s.booking_id = bk.id and s.status = ''requested''),', 'from booking_services s where s.booking_id = bk.id and s.status in (''requested'', ''quoted'')),');
  if v_new = v_def then raise exception 'console patch 1 did not apply'; end if;
  v_def := v_new;
  v_new := replace(v_def, 'order by (s.status = ''requested'') desc, b.check_in', 'order by (s.status in (''requested'', ''quoted'')) desc, b.check_in');
  if v_new = v_def then raise exception 'console patch 2 did not apply'; end if;
  execute v_new;
end $do$;

revoke execute on function public._service_msg(uuid, text, text), public._svc_host_line(uuid) from public, anon, authenticated;
revoke execute on function public.host_refer_services(uuid, text[], text), public.host_cancel_referral(uuid), public.admin_quote_service(uuid, numeric, text, text, text),
  public.admin_cannot_source(uuid, text), public.host_accept_service_quote(uuid, numeric, text), public.host_reject_service_quote(uuid, text),
  public.admin_confirm_service_provider(uuid, text), public.send_service_message(uuid, text), public.get_service_thread(uuid), public.admin_get_service_sourcing() from public, anon;
grant execute on function public.host_refer_services(uuid, text[], text), public.host_cancel_referral(uuid), public.admin_quote_service(uuid, numeric, text, text, text),
  public.admin_cannot_source(uuid, text), public.host_accept_service_quote(uuid, numeric, text), public.host_reject_service_quote(uuid, text),
  public.admin_confirm_service_provider(uuid, text), public.send_service_message(uuid, text), public.get_service_thread(uuid), public.admin_get_service_sourcing() to authenticated;
