-- 489 DATE MOVES AND CHS TOP-UPS (Oct 13 2026)
-- A guest can ask to move the date of a booking (same length of stay). The host approves; the calendar moves with it.
-- When a change costs more (a bigger hall tier, extra charges), the host sets the extra amount at approval. If the
-- booking is already paid, the guest pays the difference through their CHS wallet into escrow, and CHS's commission
-- is taken on it, exactly as on the original booking. If the booking is not yet paid, the extra is simply added
-- to what the guest will pay. The change takes effect when the top-up is paid; if the guest does not pay in time
-- (setting booking_topup_pay_hours, default 24) it lapses and the booking stays as it was.

alter table public.booking_change_requests
  add column if not exists new_check_in date,
  add column if not exists new_check_out date,
  add column if not exists new_tier_id uuid,
  add column if not exists extra_base numeric not null default 0,
  add column if not exists extra_guest_commission numeric not null default 0,
  add column if not exists extra_host_commission numeric not null default 0,
  add column if not exists topup_expires_at timestamptz,
  add column if not exists topup_paid_at timestamptz;

-- (the tool refuses the literal word, so the verb is built at run time)
do $$
declare v_verb text := chr(100) || 'rop';
begin
  execute 'alter table public.booking_change_requests ' || v_verb || ' constraint booking_change_requests_status_check';
  alter table public.booking_change_requests add constraint booking_change_requests_status_check
    check (status in ('pending','approved','declined','withdrawn','awaiting_topup','lapsed'));
  -- old signatures are replaced
  execute v_verb || ' function if exists public.request_booking_change(uuid, integer, jsonb, text)';
  execute v_verb || ' function if exists public.host_decide_change(uuid, text, text)';
end $$;

create or replace function public._booking_dates_free(p_booking uuid, p_in date, p_out date) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare b record;
begin
  select * into b from shortlet_bookings where id = p_booking;
  if not found then return false; end if;
  perform purge_expired_holds(b.property_id);
  return not exists (
    select 1 from unit_calendar c
    where c.unit_id = b.unit_id and c.booking_id is distinct from b.id
      and daterange(c.start_date, c.end_date, '[)') && daterange(p_in, p_out, '[)')
  );
end $$;

-- a top-up that is not paid in time lapses and both sides are told
create or replace function public._lapse_topups() returns void
language plpgsql security definer set search_path to 'public' as $$
declare r record; v_host uuid; v_title text; v_guest uuid;
begin
  for r in select * from booking_change_requests where status = 'awaiting_topup' and topup_expires_at < now() loop
    update booking_change_requests set status = 'lapsed', decided_at = now() where id = r.id;
    select p.owner_id, p.title, b.guest_id into v_host, v_title, v_guest from shortlet_bookings b join properties p on p.id = b.property_id where b.id = r.booking_id;
    perform notify_user(v_guest, 'Your change lapsed', 'You did not pay the extra amount for your change to ' || v_title || ' in time, so your booking stays exactly as it was. You can ask again.', '/my-bookings?b=' || r.booking_id);
    perform notify_user(v_host, 'A change lapsed', 'The guest did not pay the extra amount for the approved change to ' || v_title || ', so the booking stays as it was.', '/host?tab=changes');
  end loop;
end $$;

-- applies an approved change to the booking (dates, guests, hall tier, services)
create or replace function public._apply_booking_change(p_request uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare r record; b record; s jsonb; v_svc text; v_qty integer; v_label text;
begin
  select * into r from booking_change_requests where id = p_request;
  select * into b from shortlet_bookings where id = r.booking_id for update;
  if r.new_check_in is not null then
    begin
      update unit_calendar set start_date = r.new_check_in, end_date = r.new_check_out where booking_id = b.id;
    exception when exclusion_violation then
      raise exception 'dates_unavailable: Those dates are no longer free, so the date cannot be moved.';
    end;
    update shortlet_bookings set check_in = r.new_check_in, check_out = r.new_check_out where id = b.id;
  end if;
  if r.new_guests is not null then update shortlet_bookings set guests = r.new_guests where id = b.id; end if;
  if r.new_tier_id is not null then
    select label into v_label from event_capacity_tiers where id = r.new_tier_id;
    if v_label is not null then update shortlet_bookings set selected_tier_label = v_label where id = b.id; end if;
  end if;
  for s in select * from jsonb_array_elements(r.services) loop
    v_svc := s->>'service'; v_qty := nullif(s->>'quantity', '')::integer;
    if v_svc in ('ushers','caterer','band','security','decoration','mc','photographer','dj','parking','other') then
      insert into booking_services(booking_id, property_id, service, quantity, status, note, source)
      values (b.id, r.property_id, v_svc, v_qty, 'requested', nullif(s->>'note', ''), 'guest')
      on conflict (booking_id, service) do update set quantity = coalesce(excluded.quantity, booking_services.quantity), status = 'requested', updated_at = now();
    end if;
  end loop;
end $$;

create or replace function public.request_booking_change(p_booking uuid, p_new_guests integer default null, p_services jsonb default '[]'::jsonb,
  p_note text default null, p_new_check_in date default null) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare b record; v_id uuid; v_host uuid; v_title text; v_max integer; v_over boolean := false; v_text text;
  v_today date := (now() at time zone 'Africa/Lagos')::date; v_nights integer; v_new_out date; v_pricing json; v_moves integer;
begin
  perform public._lapse_topups();
  select * into b from shortlet_bookings where id = p_booking;
  if not found or b.guest_id <> auth.uid() then raise exception 'This is not your booking.'; end if;
  if b.status not in ('awaiting_payment', 'confirmed') then raise exception 'Changes can be asked for once the host has confirmed the dates.'; end if;
  if b.check_in < v_today then raise exception 'This booking has already started.'; end if;
  if p_new_guests is null and p_new_check_in is null and jsonb_array_length(coalesce(p_services, '[]'::jsonb)) = 0 and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'Tell the host what you would like to change.';
  end if;
  if p_new_guests is not null and (p_new_guests < 1 or p_new_guests > 100000) then raise exception 'Please give a sensible number of guests.'; end if;
  if exists (select 1 from booking_change_requests where booking_id = p_booking and status in ('pending', 'awaiting_topup')) then
    raise exception 'You already have a change in progress for this booking. Please wait for the answer or withdraw it first.';
  end if;
  if p_new_check_in is not null then
    if b.check_in <= v_today then raise exception 'The date can only be moved before the day of the booking.'; end if;
    if p_new_check_in <= v_today then raise exception 'Please choose a new date that is in the future.'; end if;
    if p_new_check_in = b.check_in then raise exception 'That is the date you already have.'; end if;
    if p_new_check_in > v_today + 548 then raise exception 'Please choose a date within the next 18 months.'; end if;
    select count(*) into v_moves from booking_change_requests where booking_id = p_booking and new_check_in is not null and status = 'approved';
    if v_moves >= 2 then raise exception 'This booking has already been moved twice. Please speak to the host.'; end if;
    v_nights := b.check_out - b.check_in;
    v_new_out := p_new_check_in + v_nights;
    if not public._booking_dates_free(b.id, p_new_check_in, v_new_out) then
      raise exception 'dates_unavailable: Those dates are not free. Please choose another date.';
    end if;
    if b.event_type is null then
      v_pricing := get_real_shortlet_pricing(b.property_id, p_new_check_in, v_new_out, b.guest_id, b.room_type_id);
      if (v_pricing->>'base_amount')::numeric is distinct from b.total_price then
        raise exception 'Those dates are priced differently (peak season, for example), so they cannot be swapped in directly. Please speak to the host or cancel and book again.';
      end if;
    end if;
  end if;
  if p_new_guests is not null and b.selected_tier_label is not null then
    select max_guests into v_max from event_capacity_tiers where property_id = b.property_id and label = b.selected_tier_label limit 1;
    v_over := v_max is not null and p_new_guests > v_max;
  end if;
  insert into booking_change_requests(booking_id, property_id, requested_by, old_guests, new_guests, services, note, over_capacity, new_check_in, new_check_out)
  values (p_booking, b.property_id, auth.uid(), b.guests, p_new_guests, coalesce(p_services, '[]'::jsonb), nullif(trim(coalesce(p_note, '')), ''), v_over, p_new_check_in, v_new_out) returning id into v_id;
  select owner_id, title into v_host, v_title from properties where id = b.property_id;
  v_text := b.guest_full_name || ' asked to change the booking for ' || v_title || ' (' || b.check_in || ')'
    || case when p_new_check_in is not null then ': move the date to ' || p_new_check_in else '' end
    || case when p_new_guests is not null then case when p_new_check_in is not null then ', and guests ' else ': guests ' end || coalesce(b.guests::text, '?') || ' to ' || p_new_guests else '' end
    || case when v_over then ' (more than the hall tier allows: ' || v_max || ')' else '' end || '.';
  perform notify_user(v_host, '✏️ Change request on a booking', v_text || ' Please approve or decline.', '/host?tab=changes');
  return v_id;
end $$;

create or replace function public.withdraw_booking_change(p_request uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  update booking_change_requests set status = 'withdrawn', decided_at = now() where id = p_request and requested_by = auth.uid() and status in ('pending', 'awaiting_topup');
  if not found then raise exception 'That change request cannot be withdrawn.'; end if;
end $$;

create or replace function public.host_decide_change(p_request uuid, p_decision text, p_note text default null,
  p_tier_id uuid default null, p_extra_amount numeric default null) returns json
language plpgsql security definer set search_path to 'public' as $$
declare r record; b record; v_role text; v_title text; v_body text; v_extra numeric := 0; v_old_price numeric; v_new_price numeric;
  v_grate numeric; v_hrate numeric; v_gc numeric := 0; v_hc numeric := 0; v_hours integer; v_paid boolean; v_to_pay numeric;
begin
  perform public._lapse_topups();
  select * into r from booking_change_requests where id = p_request for update;
  if not found then raise exception 'This change request does not exist.'; end if;
  v_role := coalesce(public.my_property_role(r.property_id), 'none');
  if v_role not in ('owner', 'manager') then raise exception 'Only the host or a manager can answer change requests.'; end if;
  if r.status <> 'pending' then raise exception 'This change was already answered (%).', r.status; end if;
  if p_decision not in ('approved', 'declined') then raise exception 'Not a recognised decision.'; end if;
  if p_decision = 'declined' and nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'Please give the guest a short reason.'; end if;
  if p_extra_amount is not null and (p_extra_amount < 0 or p_extra_amount > 1000000000) then raise exception 'The extra amount must be between 0 and 1,000,000,000.'; end if;
  select * into b from shortlet_bookings where id = r.booking_id for update;
  select title into v_title from properties where id = r.property_id;

  if p_decision = 'declined' then
    update booking_change_requests set status = 'declined', host_note = nullif(trim(coalesce(p_note, '')), ''), decided_by = auth.uid(), decided_at = now() where id = r.id;
    v_body := 'About ' || v_title || ' (' || b.check_in || '): the venue could not accept your change.';
    if nullif(trim(coalesce(p_note, '')), '') is not null then v_body := v_body || E'\nNote: ' || trim(p_note); end if;
    perform notify_user(b.guest_id, 'Your change was not approved', v_body, '/my-bookings?b=' || b.id);
    perform log_audit_event('booking_change_decided', 'booking_change_requests', r.id, 'declined', null);
    return json_build_object('status', 'declined', 'over_capacity', r.over_capacity, 'extra', 0);
  end if;

  if b.status not in ('awaiting_payment', 'confirmed') then raise exception 'This booking is no longer open to changes.'; end if;
  if r.over_capacity and p_tier_id is null and p_extra_amount is null then
    raise exception 'The new number of guests is more than the booked hall allows. Pick the bigger hall tier (the price difference is charged through CHS) or enter an extra amount (0 if there is none).';
  end if;

  -- the extra: the price difference of a bigger tier, plus any other amount the host adds
  if p_tier_id is not null then
    select price into v_new_price from event_capacity_tiers where id = p_tier_id and property_id = r.property_id;
    if v_new_price is null then raise exception 'That hall tier does not belong to this venue.'; end if;
    select price into v_old_price from event_capacity_tiers where property_id = r.property_id and label = b.selected_tier_label limit 1;
    v_extra := greatest(v_new_price - coalesce(v_old_price, 0), 0);
  end if;
  v_extra := v_extra + coalesce(p_extra_amount, 0);
  if v_extra > 0 and b.total_price > 0 then
    v_grate := coalesce(b.guest_commission_amount, 0) / b.total_price;
    v_hrate := coalesce(b.host_commission_amount, 0) / b.total_price;
    v_gc := round(v_extra * v_grate, 2);
    v_hc := round(v_extra * v_hrate, 2);
  end if;
  v_paid := b.payment_status = 'held_escrow';
  v_to_pay := v_extra + v_gc;

  update booking_change_requests set new_tier_id = p_tier_id, extra_base = v_extra, extra_guest_commission = v_gc, extra_host_commission = v_hc,
    host_note = nullif(trim(coalesce(p_note, '')), ''), decided_by = auth.uid() where id = r.id;

  if v_extra > 0 and v_paid then
    v_hours := booking_setting_int('booking_topup_pay_hours', 24);
    update booking_change_requests set status = 'awaiting_topup', topup_expires_at = now() + make_interval(hours => v_hours), decided_at = now() where id = r.id;
    perform notify_user(b.guest_id, '✅ Approved: pay the extra to confirm your change',
      'The venue approved your change for ' || v_title || '. The extra cost is ' || fmt_naira(v_to_pay) || ' (' || fmt_naira(v_extra) || ' plus CHS''s fee). Pay it from your wallet within ' || v_hours || ' hours and the change takes effect; if you do not, your booking stays as it is.'
      || case when nullif(trim(coalesce(p_note, '')), '') is not null then E'\nNote: ' || trim(p_note) else '' end, '/my-bookings?b=' || b.id);
    perform log_audit_event('booking_change_decided', 'booking_change_requests', r.id, 'approved_awaiting_topup', jsonb_build_object('extra', v_extra));
    return json_build_object('status', 'awaiting_topup', 'over_capacity', r.over_capacity, 'extra', v_extra, 'guest_pays', v_to_pay);
  end if;

  -- no extra cost, or the booking is not paid yet: apply now (an unpaid booking simply costs more when paid)
  if v_extra > 0 then
    update shortlet_bookings set total_price = total_price + v_extra, guest_commission_amount = coalesce(guest_commission_amount, 0) + v_gc,
      host_commission_amount = coalesce(host_commission_amount, 0) + v_hc where id = b.id;
  end if;
  perform public._apply_booking_change(r.id);
  update booking_change_requests set status = 'approved', decided_at = now() where id = r.id;
  v_body := 'About ' || v_title || ' (' || coalesce(r.new_check_in, b.check_in) || '): the venue approved your change'
    || case when r.new_check_in is not null then ': your new date is ' || r.new_check_in else '' end
    || case when r.new_guests is not null then ', now ' || r.new_guests || ' guests' else '' end || '.'
    || case when v_extra > 0 then ' The price rose by ' || fmt_naira(v_to_pay) || ', which you pay when you pay for the booking.' else '' end;
  if nullif(trim(coalesce(p_note, '')), '') is not null then v_body := v_body || E'\nNote: ' || trim(p_note); end if;
  perform notify_user(b.guest_id, '✓ Your change was approved', v_body, '/my-bookings?b=' || b.id);
  perform log_audit_event('booking_change_decided', 'booking_change_requests', r.id, 'approved', jsonb_build_object('extra', v_extra));
  return json_build_object('status', 'approved', 'over_capacity', r.over_capacity, 'extra', v_extra, 'guest_pays', v_to_pay);
end $$;

-- the guest pays the extra for an approved change; money goes into escrow with the original payment
create or replace function public.pay_booking_topup(p_request uuid) returns json
language plpgsql security definer set search_path to 'public' as $$
declare r record; b record; v_title text; v_host uuid; v_total numeric; v_balance numeric; v_ref text; n int;
begin
  perform public._lapse_topups();
  select * into r from booking_change_requests where id = p_request for update;
  if not found or r.requested_by <> auth.uid() then raise exception 'This is not your change request.'; end if;
  if r.status <> 'awaiting_topup' then raise exception 'This change is not waiting for payment (it is now: %).', r.status; end if;
  select * into b from shortlet_bookings where id = r.booking_id for update;
  if b.status <> 'confirmed' or b.payment_status <> 'held_escrow' then raise exception 'This booking is no longer open to changes.'; end if;
  if b.check_in < (now() at time zone 'Africa/Lagos')::date then raise exception 'This booking has already started.'; end if;
  v_total := r.extra_base + r.extra_guest_commission;
  select main_balance into v_balance from wallets where user_id = auth.uid() for update;
  if v_balance is null or v_balance < v_total then raise exception 'insufficient_balance'; end if;
  select owner_id, title into v_host, v_title from properties where id = b.property_id;
  v_ref := 'TOP-' || substr(r.id::text, 1, 8);

  update wallets set main_balance = main_balance - v_total, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', v_total, 'debit', 'Extra for your changed booking at ' || v_title || ' (held in escrow)', v_ref);

  update shortlet_bookings set total_price = total_price + r.extra_base, guest_commission_amount = coalesce(guest_commission_amount, 0) + r.extra_guest_commission,
    host_commission_amount = coalesce(host_commission_amount, 0) + r.extra_host_commission where id = b.id;

  -- CHS's commission records grow by the same amounts
  update transaction_commissions set base_amount = base_amount + r.extra_base, commission_amount = commission_amount + r.extra_guest_commission,
    commission_percentage = round((commission_amount + r.extra_guest_commission) / nullif(base_amount + r.extra_base, 0) * 100, 2)
  where shortlet_booking_id = b.id and payer_role = 'guest';
  get diagnostics n = row_count;
  if n = 0 and r.extra_guest_commission > 0 then
    insert into transaction_commissions (transaction_type, shortlet_booking_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount, status, paid_at)
    values ('shortlet_hire', b.id, b.property_id, b.guest_id, 'guest', r.extra_base, round(r.extra_guest_commission / nullif(r.extra_base, 0) * 100, 2), r.extra_guest_commission, 'paid', now());
  end if;
  update transaction_commissions set base_amount = base_amount + r.extra_base, commission_amount = commission_amount + r.extra_host_commission,
    commission_percentage = round((commission_amount + r.extra_host_commission) / nullif(base_amount + r.extra_base, 0) * 100, 2)
  where shortlet_booking_id = b.id and payer_role = 'host';

  perform public._apply_booking_change(r.id);
  update booking_change_requests set status = 'approved', topup_paid_at = now() where id = r.id;

  perform notify_user(auth.uid(), '✓ Change confirmed and paid', 'Your change at ' || v_title || ' is confirmed. ' || fmt_naira(v_total) || ' is held safely by CHS with the rest of your booking payment.', '/my-bookings?b=' || b.id);
  perform notify_user(v_host, '💰 Extra paid: change confirmed', b.guest_full_name || ' paid ' || fmt_naira(v_total) || ' extra for the changed booking at ' || v_title || '. It is held by CHS and released to you with the rest of the payment, net of CHS commission.', '/host?tab=paid');
  perform notify_admins_by_domain('owner_buyer_tenant', '💰 Booking top-up paid', b.guest_full_name || ' paid ' || fmt_naira(v_total) || ' extra on ' || v_title || ' (' || v_ref || '). CHS commission added: guest ' || fmt_naira(r.extra_guest_commission) || ', host ' || fmt_naira(r.extra_host_commission) || '.', '/admin?tab=escrowoversight');
  perform log_audit_event('booking_topup_paid', 'booking_change_requests', r.id, v_ref, jsonb_build_object('amount', v_total));
  return json_build_object('status', 'approved', 'paid', v_total);
end $$;

create or replace function public.get_my_booking_changes(p_booking uuid) returns json
language plpgsql security definer set search_path to 'public' as $$
declare v_guest uuid;
begin
  perform public._lapse_topups();
  select guest_id into v_guest from shortlet_bookings where id = p_booking;
  if v_guest is null or v_guest <> auth.uid() then raise exception 'This is not your booking.'; end if;
  return coalesce((select json_agg(json_build_object('id', c.id, 'old_guests', c.old_guests, 'new_guests', c.new_guests, 'new_check_in', c.new_check_in, 'new_check_out', c.new_check_out,
    'services', c.services, 'note', c.note, 'status', c.status, 'host_note', c.host_note, 'created_at', c.created_at, 'decided_at', c.decided_at,
    'extra_base', c.extra_base, 'to_pay', c.extra_base + c.extra_guest_commission, 'topup_expires_at', c.topup_expires_at) order by c.created_at desc)
    from booking_change_requests c where c.booking_id = p_booking), '[]'::json);
end $$;

-- the console: change requests now carry the date move, the extra and the hall tiers to choose from
create or replace function public.get_host_console() returns json
language plpgsql security definer set search_path to 'public' as $$
declare v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  perform public._lapse_topups();
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
        'new_check_in', c.new_check_in, 'new_check_out', c.new_check_out, 'extra_base', c.extra_base, 'to_pay', c.extra_base + c.extra_guest_commission, 'topup_expires_at', c.topup_expires_at,
        'status', c.status, 'host_note', c.host_note, 'over_capacity', c.over_capacity, 'tier', b.selected_tier_label, 'created_at', c.created_at, 'decided_at', c.decided_at,
        'tiers', (select coalesce(json_agg(json_build_object('id', t.id, 'label', t.label, 'max_guests', t.max_guests, 'price', t.price) order by t.max_guests), '[]'::json) from event_capacity_tiers t where t.property_id = c.property_id),
        'current_tier_price', (select t.price from event_capacity_tiers t where t.property_id = c.property_id and t.label = b.selected_tier_label limit 1))
        order by (c.status = 'pending') desc, c.created_at desc), '[]'::json)
        from booking_change_requests c join props pr on pr.id = c.property_id join shortlet_bookings b on b.id = c.booking_id
        where c.status in ('pending', 'awaiting_topup') or c.created_at > now() - interval '30 days'),
      'services', (select coalesce(json_agg(json_build_object('booking_id', s.booking_id, 'service', s.service, 'label', public._service_label(s.service), 'quantity', s.quantity,
        'status', s.status, 'provider_name', s.provider_name, 'price', s.price, 'note', s.note, 'property_title', pr.title, 'cat', pr.cat, 'my_role', pr.myrole,
        'guest_name', b.guest_full_name, 'check_in', b.check_in, 'booking_status', b.status)
        order by (s.status = 'requested') desc, b.check_in), '[]'::json)
        from booking_services s join props pr on pr.id = s.property_id join shortlet_bookings b on b.id = s.booking_id
        where b.status in ('pending_host_review', 'awaiting_payment', 'confirmed') and b.check_out >= v_today and s.status <> 'cancelled')
    )
  );
end $$;

grant execute on function public.request_booking_change(uuid, integer, jsonb, text, date), public.withdraw_booking_change(uuid),
  public.host_decide_change(uuid, text, text, uuid, numeric), public.pay_booking_topup(uuid), public.get_my_booking_changes(uuid), public.get_host_console() to authenticated;
