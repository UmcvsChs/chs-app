-- 497 HOST REPLIES GO THROUGH CHS (Oct 13 2026)
-- Until now a request reached the host through CHS, but the host's answer (accept / decline / "we supply this") went straight
-- to the guest. Now, when manual relay is on for the booking, the host's answer waits for CHS to release it:
--   * the guest keeps seeing "with the host" / "the venue is arranging this" until an admin releases the reply
--   * admin sees it in Admin > Host replies, can edit or remove the note, and releases it with one click
--   * the guest's payment timer starts at release, not when the host clicks
--   * an unreleased reply is released automatically after the relay time (default 240 min; notes with contact details are removed)
-- Hosts may not put phone numbers or emails in a note. Accepting a service ("we supply this") now needs a price (0 = included).

alter table public.shortlet_bookings add column if not exists reply_pending text check (reply_pending in ('confirmed', 'declined'));
alter table public.shortlet_bookings add column if not exists reply_note text;
alter table public.shortlet_bookings add column if not exists reply_at timestamptz;
alter table public.shortlet_bookings add column if not exists reply_release_at timestamptz;
alter table public.booking_services add column if not exists relayed boolean not null default true;
alter table public.booking_services add column if not exists relay_due_at timestamptz;

-- the original decision logic, kept as the internal "apply" step (no host check, no purge)
do $do$
declare v_def text; v_new text;
begin
  v_def := pg_get_functiondef('public.host_decide_shortlet_booking(uuid,text,text)'::regprocedure);
  v_new := replace(v_def, 'public.host_decide_shortlet_booking(', 'public._apply_host_decision(');
  v_new := replace(v_new, '  perform purge_expired_holds(v_host_id);', '');
  v_new := replace(v_new, 'if v_host_id != auth.uid() then raise exception ''You are not the real host of this property.''; end if;', '');
  if position('purge_expired_holds' in v_new) > 0 or position('auth.uid()' in v_new) > 0 then raise exception 'apply patch failed'; end if;
  execute v_new;
end $do$;
revoke execute on function public._apply_host_decision(uuid, text, text) from public, anon, authenticated;

create or replace function public._notify_service_answer(p_booking uuid, p_service text, p_status text, p_price numeric, p_note text, p_guest uuid, p_check_in date, p_property uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_title text; v_label text; v_msg text;
begin
  select title into v_title from properties where id = p_property;
  v_label := public._service_label(p_service);
  v_msg := case p_status
    when 'supplied' then v_label || ' for ' || v_title || ' (' || p_check_in || '): the venue will supply this.' || case when p_price is not null and p_price > 0 then ' Price: ' || fmt_naira(p_price) || ', agreed with the venue.' else ' It is included.' end
    when 'guest_arranges' then v_label || ' for ' || v_title || ' (' || p_check_in || '): the venue says you arrange this yourself.'
    when 'declined' then v_label || ' for ' || v_title || ' (' || p_check_in || '): the venue cannot provide this.'
    else v_label || ' for ' || v_title || ' is back under review.' end
    || case when nullif(trim(coalesce(p_note, '')), '') is not null then E'\nNote: ' || trim(p_note) else '' end;
  perform notify_user(p_guest, case p_status when 'supplied' then '✓ Service confirmed: ' when 'declined' then 'Service not available: ' else 'Service update: ' end || v_label, v_msg, '/my-bookings?b=' || p_booking);
end $$;
revoke execute on function public._notify_service_answer(uuid, text, text, numeric, text, uuid, date, uuid) from public, anon, authenticated;

-- release the services the host has answered (to the guest)
create or replace function public._release_host_services(p_booking uuid, p_mode text, p_notes jsonb) returns int
language plpgsql security definer set search_path to 'public' as $$
declare b record; s record; v_note text; n int := 0;
begin
  select * into b from shortlet_bookings where id = p_booking;
  if not found then return 0; end if;
  for s in select * from booking_services where booking_id = p_booking and not relayed for update loop
    v_note := s.note;
    if p_notes is not null and p_notes ? s.service then v_note := nullif(trim(p_notes->>s.service), ''); end if;
    if p_mode = 'auto' and v_note is not null and detect_offplatform_contact(v_note) is not null then v_note := null; end if;
    update booking_services set relayed = true, relay_due_at = null, note = v_note, updated_at = now() where id = s.id;
    if b.status in ('pending_host_review', 'awaiting_payment', 'confirmed') then
      perform public._notify_service_answer(b.id, s.service, s.status, s.price, v_note, b.guest_id, b.check_in, b.property_id);
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public._release_host_services(uuid, text, jsonb) from public, anon, authenticated;

-- release the host's accept / decline and the services answered with it
create or replace function public._release_host_reply(p_booking uuid, p_mode text, p_note text, p_notes jsonb) returns void
language plpgsql security definer set search_path to 'public' as $$
declare b record; v_dec text; v_note text;
begin
  select * into b from shortlet_bookings where id = p_booking for update;
  if not found then return; end if;
  if b.reply_pending is not null and b.status = 'pending_host_review' then
    v_dec := b.reply_pending;
    v_note := case when p_note is not null then nullif(trim(p_note), '') else b.reply_note end;
    if p_mode = 'auto' and v_note is not null and detect_offplatform_contact(v_note) is not null then v_note := null; end if;
    update shortlet_bookings set reply_pending = null, reply_note = null where id = b.id;
    perform public._apply_host_decision(b.id, v_dec, v_note);
  elsif b.reply_pending is not null then
    update shortlet_bookings set reply_pending = null, reply_note = null where id = b.id;
  end if;
  perform public._release_host_services(p_booking, p_mode, p_notes);
end $$;
revoke execute on function public._release_host_reply(uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function public._sweep_host_replies() returns int
language plpgsql security definer set search_path to 'public' as $$
declare r record; n int := 0;
begin
  for r in select id from shortlet_bookings where reply_pending is not null and reply_release_at <= now() loop
    perform public._release_host_reply(r.id, 'auto', null, null); n := n + 1;
  end loop;
  for r in select distinct booking_id as id from booking_services where not relayed and relay_due_at <= now() loop
    n := n + public._release_host_services(r.id, 'auto', null);
  end loop;
  return n;
end $$;
revoke execute on function public._sweep_host_replies() from public, anon, authenticated;

-- the host's decision: held for CHS when manual relay applies
create or replace function public.host_decide_shortlet_booking(p_booking_id uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare b record; v_owner uuid; v_title text; v_manual boolean; v_min int; v_gname text;
begin
  select * into b from shortlet_bookings where id = p_booking_id;
  if not found then raise exception 'This booking request does not exist.'; end if;
  perform purge_expired_holds(b.property_id);
  select * into b from shortlet_bookings where id = p_booking_id for update;
  select owner_id, title into v_owner, v_title from properties where id = b.property_id;
  if v_owner is distinct from auth.uid() then raise exception 'You are not the real host of this property.'; end if;
  if p_decision not in ('confirmed', 'declined') then raise exception 'Not a real, recognized decision.'; end if;
  if b.status <> 'pending_host_review' then
    raise exception 'This request is no longer waiting for a decision (it is now: %). If it expired, no money was taken or the guest was refunded automatically.', b.status;
  end if;
  if b.reply_pending is not null then raise exception 'You have already answered this request. CHS is confirming your answer to the guest.'; end if;
  if nullif(trim(coalesce(p_note, '')), '') is not null and detect_offplatform_contact(p_note) is not null then
    raise exception 'Please remove phone numbers and email addresses from your note. CHS passes messages between you and the guest.';
  end if;
  v_manual := b.payment_status <> 'held_escrow' and coalesce((public.booking_lane_info(b.check_in)->>'manual_relay')::boolean, false);
  if not v_manual then
    perform public._apply_host_decision(p_booking_id, p_decision, p_note);
    return;
  end if;
  v_min := booking_setting_int('booking_relay_minutes_' || coalesce(b.booking_lane, 'standard'), 240);
  update shortlet_bookings set reply_pending = p_decision, reply_note = nullif(trim(coalesce(p_note, '')), ''), reply_at = now(),
    reply_release_at = now() + make_interval(mins => v_min), hold_expires_at = now() + make_interval(mins => v_min + 5)
  where id = b.id;
  select full_name into v_gname from profiles where id = b.guest_id;
  perform notify_user(auth.uid(), '📨 Your answer is with CHS', 'CHS will confirm your answer for ' || v_title || ' (' || b.check_in || ') to the guest shortly. You do not need to do anything.', booking_request_link(auth.uid()));
  perform notify_admins_by_domain('owner_buyer_tenant', '📨 Host replied — please relay to the guest',
    v_title || ': the host ' || case when p_decision = 'confirmed' then 'ACCEPTED' else 'DECLINED' end || ' ' || coalesce(v_gname, b.guest_full_name) || '''s request for ' || b.check_in || '. Check the reply and release it to the guest. It is released automatically in ' || booking_duration_text(v_min) || '.',
    '/admin?tab=hostreplies');
  perform log_audit_event('host_reply_held', 'shortlet_bookings', b.id, p_decision, null);
end $$;

-- a settled hold must release a waiting reply rather than lose it
create or replace function public.settle_expired_booking(p_booking_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare b record;
begin
  select * into b from shortlet_bookings where id = p_booking_id;
  if not found then return; end if;
  if b.status = 'awaiting_admin_relay' then
    perform relay_booking_to_host(b.id, 'auto', null);
  elsif b.status = 'pending_host_review' then
    if b.reply_pending is not null then
      perform public._release_host_reply(b.id, 'auto', null, null);
    elsif b.payment_status = 'held_escrow' then
      perform system_decline_booking(b.id, 'the host did not respond within the allowed time', true);
    else
      perform system_close_unpaid_booking(b.id, 'expired', 'the host did not respond in time', true);
    end if;
  elsif b.status = 'awaiting_payment' then
    perform system_close_unpaid_booking(b.id, 'expired', 'the payment window passed', true);
  end if;
end $$;

-- the periodic sweep also releases unreleased replies
do $do$
declare v_def text; v_new text;
begin
  v_def := pg_get_functiondef('public.sweep_expired_booking_holds()'::regprocedure);
  v_new := replace(v_def, 'n := purge_expired_holds(null);', 'n := purge_expired_holds(null) + public._sweep_host_replies();');
  if v_new = v_def then raise exception 'sweep patch did not apply'; end if;
  execute v_new;
end $do$;

-- the host answers a service: held for CHS when manual relay applies; "we supply this" needs a price (0 = included)
create or replace function public.host_set_service(p_booking uuid, p_service text, p_status text, p_quantity integer default null, p_price numeric default null, p_provider text default null, p_note text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare b record; v_role text; v_manual boolean; v_min int; v_first boolean; v_title text;
begin
  select * into b from shortlet_bookings where id = p_booking;
  if not found then raise exception 'This booking does not exist.'; end if;
  v_role := coalesce(public.my_property_role(b.property_id), 'none');
  if v_role not in ('owner', 'manager') then raise exception 'Only the host or a manager can answer service requests.'; end if;
  if p_status not in ('supplied', 'guest_arranges', 'declined', 'requested') then raise exception 'Not a recognised answer.'; end if;
  if b.status in ('cancelled', 'declined', 'expired') then raise exception 'This booking is closed.'; end if;
  if p_status = 'declined' and nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'Please give the guest a short reason when you cannot provide a service.'; end if;
  if p_price is not null and p_price < 0 then raise exception 'Price cannot be negative.'; end if;
  if p_status = 'supplied' and p_price is null then raise exception 'Please enter the price for this service (enter 0 if it is included in the hall price).'; end if;
  if nullif(trim(coalesce(p_note, '')), '') is not null and detect_offplatform_contact(p_note) is not null then
    raise exception 'Please remove phone numbers and email addresses from your note. CHS passes messages between you and the guest.';
  end if;
  v_manual := p_status <> 'requested' and coalesce((public.booking_lane_info(b.check_in)->>'manual_relay')::boolean, false);
  v_min := booking_setting_int('booking_relay_minutes_' || coalesce(b.booking_lane, 'standard'), 240);
  perform public._sync_booking_services(p_booking);
  v_first := v_manual and not exists (select 1 from booking_services where booking_id = p_booking and not relayed and service <> p_service);
  insert into booking_services(booking_id, property_id, service, quantity, status, provider_name, price, note, source, decided_by, decided_at, relayed, relay_due_at)
  values (p_booking, b.property_id, p_service, p_quantity, p_status, nullif(trim(coalesce(p_provider, '')), ''), p_price, nullif(trim(coalesce(p_note, '')), ''), 'host', auth.uid(), now(),
    not v_manual, case when v_manual then now() + make_interval(mins => v_min) end)
  on conflict (booking_id, service) do update set status = excluded.status, quantity = coalesce(excluded.quantity, booking_services.quantity),
    provider_name = excluded.provider_name, price = excluded.price, note = excluded.note, decided_by = auth.uid(), decided_at = now(), updated_at = now(),
    relayed = excluded.relayed, relay_due_at = excluded.relay_due_at;
  if v_manual then
    if v_first then
      select title into v_title from properties where id = b.property_id;
      perform notify_admins_by_domain('owner_buyer_tenant', '📨 Host answered service requests — please relay', v_title || ' (' || b.check_in || '): the host has answered service requests. Check them and release them to the guest.', '/admin?tab=hostreplies');
    end if;
  else
    perform public._notify_service_answer(b.id, p_service, p_status, p_price, p_note, b.guest_id, b.check_in, b.property_id);
  end if;
  perform log_audit_event('booking_service_set', 'booking_services', b.id, p_service, jsonb_build_object('status', p_status));
end $$;

-- what the guest sees: an unreleased answer still reads "the venue is arranging this"
do $do$
declare v_def text; v_new text;
begin
  v_def := pg_get_functiondef('public.get_my_booking_services(uuid)'::regprocedure);
  v_new := replace(v_def, 's.status in (''sourcing'', ''quoted'')', '(s.status in (''sourcing'', ''quoted'') or not s.relayed)');
  v_new := replace(v_new, 's.status = ''supplied'' and s.price is not null', 's.status = ''supplied'' and s.relayed and s.price is not null');
  if v_new = v_def then raise exception 'guest services patch did not apply'; end if;
  execute v_new;
  v_def := pg_get_functiondef('public.pay_service_line(uuid)'::regprocedure);
  v_new := replace(v_def, 'if s.paid_at is not null then raise exception ''This service is already paid.''; end if;', 'if not s.relayed then raise exception ''The venue''''s answer is being confirmed by CHS. You can pay once it is confirmed.''; end if;' || E'\n  ' || 'if s.paid_at is not null then raise exception ''This service is already paid.''; end if;');
  if v_new = v_def then raise exception 'pay line patch did not apply'; end if;
  execute v_new;
  v_def := pg_get_functiondef('public.get_booking_services_host(uuid)'::regprocedure);
  v_new := replace(v_def, '''sourced_via'', s.sourced_via,', '''sourced_via'', s.sourced_via, ''relayed'', s.relayed,');
  if v_new = v_def then raise exception 'host services patch did not apply'; end if;
  execute v_new;
  v_def := pg_get_functiondef('public.get_host_console()'::regprocedure);
  v_new := replace(v_def, '''status'', bk.status, ''payment_status''', '''status'', bk.status, ''reply_pending'', bk.reply_pending, ''reply_release_at'', bk.reply_release_at, ''payment_status''');
  v_new := replace(v_new, '''status'', s.status, ''provider_name'', s.provider_name, ''price'', s.price, ''note'', s.note, ''property_title''', '''status'', s.status, ''relayed'', s.relayed, ''provider_name'', s.provider_name, ''price'', s.price, ''note'', s.note, ''property_title''');
  v_new := replace(v_new, 'perform public._lapse_topups();', 'perform public._lapse_topups();' || E'\n  ' || 'perform public._sweep_host_replies();');
  if v_new = v_def then raise exception 'host console patch did not apply'; end if;
  execute v_new;
end $do$;

-- admin: replies waiting to be relayed
create or replace function public.admin_get_host_replies() returns json
language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  perform public._sweep_host_replies();
  return coalesce((select json_agg(x order by x.release_at nulls last) from (
    select b.id, 'REQ-' || substr(b.id::text, 1, 8) as ref, p.title as property_title, o.full_name as host_name, b.guest_full_name as guest_name, b.event_type,
      b.check_in, b.check_out, b.status, (b.total_price + coalesce(b.guest_commission_amount, 0)) as amount_if_confirmed,
      b.reply_pending as decision, b.reply_note as note, b.reply_at, b.reply_release_at as release_at,
      greatest(0, ceil(extract(epoch from (coalesce(b.reply_release_at, (select min(s.relay_due_at) from booking_services s where s.booking_id = b.id and not s.relayed)) - now())) / 60))::int as minutes_left,
      coalesce((select json_agg(json_build_object('service', s.service, 'label', public._service_label(s.service), 'quantity', s.quantity, 'status', s.status, 'price', s.price, 'provider_name', s.provider_name, 'note', s.note) order by s.decided_at)
        from booking_services s where s.booking_id = b.id and not s.relayed), '[]'::json) as services
    from shortlet_bookings b join properties p on p.id = b.property_id join profiles o on o.id = p.owner_id
    where b.status in ('pending_host_review', 'awaiting_payment', 'confirmed')
      and (b.reply_pending is not null or exists (select 1 from booking_services s where s.booking_id = b.id and not s.relayed))) x), '[]'::json);
end $$;

-- admin: release (optionally with an edited note; null = keep, empty text = remove)
create or replace function public.admin_release_host_reply(p_booking uuid, p_note text default null, p_service_notes jsonb default null) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  if not exists (select 1 from shortlet_bookings where id = p_booking) then raise exception 'This booking does not exist.'; end if;
  perform public._release_host_reply(p_booking, 'admin', p_note, p_service_notes);
  perform log_audit_event('host_reply_released', 'shortlet_bookings', p_booking, null, null);
end $$;

revoke execute on function public.admin_get_host_replies(), public.admin_release_host_reply(uuid, text, jsonb) from public, anon;
grant execute on function public.admin_get_host_replies(), public.admin_release_host_reply(uuid, text, jsonb), public.host_decide_shortlet_booking(uuid, text, text),
  public.host_set_service(uuid, text, text, integer, numeric, text, text) to authenticated;

-- the owner's pending list no longer shows requests the host has already answered
do $do$
declare v_def text; v_new text;
begin
  v_def := pg_get_functiondef('public.get_my_booking_requests()'::regprocedure);
  v_new := replace(v_def, 'and b.status = ''pending_host_review''', 'and b.status = ''pending_host_review'' and b.reply_pending is null');
  if v_new = v_def then raise exception 'patch failed'; end if;
  execute v_new;
end $do$;
