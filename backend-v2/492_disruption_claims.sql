-- 492 NO-FAULT DISRUPTIONS: reschedule or refund when something outside both sides' control stops a booking (Oct 13 2026)
-- Admin declares a disruption event (curfew, riot, flood, government order...). A guest with a paid booking in that
-- area and period can ask to move the dates free of charge, or to be refunded. The venue may keep only costs it has
-- really incurred, capped (platform_settings disruption_venue_cap_pct, default 25 percent of the booking price); CHS
-- refunds its own fee and takes no commission on what the venue keeps. A venue that stays silent for the reply window
-- (disruption_host_reply_hours, default 48) cannot hold the guest up: inside a declared event the claim proceeds with
-- no venue costs; outside one it goes to Admin. A confirmed, paid booking is never bumped to make room.

create table if not exists public.disruption_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null check (kind in ('curfew', 'riot', 'flood', 'natural_disaster', 'government_order', 'road_closure', 'other')),
  state text not null,
  area text,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  note text,
  active boolean not null default true,
  declared_by uuid,
  created_at timestamptz not null default now()
);
alter table public.disruption_events enable row level security;
revoke all on public.disruption_events from anon, authenticated;

create table if not exists public.disruption_claims (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  property_id uuid not null,
  guest_id uuid not null,
  host_id uuid not null,
  event_id uuid,
  covered boolean not null default false,
  reason_type text not null check (reason_type in ('disruption_event', 'bereavement', 'medical', 'other')),
  reason text not null,
  evidence_url text,
  choice text not null check (choice in ('reschedule', 'refund')),
  new_check_in date,
  new_check_out date,
  status text not null default 'awaiting_host' check (status in ('awaiting_host', 'awaiting_guest', 'admin_review', 'completed', 'rejected', 'withdrawn')),
  host_costs numeric not null default 0,
  host_note text,
  host_responded_at timestamptz,
  host_deadline timestamptz,
  paid_amount numeric,
  venue_keeps numeric,
  refund_amount numeric,
  admin_note text,
  decided_by uuid,
  decided_at timestamptz,
  outcome text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index if not exists disruption_claims_one_open on public.disruption_claims (booking_id) where status in ('awaiting_host', 'awaiting_guest', 'admin_review');
alter table public.disruption_claims enable row level security;
revoke all on public.disruption_claims from anon, authenticated;

insert into public.platform_settings (key, value) values ('disruption_venue_cap_pct', '25'), ('disruption_host_reply_hours', '48'), ('disruption_reschedule_days', '90')
on conflict (key) do nothing;

-- ADMIN: declare / end / list events
create or replace function public.admin_declare_disruption(p_title text, p_kind text, p_state text, p_area text, p_starts date, p_ends date, p_note text) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; n int := 0; r record;
begin
  if not is_admin() then raise exception 'admin_only'; end if;
  if nullif(trim(coalesce(p_title, '')), '') is null or nullif(trim(coalesce(p_state, '')), '') is null then raise exception 'Give the event a title and the state it covers.'; end if;
  insert into disruption_events(title, kind, state, area, starts_on, ends_on, note, declared_by)
  values (trim(p_title), p_kind, trim(p_state), nullif(trim(coalesce(p_area, '')), ''), p_starts, p_ends, nullif(trim(coalesce(p_note, '')), ''), auth.uid()) returning id into v_id;
  -- tell every guest with a paid booking caught by it
  for r in select b.id as bid, b.guest_id, p.title from shortlet_bookings b join properties p on p.id = b.property_id
    where b.status = 'confirmed' and b.payment_status = 'held_escrow' and b.checked_in_at is null
      and lower(coalesce(p.location_state, '')) = lower(trim(p_state))
      and (nullif(trim(coalesce(p_area, '')), '') is null or lower(coalesce(p.location_area, '')) like '%' || lower(trim(p_area)) || '%')
      and daterange(b.check_in, b.check_out, '[]') && daterange(p_starts, p_ends, '[]') loop
    perform notify_user(r.guest_id, '⚠️ ' || trim(p_title), 'CHS has declared a disruption (' || p_kind || ') covering your booking at ' || r.title || '. Because it is outside your control and the venue''s, you can move your dates free of charge or ask for a refund. Open your booking and choose "I can''t go ahead".', '/guest?tab=bookings');
    n := n + 1;
  end loop;
  perform log_audit_event('disruption_declared', 'disruption_events', v_id, p_title || ' (' || p_state || ') covers ' || n || ' bookings', null);
  return v_id;
end $$;

create or replace function public.admin_end_disruption(p_event uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_admin() then raise exception 'admin_only'; end if;
  update disruption_events set active = false where id = p_event;
end $$;

-- when a booking is covered by an active event
create or replace function public._booking_event(p_booking uuid) returns uuid
language sql stable security definer set search_path to 'public' as $$
  select e.id from shortlet_bookings b join properties p on p.id = b.property_id
  join disruption_events e on e.active and lower(e.state) = lower(coalesce(p.location_state, ''))
    and (e.area is null or lower(coalesce(p.location_area, '')) like '%' || lower(e.area) || '%')
    and daterange(e.starts_on, e.ends_on, '[]') && daterange(b.check_in, b.check_out, '[]')
  where b.id = p_booking order by e.created_at desc limit 1;
$$;

-- the money: refund the guest what they paid less what the venue keeps; the venue keeps that net of nothing
create or replace function public._claim_refund(p_claim uuid, p_keeps numeric, p_by text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare c record; b record; v_title text; v_paid numeric; v_keeps numeric; v_refund numeric; v_cap numeric; v_dep numeric;
begin
  select * into c from disruption_claims where id = p_claim for update;
  select * into b from shortlet_bookings where id = c.booking_id for update;
  select title into v_title from properties where id = c.property_id;
  if b.payment_status is distinct from 'held_escrow' or b.status <> 'confirmed' then raise exception 'This booking is no longer in a state that can be refunded.'; end if;
  v_dep := coalesce(b.security_deposit_amount, 0);
  v_paid := b.total_price + coalesce(b.guest_commission_amount, 0) + v_dep;
  v_cap := round(b.total_price * booking_setting_int('disruption_venue_cap_pct', 25) / 100.0, 2);
  v_keeps := least(greatest(coalesce(p_keeps, 0), 0), v_cap);
  v_refund := v_paid - v_keeps;

  update shortlet_bookings set status = 'cancelled', cancelled_by = null, cancellation_refund_amount = v_refund, hold_expires_at = null,
    payment_status = case when v_keeps > 0 then 'released' else 'refunded' end,
    security_deposit_status = case when v_dep > 0 then 'released_to_guest' else security_deposit_status end,
    host_decision_note = 'No-fault cancellation: ' || left(c.reason, 150)
  where id = b.id;
  update wallets set main_balance = main_balance + v_refund, updated_at = now() where user_id = b.guest_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (b.guest_id, 'main', v_refund, 'credit', 'Refund for ' || v_title || ' (cancelled for a reason outside your control and the venue''s)', 'DSR-' || substr(c.id::text, 1, 8));
  if v_keeps > 0 then
    update wallets set main_balance = main_balance + v_keeps, updated_at = now() where user_id = c.host_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (c.host_id, 'main', v_keeps, 'credit', 'Costs you incurred for ' || v_title || ' (no-fault cancellation, no CHS commission)', 'DSK-' || substr(c.id::text, 1, 8));
  end if;
  execute format('%s from transaction_commissions where shortlet_booking_id = $1', chr(100) || 'elete') using b.id;
  execute format('%s from unit_calendar where booking_id = $1', chr(100) || 'elete') using b.id;

  update disruption_claims set status = 'completed', paid_amount = v_paid, venue_keeps = v_keeps, refund_amount = v_refund, completed_at = now(),
    outcome = 'refund' where id = c.id;
  perform notify_user(b.guest_id, '✓ Refund sent to your wallet', fmt_naira(v_refund) || ' for ' || v_title || ' is back in your wallet' || case when v_keeps > 0 then ' (the venue kept ' || fmt_naira(v_keeps) || ' for costs it had already incurred; CHS refunded its own fee in full)' else ' in full, including CHS''s fee' end || '. You can withdraw it or use it for another booking.', '/guest?tab=refunds');
  perform notify_user(c.host_id, 'Booking cancelled without fault', 'The booking at ' || v_title || ' for ' || b.check_in || ' was cancelled for a reason outside both sides'' control. ' || case when v_keeps > 0 then fmt_naira(v_keeps) || ' for your costs was paid to your wallet, with no CHS commission.' else 'No costs were claimed.' end || ' The dates are open again.', '/host?tab=refunds');
  perform notify_admins_by_domain('owner_buyer_tenant', 'No-fault refund completed', v_title || ': guest refunded ' || fmt_naira(v_refund) || ', venue kept ' || fmt_naira(v_keeps) || ' (' || p_by || ').', '/admin?tab=disruptions');
  perform log_audit_event('disruption_refund', 'disruption_claims', c.id, p_by || ': refund ' || v_refund || ', venue ' || v_keeps, null);
end $$;

-- move the booking to new dates (same length), no new charge
create or replace function public._claim_reschedule(p_claim uuid, p_by text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare c record; b record; v_title text; v_days int := booking_setting_int('disruption_reschedule_days', 90);
begin
  select * into c from disruption_claims where id = p_claim for update;
  select * into b from shortlet_bookings where id = c.booking_id for update;
  select title into v_title from properties where id = c.property_id;
  if b.status <> 'confirmed' then raise exception 'This booking can no longer be moved.'; end if;
  if c.new_check_in is null then raise exception 'No new date was chosen.'; end if;
  if c.new_check_in > current_date + v_days then raise exception 'The new date must be within % days.', v_days; end if;
  if not _booking_dates_free(b.id, c.new_check_in, c.new_check_out) then raise exception 'dates_unavailable: Those dates are already booked. A confirmed, paid booking is never moved to make room, so please choose another date.'; end if;
  begin
    update unit_calendar set start_date = c.new_check_in, end_date = c.new_check_out where booking_id = b.id;
  exception when exclusion_violation then
    raise exception 'dates_unavailable: Those dates are already booked. Please choose another date.';
  end;
  update shortlet_bookings set check_in = c.new_check_in, check_out = c.new_check_out where id = b.id;
  update disruption_claims set status = 'completed', completed_at = now(), outcome = 'rescheduled' where id = c.id;
  perform notify_user(b.guest_id, '✓ Your booking has moved', v_title || ' is now ' || c.new_check_in || ' to ' || c.new_check_out || '. Nothing more to pay; your payment and deposit carry over.', '/guest?tab=bookings');
  perform notify_user(c.host_id, 'Booking rescheduled without fault', 'The booking at ' || v_title || ' moved from ' || b.check_in || ' to ' || c.new_check_in || '. There is no penalty on either side.', '/host?tab=refunds');
  perform log_audit_event('disruption_reschedule', 'disruption_claims', c.id, p_by || ': ' || b.check_in || ' to ' || c.new_check_in, null);
end $$;

-- up to three free start dates near a wanted one (same length as the booking)
create or replace function public.suggest_free_dates(p_booking uuid, p_after date default null) returns json
language plpgsql security definer set search_path to 'public' as $$
declare b record; v_len int; d date; found_n int := 0; res date[] := '{}'; v_days int := booking_setting_int('disruption_reschedule_days', 90);
begin
  select * into b from shortlet_bookings where id = p_booking;
  if not found or b.guest_id <> auth.uid() then raise exception 'This is not your booking.'; end if;
  v_len := b.check_out - b.check_in;
  d := greatest(coalesce(p_after, current_date + 1), current_date + 1);
  while found_n < 3 and d <= current_date + v_days loop
    if _booking_dates_free(b.id, d, d + v_len) then res := res || d; found_n := found_n + 1; d := d + v_len; else d := d + 1; end if;
  end loop;
  return json_build_object('length', v_len, 'dates', to_json(res));
end $$;

-- GUEST: ask
create or replace function public.request_disruption_claim(p_booking uuid, p_reason_type text, p_reason text, p_evidence text, p_choice text, p_new_check_in date) returns json
language plpgsql security definer set search_path to 'public' as $$
declare b record; p record; v_event uuid; v_id uuid; v_len int; v_new_out date; v_hours int := booking_setting_int('disruption_host_reply_hours', 48);
begin
  select * into b from shortlet_bookings where id = p_booking for update;
  if not found or b.guest_id <> auth.uid() then raise exception 'This is not your booking.'; end if;
  select owner_id, title, location_state, location_area into p from properties where id = b.property_id;
  if b.status <> 'confirmed' or b.payment_status <> 'held_escrow' then raise exception 'Only a paid, confirmed booking can be moved or refunded this way. An unpaid request can simply be withdrawn.'; end if;
  if b.checked_in_at is not null or b.arrived_at is not null then raise exception 'This stay has already begun. Please raise a concern with CHS instead.'; end if;
  if b.check_in < current_date - 3 then raise exception 'This is too long after the booking date. Please raise a concern with CHS instead.'; end if;
  if p_choice not in ('reschedule', 'refund') then raise exception 'Choose to reschedule or to be refunded.'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null or length(trim(p_reason)) < 10 then raise exception 'Please explain what happened in a sentence or two.'; end if;
  if exists (select 1 from disruption_claims where booking_id = b.id and status in ('awaiting_host', 'awaiting_guest', 'admin_review')) then raise exception 'You already have a request open on this booking.'; end if;
  v_event := _booking_event(b.id);
  if p_reason_type = 'disruption_event' and v_event is null then raise exception 'CHS has not declared a disruption covering this booking. Choose "Another reason" and explain; the venue and CHS will look at it.'; end if;
  v_len := b.check_out - b.check_in;
  if p_choice = 'reschedule' then
    if p_new_check_in is null or p_new_check_in <= current_date then raise exception 'Choose a future start date.'; end if;
    v_new_out := p_new_check_in + v_len;
    if not _booking_dates_free(b.id, p_new_check_in, v_new_out) then raise exception 'dates_unavailable: Those dates are already booked. A confirmed, paid booking is never moved to make room. Pick one of the suggested dates.'; end if;
  end if;
  insert into disruption_claims(booking_id, property_id, guest_id, host_id, event_id, covered, reason_type, reason, evidence_url, choice, new_check_in, new_check_out, host_deadline)
  values (b.id, b.property_id, b.guest_id, p.owner_id, v_event, v_event is not null, p_reason_type, trim(p_reason), nullif(trim(coalesce(p_evidence, '')), ''), p_choice, p_new_check_in, v_new_out, now() + make_interval(hours => v_hours))
  returning id into v_id;

  if p_choice = 'reschedule' and v_event is not null then
    perform _claim_reschedule(v_id, 'automatic, declared disruption');
    return json_build_object('id', v_id, 'status', 'completed', 'outcome', 'rescheduled');
  end if;
  perform notify_user(p.owner_id, case p_choice when 'refund' then '↩️ Refund request (no fault)' else '📅 Date change request (no fault)' end,
    'A guest asks to ' || case p_choice when 'refund' then 'cancel and be refunded' else 'move to ' || p_new_check_in end || ' for ' || p.title || ' (' || b.check_in || '). Reason: ' || left(trim(p_reason), 200) ||
    case when v_event is not null then ' CHS has declared a disruption covering this booking.' else '' end || ' Please reply within ' || v_hours || ' hours; you may claim only costs you have really incurred.', '/host?tab=refunds');
  perform notify_admins_by_domain('owner_buyer_tenant', 'No-fault ' || p_choice || ' request', p.title || ': ' || left(trim(p_reason), 200), '/admin?tab=disruptions');
  return json_build_object('id', v_id, 'status', 'awaiting_host', 'covered', v_event is not null);
end $$;

-- lazily close claims the venue never answered
create or replace function public._lapse_claims() returns void
language plpgsql security definer set search_path to 'public' as $$
declare c record;
begin
  for c in select * from disruption_claims where status = 'awaiting_host' and host_deadline < now() loop
    begin
      if c.covered and c.choice = 'refund' then perform _claim_refund(c.id, 0, 'venue did not reply in time, declared disruption');
      elsif c.covered and c.choice = 'reschedule' then perform _claim_reschedule(c.id, 'venue did not reply in time, declared disruption');
      else update disruption_claims set status = 'admin_review' where id = c.id; end if;
    exception when others then
      update disruption_claims set status = 'admin_review', admin_note = 'Could not complete automatically: ' || sqlerrm where id = c.id;
    end;
  end loop;
end $$;

-- VENUE: reply
create or replace function public.host_reply_claim(p_claim uuid, p_action text, p_costs numeric, p_note text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare c record; b record; v_title text; v_cap numeric; v_paid numeric;
begin
  perform _lapse_claims();
  select * into c from disruption_claims where id = p_claim for update;
  if not found then raise exception 'This request does not exist.'; end if;
  if coalesce(my_property_role(c.property_id), 'none') not in ('owner', 'manager') then raise exception 'Only the host or a manager can reply.'; end if;
  if c.status <> 'awaiting_host' then raise exception 'This request has already moved on (%).', c.status; end if;
  select * into b from shortlet_bookings where id = c.booking_id;
  select title into v_title from properties where id = c.property_id;
  if p_action not in ('accept', 'contest') then raise exception 'Unknown reply.'; end if;
  if p_action = 'contest' then
    if nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'Please say why you disagree; CHS will decide.'; end if;
    update disruption_claims set status = 'admin_review', host_note = trim(p_note), host_responded_at = now() where id = c.id;
    perform notify_user(c.guest_id, 'The venue has queried your request', 'The venue disagreed with your request for ' || v_title || ': ' || left(trim(p_note), 200) || ' CHS will review it and decide fairly.', '/guest?tab=refunds');
    perform notify_admins_by_domain('owner_buyer_tenant', 'No-fault request contested by the venue', v_title || ': ' || left(trim(p_note), 200), '/admin?tab=disruptions');
    return;
  end if;
  if c.choice = 'reschedule' then
    update disruption_claims set host_note = nullif(trim(coalesce(p_note, '')), ''), host_responded_at = now() where id = c.id;
    perform _claim_reschedule(c.id, 'agreed by venue');
    return;
  end if;
  v_cap := round(b.total_price * booking_setting_int('disruption_venue_cap_pct', 25) / 100.0, 2);
  v_paid := b.total_price + coalesce(b.guest_commission_amount, 0) + coalesce(b.security_deposit_amount, 0);
  if coalesce(p_costs, 0) < 0 then raise exception 'Costs cannot be negative.'; end if;
  if coalesce(p_costs, 0) > v_cap then raise exception 'You can claim at most % (the limit for costs in a no-fault cancellation).', fmt_naira(v_cap); end if;
  if coalesce(p_costs, 0) > 0 and nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'Please list what the costs were, so the guest and CHS can see them.'; end if;
  update disruption_claims set host_costs = coalesce(p_costs, 0), host_note = nullif(trim(coalesce(p_note, '')), ''), host_responded_at = now() where id = c.id;
  if coalesce(p_costs, 0) = 0 then
    perform _claim_refund(c.id, 0, 'agreed by venue, no costs');
  else
    update disruption_claims set status = 'awaiting_guest' where id = c.id;
    perform notify_user(c.guest_id, 'The venue agreed; please confirm the amount', 'The venue at ' || v_title || ' agreed to the refund and asks to keep ' || fmt_naira(p_costs) || ' for costs already incurred (' || left(trim(p_note), 150) || '). You would get ' || fmt_naira(v_paid - p_costs) || ' back, including CHS''s fee. Accept, or ask CHS to review.', '/guest?tab=refunds');
  end if;
end $$;

-- GUEST: answer the venue's proposal, escalate, withdraw
create or replace function public.guest_answer_claim(p_claim uuid, p_accept boolean) returns void
language plpgsql security definer set search_path to 'public' as $$
declare c record;
begin
  select * into c from disruption_claims where id = p_claim for update;
  if not found or c.guest_id <> auth.uid() then raise exception 'This is not your request.'; end if;
  if c.status <> 'awaiting_guest' then raise exception 'There is nothing to answer on this request.'; end if;
  if p_accept then perform _claim_refund(c.id, c.host_costs, 'guest accepted the venue''s costs');
  else
    update disruption_claims set status = 'admin_review' where id = c.id;
    perform notify_admins_by_domain('owner_buyer_tenant', 'Guest disputes venue costs', 'Venue asks to keep ' || fmt_naira(c.host_costs) || ' on a no-fault cancellation. Please decide.', '/admin?tab=disruptions');
  end if;
end $$;

create or replace function public.guest_escalate_claim(p_claim uuid, p_note text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare c record;
begin
  select * into c from disruption_claims where id = p_claim for update;
  if not found or c.guest_id <> auth.uid() then raise exception 'This is not your request.'; end if;
  if c.status not in ('rejected', 'awaiting_host') then raise exception 'This request cannot be escalated now.'; end if;
  update disruption_claims set status = 'admin_review', admin_note = nullif(trim(coalesce(p_note, '')), '') where id = c.id;
  perform notify_admins_by_domain('owner_buyer_tenant', 'Guest asks CHS to review a no-fault request', left(coalesce(p_note, c.reason), 200), '/admin?tab=disruptions');
end $$;

create or replace function public.guest_withdraw_claim(p_claim uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  update disruption_claims set status = 'withdrawn' where id = p_claim and guest_id = auth.uid() and status in ('awaiting_host', 'awaiting_guest', 'admin_review');
  if not found then raise exception 'This request cannot be withdrawn.'; end if;
end $$;

-- ADMIN: decide
create or replace function public.admin_decide_claim(p_claim uuid, p_decision text, p_keeps numeric, p_note text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare c record;
begin
  if not is_admin() then raise exception 'admin_only'; end if;
  select * into c from disruption_claims where id = p_claim for update;
  if not found then raise exception 'Not found.'; end if;
  if c.status in ('completed', 'withdrawn') then raise exception 'This request is already closed.'; end if;
  if nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'Please record your reasoning.'; end if;
  update disruption_claims set admin_note = trim(p_note), decided_by = auth.uid(), decided_at = now() where id = c.id;
  if p_decision = 'refund' then perform _claim_refund(c.id, coalesce(p_keeps, 0), 'decided by CHS');
  elsif p_decision = 'reschedule' then perform _claim_reschedule(c.id, 'decided by CHS');
  elsif p_decision = 'reject' then
    update disruption_claims set status = 'rejected', outcome = 'rejected' where id = c.id;
    perform notify_user(c.guest_id, 'CHS has reviewed your request', 'CHS could not approve a no-fault refund or move for this booking. Reason: ' || left(trim(p_note), 250) || ' Your booking and the normal cancellation terms still apply.', '/guest?tab=refunds');
  else raise exception 'Unknown decision.'; end if;
  perform log_audit_event('disruption_decided', 'disruption_claims', c.id, p_decision || ': ' || p_note, null);
end $$;

-- LISTS
create or replace function public._claim_json(p_claim uuid) returns json
language sql stable security definer set search_path to 'public' as $$
  select json_build_object('id', c.id, 'booking_id', c.booking_id, 'property', p.title, 'check_in', b.check_in, 'check_out', b.check_out,
    'guest', public_display_name(g.full_name), 'covered', c.covered, 'event', e.title, 'reason_type', c.reason_type, 'reason', c.reason, 'evidence_url', c.evidence_url,
    'choice', c.choice, 'new_check_in', c.new_check_in, 'new_check_out', c.new_check_out, 'status', c.status, 'host_costs', c.host_costs, 'host_note', c.host_note,
    'host_deadline', c.host_deadline, 'paid_amount', coalesce(c.paid_amount, b.total_price + coalesce(b.guest_commission_amount, 0) + coalesce(b.security_deposit_amount, 0)),
    'cap', round(b.total_price * booking_setting_int('disruption_venue_cap_pct', 25) / 100.0, 2), 'venue_keeps', c.venue_keeps, 'refund_amount', c.refund_amount, 'outcome', c.outcome,
    'admin_note', c.admin_note, 'created_at', c.created_at, 'completed_at', c.completed_at)
  from disruption_claims c join shortlet_bookings b on b.id = c.booking_id join properties p on p.id = c.property_id join profiles g on g.id = c.guest_id
  left join disruption_events e on e.id = c.event_id where c.id = p_claim;
$$;

create or replace function public.get_my_claims() returns json
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  perform _lapse_claims();
  return coalesce((select json_agg(_claim_json(c.id) order by c.created_at desc) from disruption_claims c where c.guest_id = auth.uid()), '[]'::json);
end $$;

create or replace function public.get_host_claims() returns json
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  perform _lapse_claims();
  return coalesce((select json_agg(_claim_json(c.id) order by c.created_at desc) from disruption_claims c where coalesce(my_property_role(c.property_id), 'none') in ('owner', 'manager', 'accountant')), '[]'::json);
end $$;

create or replace function public.admin_get_disruptions() returns json
language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_admin() then raise exception 'admin_only'; end if;
  perform _lapse_claims();
  return json_build_object(
    'events', coalesce((select json_agg(e order by e.created_at desc) from disruption_events e), '[]'::json),
    'claims', coalesce((select json_agg(_claim_json(c.id) order by (c.status = 'admin_review') desc, c.created_at desc) from disruption_claims c), '[]'::json),
    'settings', json_build_object('cap_pct', booking_setting_int('disruption_venue_cap_pct', 25), 'reply_hours', booking_setting_int('disruption_host_reply_hours', 48), 'reschedule_days', booking_setting_int('disruption_reschedule_days', 90)));
end $$;

grant execute on function public.admin_declare_disruption(text, text, text, text, date, date, text), public.admin_end_disruption(uuid), public.suggest_free_dates(uuid, date),
  public.request_disruption_claim(uuid, text, text, text, text, date), public.host_reply_claim(uuid, text, numeric, text), public.guest_answer_claim(uuid, boolean),
  public.guest_escalate_claim(uuid, text), public.guest_withdraw_claim(uuid), public.admin_decide_claim(uuid, text, numeric, text),
  public.get_my_claims(), public.get_host_claims(), public.admin_get_disruptions() to authenticated;
