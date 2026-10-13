-- 496 SERVICE PAYMENTS: EVERY PAYMENT GOES THROUGH CHS (Oct 13 2026). Replaces the "direct to venue" rule of migration 490.
-- Whatever a guest pays for services (the venue's quotation instalments, a service the venue supplies, a service CHS sourced) is
-- taken from the guest's CHS wallet and HELD by CHS, exactly like the hall booking. It is released with the booking payout.
--   Guest pays:   service price + guest fee (service_guest_pct, default 6%)
--   Venue's own services: venue receives price - service_host_pct (default 4%)
--   CHS-sourced services: provider is owed price - service_provider_pct (default 10%); CHS pays the provider (admin marks it paid);
--                         optional service_venue_referral_pct of CHS's commission goes to the referring venue (default 0%)
-- Cancellation: same policy as the booking (venue cancels / declined / expired / no-fault: full refund incl. fee; guest cancels
-- 48h or more before: full; under 48h: 50%; after the start: 0%). The kept part goes to the venue or provider as above.
-- Recording payments "received outside CHS" is switched off.

insert into public.platform_settings (key, value) values
  ('service_guest_pct', '6'), ('service_host_pct', '4'), ('service_provider_pct', '10'), ('service_venue_referral_pct', '0')
on conflict (key) do nothing;
update public.platform_settings set value = 'off' where key = 'event_quote_manual_payment';

alter table public.booking_services add column if not exists paid_at timestamptz;
alter table public.booking_services add column if not exists payment_ref text;

create table if not exists public.service_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  property_id uuid not null,
  payer_id uuid not null,
  host_id uuid not null,
  line_id uuid,
  milestone_id uuid,
  kind text not null check (kind in ('venue', 'sourced')),
  label text not null,
  amount numeric not null check (amount > 0),
  guest_fee numeric not null default 0,
  host_pct numeric not null default 0,
  referral_pct numeric not null default 0,
  status text not null default 'held' check (status in ('held', 'released', 'refunded', 'part_refunded')),
  refunded_amount numeric not null default 0,
  refunded_fee numeric not null default 0,
  chs_earned numeric not null default 0,
  provider_name text,
  provider_contact text,
  reference text not null,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
alter table public.service_payments enable row level security;
revoke all on public.service_payments from anon, authenticated;
create index if not exists service_payments_booking on public.service_payments (booking_id);
create unique index if not exists service_payments_one_per_line on public.service_payments (line_id) where line_id is not null and status in ('held', 'released', 'part_refunded');
create unique index if not exists service_payments_one_per_milestone on public.service_payments (milestone_id) where milestone_id is not null and status in ('held', 'released', 'part_refunded');

create table if not exists public.service_provider_payouts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique,
  booking_id uuid not null,
  property_id uuid not null,
  provider_name text,
  provider_contact text,
  amount_due numeric not null check (amount_due >= 0),
  status text not null default 'pending' check (status in ('pending', 'owed', 'paid', 'cancelled')),
  paid_at timestamptz,
  paid_ref text,
  paid_by uuid,
  note text,
  created_at timestamptz not null default now()
);
alter table public.service_provider_payouts enable row level security;
revoke all on public.service_provider_payouts from anon, authenticated;

create or replace function public._svc_pct(p_key text, p_default numeric) returns numeric
language sql stable security definer set search_path to 'public' as $$
  select coalesce((select value::numeric from platform_settings where key = p_key), p_default) $$;

create or replace function public._svc_credit(p_user uuid, p_amount numeric, p_desc text, p_ref text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  if p_amount is null or p_amount <= 0 then return; end if;
  update wallets set main_balance = main_balance + p_amount, updated_at = now() where user_id = p_user;
  get diagnostics n = row_count;
  if n = 0 then insert into wallets (user_id, main_balance) values (p_user, p_amount); end if;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference) values (p_user, 'main', p_amount, 'credit', p_desc, p_ref);
end $$;

-- take the money from the guest and hold it
create or replace function public._pay_service(p_booking uuid, p_kind text, p_label text, p_amount numeric, p_line uuid, p_milestone uuid, p_provider text, p_contact text) returns json
language plpgsql security definer set search_path to 'public' as $$
declare b record; v_host uuid; v_title text; v_bal numeric; v_frozen boolean; v_gp numeric; v_hp numeric; v_rp numeric; v_fee numeric; v_id uuid := gen_random_uuid(); v_ref text; v_name text;
begin
  select * into b from shortlet_bookings where id = p_booking;
  if not found or b.guest_id <> auth.uid() then raise exception 'This is not your booking.'; end if;
  if b.status not in ('awaiting_payment', 'confirmed') then raise exception 'You can pay for services once the venue has confirmed your dates.'; end if;
  if b.check_out < (now() at time zone 'Africa/Lagos')::date then raise exception 'This booking has already ended.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nothing to pay.'; end if;
  select owner_id, title into v_host, v_title from properties where id = b.property_id;
  select full_name into v_name from profiles where id = auth.uid();
  v_gp := public._svc_pct('service_guest_pct', 6);
  v_hp := case when p_kind = 'sourced' then public._svc_pct('service_provider_pct', 10) else public._svc_pct('service_host_pct', 4) end;
  v_rp := case when p_kind = 'sourced' then public._svc_pct('service_venue_referral_pct', 0) else 0 end;
  v_fee := round(p_amount * v_gp / 100, 2);
  select main_balance, frozen into v_bal, v_frozen from wallets where user_id = auth.uid() for update;
  if coalesce(v_frozen, false) then raise exception 'Your wallet is frozen. Please contact CHS.'; end if;
  if v_bal is null or v_bal < p_amount + v_fee then raise exception 'insufficient_balance'; end if;
  v_ref := 'SVP-' || substr(v_id::text, 1, 8);
  update wallets set main_balance = main_balance - (p_amount + v_fee), updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', p_amount + v_fee, 'debit', 'Event services at ' || v_title || ': ' || p_label || ' (' || fmt_naira(p_amount) || ' + CHS fee ' || fmt_naira(v_fee) || '), held by CHS until your event', v_ref);
  insert into service_payments (id, booking_id, property_id, payer_id, host_id, line_id, milestone_id, kind, label, amount, guest_fee, host_pct, referral_pct, provider_name, provider_contact, reference)
  values (v_id, b.id, b.property_id, auth.uid(), v_host, p_line, p_milestone, p_kind, p_label, p_amount, v_fee, v_hp, v_rp, p_provider, p_contact, v_ref);
  if p_kind = 'sourced' then
    insert into service_provider_payouts (payment_id, booking_id, property_id, provider_name, provider_contact, amount_due)
    values (v_id, b.id, b.property_id, p_provider, p_contact, p_amount - round(p_amount * v_hp / 100, 2));
  end if;
  perform notify_user(auth.uid(), '✓ Service payment received', fmt_naira(p_amount + v_fee) || ' for ' || p_label || ' at ' || v_title || ' is held safely by CHS and released after your event. Receipt ' || v_ref || '.', '/my-bookings?b=' || b.id);
  perform notify_user(v_host, '💰 A guest paid for services', coalesce(v_name, 'The guest') || ' paid ' || fmt_naira(p_amount) || ' for ' || p_label || ' (' || v_title || '). CHS holds it and pays it to you with your booking payout.', '/host?tab=services');
  if p_kind = 'sourced' then
    perform notify_admins_by_domain('owner_buyer_tenant', '💰 Sourced service paid', p_label || ' for ' || v_title || ' (' || b.check_in || ') was paid: ' || fmt_naira(p_amount) || '. Provider ' || coalesce(p_provider, '?') || ' is owed ' || fmt_naira(p_amount - round(p_amount * v_hp / 100, 2)) || '.', '/admin?tab=servicesourcing');
  end if;
  perform log_audit_event('service_payment_held', 'service_payments', v_id, v_ref, jsonb_build_object('amount', p_amount, 'fee', v_fee, 'kind', p_kind));
  return json_build_object('status', 'paid', 'reference', v_ref, 'amount', p_amount, 'fee', v_fee, 'total', p_amount + v_fee);
end $$;

-- the guest pays an instalment of the venue's quotation
create or replace function public.pay_quote_milestone(p_milestone uuid) returns json
language plpgsql security definer set search_path to 'public' as $$
declare m record; q record; b record; r json; v_ref text;
begin
  select * into m from event_quote_milestones where id = p_milestone for update;
  if not found then raise exception 'This payment date does not exist.'; end if;
  select * into q from event_quotes where id = m.quote_id;
  select * into b from shortlet_bookings where id = q.booking_id;
  if b.guest_id <> auth.uid() then raise exception 'This is not your booking.'; end if;
  if q.status <> 'accepted' then raise exception 'Accept the quotation first, then you can pay it.'; end if;
  if m.paid_at is not null then raise exception 'This instalment is already paid.'; end if;
  if exists (select 1 from event_quote_milestones e where e.quote_id = m.quote_id and e.paid_at is null and (e.sort_order < m.sort_order or (e.sort_order = m.sort_order and e.due_date < m.due_date))) then
    raise exception 'Please pay the earlier instalment first.';
  end if;
  r := public._pay_service(b.id, 'venue', m.label, m.amount, null, m.id, null, null);
  v_ref := r->>'reference';
  update event_quote_milestones set paid_at = now(), paid_method = 'wallet', payment_ref = v_ref, marked_by_name = (select full_name from profiles where id = auth.uid()) where id = m.id;
  return r;
end $$;

-- the guest pays for a single service the venue has agreed (own or CHS-sourced)
create or replace function public.pay_service_line(p_line uuid) returns json
language plpgsql security definer set search_path to 'public' as $$
declare s booking_services; b record; r json;
begin
  select * into s from booking_services where id = p_line for update;
  if not found then raise exception 'This service does not exist.'; end if;
  select * into b from shortlet_bookings where id = s.booking_id;
  if b.guest_id <> auth.uid() then raise exception 'This is not your booking.'; end if;
  if s.status <> 'supplied' or coalesce(s.price, 0) <= 0 then raise exception 'This service has no price to pay yet.'; end if;
  if s.paid_at is not null then raise exception 'This service is already paid.'; end if;
  r := public._pay_service(b.id, case when s.sourced_via = 'chs' then 'sourced' else 'venue' end, public._service_label(s.service), s.price, s.id, null, s.chs_provider, s.chs_provider_contact);
  update booking_services set paid_at = now(), payment_ref = r->>'reference', updated_at = now() where id = s.id;
  return r;
end $$;

-- a paid service cannot be re-priced or withdrawn behind the guest's back
create or replace function public.trg_paid_service_lock() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if old.paid_at is not null and new.paid_at is not null and (new.price is distinct from old.price or new.status is distinct from old.status) then
    raise exception 'This service is already paid. Ask for a refund first if it must change.';
  end if;
  return new;
end $$;
create or replace trigger trg_paid_service_lock before update on public.booking_services for each row execute function public.trg_paid_service_lock();

-- release held service payments together with the booking payout
create or replace function public._service_release(p_booking uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare sp record; v_title text; v_fee numeric; v_credit numeric; v_comm numeric; v_ref numeric; v_name text;
begin
  for sp in select * from service_payments where booking_id = p_booking and status = 'held' for update loop
    select title into v_title from properties where id = sp.property_id;
    if sp.kind = 'venue' then
      v_fee := round(sp.amount * sp.host_pct / 100, 2);
      v_credit := sp.amount - v_fee;
      perform public._svc_credit(sp.host_id, v_credit, 'Event services payout for ' || v_title || ': ' || sp.label || ' (' || fmt_naira(sp.amount) || ' less CHS commission ' || fmt_naira(v_fee) || ')', 'SVO-' || substr(sp.id::text, 1, 8));
      select full_name into v_name from profiles where id = sp.payer_id;
      insert into host_income_entries(property_id, centre, description, amount, received_at, recorded_by, recorded_by_name)
      values (sp.property_id, 'events', 'Event services: ' || sp.label || ' (CHS, ' || sp.reference || ')', v_credit, now(), sp.host_id, 'CHS payout');
      update service_payments set status = 'released', chs_earned = sp.guest_fee + v_fee, settled_at = now() where id = sp.id;
      perform notify_user(sp.host_id, '💰 Services payout released', fmt_naira(v_credit) || ' for ' || sp.label || ' (' || v_title || ') is in your wallet, after CHS commission of ' || fmt_naira(v_fee) || '.', '/host?tab=services');
    else
      v_comm := round(sp.amount * sp.host_pct / 100, 2);
      v_ref := round(v_comm * sp.referral_pct / 100, 2);
      if v_ref > 0 then
        perform public._svc_credit(sp.host_id, v_ref, 'Referral share for ' || sp.label || ' at ' || v_title, 'SVF-' || substr(sp.id::text, 1, 8));
      end if;
      update service_payments set status = 'released', chs_earned = sp.guest_fee + v_comm - v_ref, settled_at = now() where id = sp.id;
      update service_provider_payouts set status = 'owed' where payment_id = sp.id and status = 'pending';
      perform notify_admins_by_domain('owner_buyer_tenant', '💼 Provider payout due', coalesce(sp.provider_name, 'Provider') || ' is now owed for ' || sp.label || ' at ' || v_title || ' (event delivered).', '/admin?tab=servicesourcing');
    end if;
  end loop;
end $$;

-- give back all or part of a held service payment (the rest is kept for the venue / provider)
create or replace function public._service_refund(p_payment uuid, p_pct numeric, p_reason text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare sp record; b record; v_title text; v_ref_amt numeric; v_ref_fee numeric; v_ret numeric; v_fee numeric; v_comm numeric; v_refer numeric := 0; v_earned numeric; v_po record;
begin
  select * into sp from service_payments where id = p_payment for update;
  if not found or sp.status <> 'held' then return; end if;
  select * into b from shortlet_bookings where id = sp.booking_id;
  select title into v_title from properties where id = sp.property_id;
  v_ref_amt := round(sp.amount * p_pct / 100, 2);
  v_ref_fee := round(sp.guest_fee * p_pct / 100, 2);
  v_ret := sp.amount - v_ref_amt;
  v_earned := sp.guest_fee - v_ref_fee;
  perform public._svc_credit(sp.payer_id, v_ref_amt + v_ref_fee, 'Refund of services payment at ' || v_title || ' (' || sp.label || '): ' || p_reason, 'SVR-' || substr(sp.id::text, 1, 8));
  if v_ret > 0 then
    if sp.kind = 'venue' then
      v_fee := round(v_ret * sp.host_pct / 100, 2);
      perform public._svc_credit(sp.host_id, v_ret - v_fee, 'Services kept after cancellation for ' || v_title || ': ' || sp.label || ' (less CHS commission ' || fmt_naira(v_fee) || ')', 'SVK-' || substr(sp.id::text, 1, 8));
      v_earned := v_earned + v_fee;
    else
      v_comm := round(v_ret * sp.host_pct / 100, 2);
      v_refer := round(v_comm * sp.referral_pct / 100, 2);
      if v_refer > 0 then perform public._svc_credit(sp.host_id, v_refer, 'Referral share for ' || sp.label || ' at ' || v_title, 'SVF-' || substr(sp.id::text, 1, 8)); end if;
      v_earned := v_earned + v_comm - v_refer;
      update service_provider_payouts set amount_due = v_ret - v_comm, status = 'owed', note = 'Part kept after cancellation' where payment_id = sp.id and status = 'pending';
    end if;
  elsif sp.kind = 'sourced' then
    update service_provider_payouts set status = 'cancelled', note = 'Fully refunded to the guest' where payment_id = sp.id and status = 'pending';
  end if;
  if sp.kind = 'sourced' then
    select * into v_po from service_provider_payouts where payment_id = sp.id;
    if v_po.status = 'paid' then
      update service_provider_payouts set note = coalesce(note || ' | ', '') || 'Provider was already paid; booking cancelled with ' || p_pct || '% refund. CHS to recover or absorb.' where payment_id = sp.id;
      perform notify_admins_by_domain('owner_buyer_tenant', '⚠️ Refund after provider was paid', sp.label || ' at ' || v_title || ' was refunded (' || p_pct || '%) but ' || coalesce(sp.provider_name, 'the provider') || ' had already been paid ' || fmt_naira(v_po.amount_due) || '. Please recover or absorb.', '/admin?tab=servicesourcing');
    end if;
  end if;
  update service_payments set status = case when p_pct >= 100 then 'refunded' else 'part_refunded' end, refunded_amount = v_ref_amt, refunded_fee = v_ref_fee, chs_earned = v_earned, settled_at = now() where id = sp.id;
  if p_pct >= 100 then
    update event_quote_milestones set paid_at = null, paid_method = null, payment_ref = null, marked_by_name = null where id = sp.milestone_id;
    update booking_services set paid_at = null, payment_ref = null, updated_at = now() where id = sp.line_id;
  end if;
  perform notify_user(sp.payer_id, '↩️ Services payment refunded', fmt_naira(v_ref_amt + v_ref_fee) || ' (' || sp.label || ') went back to your wallet. ' || p_reason, '/my-bookings?b=' || b.id);
  if v_ret > 0 then
    perform notify_user(sp.host_id, 'Services payment partly kept', fmt_naira(v_ret) || ' of ' || sp.label || ' (' || v_title || ') was kept after the cancellation.', '/host?tab=services');
  end if;
end $$;

-- booking paid out -> services paid out
create or replace function public.trg_service_release_on_payout() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.payment_status = 'released' and old.payment_status is distinct from 'released' and new.status <> 'cancelled' then
    perform public._service_release(new.id);
  end if;
  return null;
end $$;
create or replace trigger trg_service_release_on_payout after update of payment_status on public.shortlet_bookings for each row execute function public.trg_service_release_on_payout();

-- booking ends (cancelled, declined, expired) -> held service payments are settled by the policy
create or replace function public.trg_service_refund_on_host_cancel() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_pct numeric; v_hours numeric; sp record; v_why text;
begin
  if new.status in ('cancelled', 'declined', 'expired') and old.status is distinct from new.status then
    if not exists (select 1 from service_payments where booking_id = new.id and status = 'held') then return null; end if;
    if new.status in ('declined', 'expired') or new.cancelled_by is null or new.cancelled_by <> new.guest_id then
      v_pct := 100; v_why := case when new.status = 'cancelled' and new.cancelled_by is not null then 'The venue cancelled the booking.' when new.status = 'cancelled' then 'The booking was cancelled for a reason outside anyone''s control.' else 'The booking did not go ahead.' end;
    else
      v_hours := extract(epoch from (new.check_in::timestamptz - now())) / 3600;
      v_pct := case when v_hours >= 48 then 100 when v_hours > 0 then 50 else 0 end;
      v_why := 'You cancelled the booking (' || v_pct || '% of services refunded under the cancellation policy).';
    end if;
    for sp in select id from service_payments where booking_id = new.id and status = 'held' loop
      perform public._service_refund(sp.id, v_pct, v_why);
    end loop;
  end if;
  return null;
end $$;

-- the venue can hand a service payment back before it is released
create or replace function public.host_refund_service_payment(p_milestone uuid, p_reason text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare sp record;
begin
  select * into sp from service_payments where milestone_id = p_milestone and status in ('held', 'released') order by created_at desc limit 1;
  if not found then raise exception 'This payment does not exist.'; end if;
  if coalesce(public.my_property_role(sp.property_id), 'none') not in ('owner', 'manager') then raise exception 'Only the host or a manager can refund a payment.'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'Please give the guest a short reason.'; end if;
  if sp.status <> 'held' then raise exception 'This payment was already paid out to you. Ask CHS to help with a refund.'; end if;
  perform public._service_refund(sp.id, 100, trim(p_reason));
  perform log_audit_event('service_payment_refunded', 'service_payments', sp.id, trim(p_reason), null);
end $$;

create or replace function public.host_refund_service_line(p_line uuid, p_reason text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare sp record;
begin
  select * into sp from service_payments where line_id = p_line and status in ('held', 'released') order by created_at desc limit 1;
  if not found then raise exception 'This payment does not exist.'; end if;
  if coalesce(public.my_property_role(sp.property_id), 'none') not in ('owner', 'manager') then raise exception 'Only the host or a manager can refund a payment.'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'Please give the guest a short reason.'; end if;
  if sp.status <> 'held' then raise exception 'This payment was already paid out. Ask CHS to help with a refund.'; end if;
  perform public._service_refund(sp.id, 100, trim(p_reason));
  perform log_audit_event('service_payment_refunded', 'service_payments', sp.id, trim(p_reason), null);
end $$;

-- nothing is paid outside CHS any more
create or replace function public.mark_quote_milestone_paid(p_milestone_id uuid, p_method text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  raise exception 'All payments go through CHS. Ask the guest to pay from My Bookings with their CHS wallet.';
end $$;

-- quotation json now shows the guest fee on each instalment
do $do$
declare v_def text; v_new text;
begin
  v_def := pg_get_functiondef('public._event_quote_json(uuid)'::regprocedure);
  v_new := replace(v_def, '''payment_ref'', m.payment_ref)', '''payment_ref'', m.payment_ref, ''fee'', round(m.amount * public._svc_pct(''service_guest_pct'', 6) / 100, 2))');
  if v_new = v_def then raise exception 'quote json patch did not apply'; end if;
  execute v_new;
end $do$;

-- services lists now carry payment info
create or replace function public.get_my_booking_services(p_booking uuid) returns json
language plpgsql security definer set search_path to 'public' as $$
declare v_guest uuid; v_gp numeric := public._svc_pct('service_guest_pct', 6);
begin
  select guest_id into v_guest from shortlet_bookings where id = p_booking;
  if v_guest is null or v_guest <> auth.uid() then raise exception 'This is not your booking.'; end if;
  perform public._sync_booking_services(p_booking);
  return coalesce((select json_agg(json_build_object('id', s.id, 'service', s.service, 'label', public._service_label(s.service), 'quantity', s.quantity,
    'status', case when s.status in ('sourcing', 'quoted') then 'arranging' else s.status end,
    'provider_name', case when s.status in ('sourcing', 'quoted') then null else s.provider_name end,
    'price', case when s.status in ('sourcing', 'quoted') then null else s.price end,
    'note', case when s.status in ('sourcing', 'quoted') then null else s.note end, 'decided_at', s.decided_at,
    'paid_at', s.paid_at, 'payment_ref', s.payment_ref,
    'fee', case when s.status = 'supplied' and s.price is not null then round(s.price * v_gp / 100, 2) else null end) order by s.created_at)
    from booking_services s where s.booking_id = p_booking), '[]'::json);
end $$;

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
    'sourced_via', s.sourced_via, 'provider_confirmed_at', s.provider_confirmed_at, 'paid_at', s.paid_at, 'payment_ref', s.payment_ref,
    'payment_status', (select p.status from service_payments p where p.line_id = s.id order by p.created_at desc limit 1),
    'messages', (select count(*) from service_messages m where m.line_id = s.id)) order by s.created_at)
    from booking_services s where s.booking_id = p_booking), '[]'::json);
end $$;

-- host summary of money for services through CHS
create or replace function public.get_service_payments_summary() returns json
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  return json_build_object(
    'held_total', coalesce((select sum(p.amount) from service_payments p where p.status = 'held' and coalesce(public.my_property_role(p.property_id), 'none') in ('owner', 'manager', 'accountant')), 0),
    'received_total', coalesce((select sum(case when p.kind = 'venue' then p.amount - round(p.amount * p.host_pct / 100, 2) else 0 end) from service_payments p where p.status in ('released', 'part_refunded') and coalesce(public.my_property_role(p.property_id), 'none') in ('owner', 'manager', 'accountant')), 0),
    'recent', coalesce((select json_agg(x) from (
      select p.created_at, p.status, p.amount, p.reference, p.label, pr.title as property_title, public.public_display_name(g.full_name) as guest
      from service_payments p join properties pr on pr.id = p.property_id join profiles g on g.id = p.payer_id
      where coalesce(public.my_property_role(p.property_id), 'none') in ('owner', 'manager', 'accountant')
      order by p.created_at desc limit 20) x), '[]'::json));
end $$;

-- admin: providers CHS has to pay, and what service payments earn
create or replace function public.admin_get_service_payouts() returns json
language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  return json_build_object(
    'payouts', coalesce((select json_agg(x order by q.rank, q.created_at desc) from (
      select case when o.status = 'owed' then 1 when o.status = 'pending' then 2 else 3 end as rank, o.created_at,
        json_build_object('id', o.id, 'status', o.status, 'provider_name', o.provider_name, 'provider_contact', o.provider_contact, 'amount_due', o.amount_due,
          'paid_at', o.paid_at, 'paid_ref', o.paid_ref, 'note', o.note, 'label', sp.label, 'property_title', pr.title, 'check_in', b.check_in, 'reference', sp.reference,
          'payment_status', sp.status) as x
      from service_provider_payouts o join service_payments sp on sp.id = o.payment_id join properties pr on pr.id = o.property_id join shortlet_bookings b on b.id = o.booking_id
      where o.status in ('owed', 'pending') or (o.status = 'paid' and o.paid_at > now() - interval '60 days')) q), '[]'::json),
    'revenue', json_build_object(
      'held', coalesce((select sum(amount + guest_fee) from service_payments where status = 'held'), 0),
      'earned', coalesce((select sum(chs_earned) from service_payments where status in ('released', 'part_refunded', 'refunded')), 0),
      'owed_to_providers', coalesce((select sum(amount_due) from service_provider_payouts where status = 'owed'), 0),
      'pending_to_providers', coalesce((select sum(amount_due) from service_provider_payouts where status = 'pending'), 0)));
end $$;

create or replace function public.admin_mark_provider_paid(p_payout uuid, p_ref text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare o record;
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  if nullif(trim(coalesce(p_ref, '')), '') is null then raise exception 'Enter the transfer reference or a short note.'; end if;
  select * into o from service_provider_payouts where id = p_payout for update;
  if not found or o.status not in ('owed', 'pending') then raise exception 'This payout is not waiting to be paid.'; end if;
  update service_provider_payouts set status = 'paid', paid_at = now(), paid_ref = trim(p_ref), paid_by = auth.uid() where id = o.id;
  perform log_audit_event('provider_paid', 'service_provider_payouts', o.id, trim(p_ref), jsonb_build_object('amount', o.amount_due));
end $$;

revoke execute on function public._svc_pct(text, numeric), public._svc_credit(uuid, numeric, text, text), public._pay_service(uuid, text, text, numeric, uuid, uuid, text, text),
  public._service_release(uuid), public._service_refund(uuid, numeric, text) from public, anon, authenticated;
revoke execute on function public.pay_service_line(uuid), public.host_refund_service_line(uuid, text), public.admin_get_service_payouts(), public.admin_mark_provider_paid(uuid, text) from public, anon;
grant execute on function public.pay_service_line(uuid), public.host_refund_service_line(uuid, text), public.admin_get_service_payouts(), public.admin_mark_provider_paid(uuid, text),
  public.pay_quote_milestone(uuid), public.host_refund_service_payment(uuid, text), public.get_service_payments_summary(), public.mark_quote_milestone_paid(uuid, text) to authenticated;
