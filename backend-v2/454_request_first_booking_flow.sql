-- ============================================================================
-- 454 — STEP 3: request-before-pay booking flow (applied as 454a, 454b, 454c)
-- ============================================================================
-- OLD order: the guest was charged the moment they sent a request; the host then
-- accepted or declined; unanswered requests were refunded after 24h.
-- NEW order: the guest sends a REQUEST and nothing is charged -> CHS relays it to the
-- host -> the host confirms the dates are free -> the guest pays within a short window
-- -> confirmed. Every stage holds the dates on the calendar and has a deadline; an
-- overdue stage settles itself (refunding exactly what was paid, if anything).
--
-- STAGES  awaiting_admin_relay -> pending_host_review -> awaiting_payment -> confirmed
--         (dead ends: declined / cancelled / expired)
-- LANES   by how soon check-in is (Nigerian time); all adjustable in platform_settings
--         standard  > 3 days away  host 24h  guest pays within 6h   (CHS relays by hand,
--                                  or automatically after 4h so a guest is never stuck)
--         soon      1-3 days       host 6h   guest pays within 2h   (relayed instantly)
--         express   today          host 30m  guest pays within 20m  (relayed instantly;
--                                  arrival time required)
--         soon / express: the guest's wallet must ALREADY hold the full amount when the
--         request is sent, so a host is never asked to hold a room for someone who can't pay.
--
-- TWO PAYOUT BUGS FOUND WHILE AUDITING (no real money was affected — no booking had ever
-- been released):
--  1. release_shortlet_funds_to_host never checked money was actually HELD. With unpaid
--     requests now existing, releasing one would have credited a host with money never collected.
--  2. The two payout paths disagreed: when the GUEST confirmed check-in the host was paid the
--     GROSS amount (CHS commission not deducted); the admin path deducted it. Neither marked
--     the host's commission as collected. Both now go through ONE routine,
--     release_booking_payout(): refuses anything not held, pays NET, marks the commission collected.
--
-- OLDER REQUESTS: a request paid at request time (payment_status 'held_escrow') keeps its old
-- behaviour throughout: host confirm -> confirmed; host decline / no reply -> exact refund.
--
-- DEFECT FOUND BY TESTING 454b and fixed in 454c: paying after the window had passed settled
-- the booking and then RAISED an error, which undid the settling. pay_for_booking now RETURNS
-- {"status":"expired"} instead, so the cleanup is kept. (Folded into the function below.)
--
-- TEST NOTE: tests of this migration run inside a DO block that ends in RAISE EXCEPTION so
-- nothing persists. One early test lacked that and left test rows + overwrote two demo wallets;
-- they were removed/restored and a correcting audit entry was written.
-- ============================================================================

-- ---------------------------------------------------------------- 454a: foundation
alter table shortlet_bookings drop constraint if exists shortlet_bookings_status_check;
alter table shortlet_bookings add constraint shortlet_bookings_status_check
  check (status in ('awaiting_admin_relay','pending_host_review','awaiting_payment','confirmed','declined','cancelled','expired'));

alter table shortlet_bookings
  add column if not exists expected_arrival_time text,
  add column if not exists booking_lane text,
  add column if not exists hold_expires_at timestamptz,
  add column if not exists admin_relayed_at timestamptz,
  add column if not exists admin_relay_note text,
  add column if not exists relay_mode text,
  add column if not exists host_confirmed_at timestamptz,
  add column if not exists paid_at timestamptz;

alter table shortlet_bookings drop constraint if exists shortlet_bookings_lane_check;
alter table shortlet_bookings add constraint shortlet_bookings_lane_check check (booking_lane is null or booking_lane in ('standard','soon','express'));
alter table shortlet_bookings drop constraint if exists shortlet_bookings_eta_check;
alter table shortlet_bookings add constraint shortlet_bookings_eta_check check (expected_arrival_time is null or expected_arrival_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table shortlet_bookings drop constraint if exists shortlet_bookings_relay_mode_check;
alter table shortlet_bookings add constraint shortlet_bookings_relay_mode_check check (relay_mode is null or relay_mode in ('manual','auto'));

update shortlet_bookings b set hold_expires_at = c.expires_at
from unit_calendar c where c.booking_id = b.id and c.state = 'held' and b.hold_expires_at is null;

insert into platform_settings (key, value, updated_at) values
  ('booking_soon_days', '3', now()),
  ('booking_host_minutes_standard', '1440', now()), ('booking_pay_minutes_standard', '360', now()),
  ('booking_host_minutes_soon', '360', now()),      ('booking_pay_minutes_soon', '120', now()),
  ('booking_host_minutes_express', '30', now()),    ('booking_pay_minutes_express', '20', now()),
  ('booking_admin_relay_minutes', '240', now()),
  ('booking_manual_relay_standard', 'true', now())
on conflict (key) do nothing;

create or replace function booking_setting_int(p_key text, p_default int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select nullif(value, '')::int from platform_settings where key = p_key), p_default);
$$;
revoke all on function booking_setting_int(text, int) from public, anon;
grant execute on function booking_setting_int(text, int) to authenticated, service_role;

create or replace function booking_lane_info(p_check_in date)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_days int := p_check_in - (now() at time zone 'Africa/Lagos')::date;
  v_lane text; v_manual boolean;
begin
  v_lane := case when v_days <= 0 then 'express'
                 when v_days <= booking_setting_int('booking_soon_days', 3) then 'soon'
                 else 'standard' end;
  v_manual := v_lane = 'standard'
    and coalesce((select value from platform_settings where key = 'booking_manual_relay_standard'), 'true') = 'true';
  return json_build_object(
    'lane', v_lane, 'days_until', v_days, 'manual_relay', v_manual,
    'relay_minutes', booking_setting_int('booking_admin_relay_minutes', 240),
    'host_minutes', booking_setting_int('booking_host_minutes_' || v_lane, case v_lane when 'express' then 30 when 'soon' then 360 else 1440 end),
    'pay_minutes', booking_setting_int('booking_pay_minutes_' || v_lane, case v_lane when 'express' then 20 when 'soon' then 120 else 360 end));
end;
$$;
revoke all on function booking_lane_info(date) from public, anon;
grant execute on function booking_lane_info(date) to authenticated, service_role;

-- The ONE routine that pays a host. Refuses anything not held in escrow.
create or replace function release_booking_payout(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b record; v_host uuid; v_title text; v_host_name text; v_net numeric; v_ref text; n int;
begin
  select * into b from shortlet_bookings where id = p_booking_id for update;
  if not found then raise exception 'This booking does not exist.'; end if;
  if b.payment_status = 'released' then raise exception 'These real funds have already been released.'; end if;
  if b.payment_status <> 'held_escrow' then
    raise exception 'Nothing is held for this booking (payment status: %), so there is nothing to release.', b.payment_status;
  end if;
  if b.status <> 'confirmed' then raise exception 'Only a confirmed booking can be paid out (this one is %).', b.status; end if;

  select owner_id, title into v_host, v_title from properties where id = b.property_id;
  v_net := b.total_price - coalesce(b.host_commission_amount, 0);
  v_ref := 'PAY-' || substr(b.id::text, 1, 8);

  update wallets set main_balance = main_balance + v_net, updated_at = now() where user_id = v_host;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_host, 'main', v_net, 'credit', 'Real shortlet/hire payout, net of your real commission', v_ref);
  update shortlet_bookings set payment_status = 'released' where id = b.id;

  update transaction_commissions set status = 'paid', paid_at = now()
  where shortlet_booking_id = b.id and payer_role = 'host' and status <> 'paid';
  get diagnostics n = row_count;
  if n = 0 and not exists (select 1 from transaction_commissions where shortlet_booking_id = b.id and payer_role = 'host') then
    insert into transaction_commissions (transaction_type, shortlet_booking_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount, status, paid_at)
    values ('shortlet_hire', b.id, b.property_id, v_host, 'host', b.total_price,
            round(coalesce(b.host_commission_amount, 0) / nullif(b.total_price, 0) * 100, 2), coalesce(b.host_commission_amount, 0), 'paid', now());
  end if;

  perform notify_user(v_host, '💰 Real payout released',
    'Reference ' || v_ref || ' — ' || v_net || ' has been credited to your wallet (booking total ' || b.total_price || ', net of your CHS commission ' || coalesce(b.host_commission_amount, 0) || ').',
    '/receipt/' || v_ref);
  select full_name into v_host_name from profiles where id = v_host;
  perform notify_admins_by_domain('owner_buyer_tenant', '💰 Real shortlet/hire funds released',
    'Reference ' || v_ref || ' — ' || v_net || ' released to ' || v_host_name || ' for ' || v_title || ' (booking total ' || b.total_price || ', CHS commission ' || coalesce(b.host_commission_amount, 0) || ' collected at payout).',
    '/admin?tab=escrowoversight');
end;
$$;
revoke all on function release_booking_payout(uuid) from public, anon, authenticated;

create or replace function release_shortlet_funds_to_host(p_booking_id uuid)
returns void language plpgsql security definer as $$
begin
  if not is_admin() then raise exception 'Only CHS staff can release real shortlet/hire funds.'; end if;
  perform release_booking_payout(p_booking_id);
end;
$$;

create or replace function confirm_shortlet_condition_report(p_report_id uuid)
returns void language plpgsql security definer as $$
declare v_guest_id uuid; v_report_type text; v_booking_id uuid; v_payment_status text; v_status text;
begin
  select sb.guest_id, cr.report_type, cr.shortlet_booking_id into v_guest_id, v_report_type, v_booking_id
    from condition_reports cr join shortlet_bookings sb on sb.id = cr.shortlet_booking_id where cr.id = p_report_id;
  if v_guest_id != auth.uid() then raise exception 'Only the real guest on this booking can confirm this report.'; end if;
  update condition_reports set tenant_confirmed = true, status = 'approved', approved_at = now() where id = p_report_id;
  if v_report_type = 'check_in' then
    select payment_status, status into v_payment_status, v_status from shortlet_bookings where id = v_booking_id;
    if v_payment_status = 'held_escrow' and v_status = 'confirmed' then perform release_booking_payout(v_booking_id); end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------- 454b: the flow
-- (Full function bodies are the live definitions; see them with
--  select pg_get_functiondef('<name>'::regproc). Summarised here by purpose.)
--   fmt_naira(numeric), booking_duration_text(int)         helpers for notification text
--   trg_booking_after_insert / trg_booking_after_update    take / move / free the calendar hold
--                                                          for each stage; hold follows hold_expires_at
--   system_close_unpaid_booking(id, 'expired'|'declined', reason, by_system)
--                                                          closes an UNPAID request; tells guest,
--                                                          host (if it reached them) and admin
--   relay_booking_to_host(id, 'manual'|'auto', note)       awaiting_admin_relay -> pending_host_review,
--                                                          starts the host clock, notifies host + guest
--   admin_relay_booking(id, note) / admin_reject_booking(id, reason)   admin-only
--   settle_expired_booking(id)                             overdue stage: auto-relay / expire (no
--                                                          money) / refund (older paid request)
--   purge_expired_holds(property) / sweep_expired_booking_holds()      call settle_expired_booking;
--                                                          sweep also closes requests whose dates passed
--   request_shortlet_booking(..., p_room_type_id, p_expected_arrival_time) returns json
--                                                          no charge; lane, ETA rules, wallet guard
--                                                          for soon/express, calendar hold, notices
--   request_event_booking(...) returns json                same flow for event venues
--   host_decide_shortlet_booking(id, 'confirmed'|'declined', note)
--                                                          unpaid: confirm -> awaiting_payment with the
--                                                          pay window; decline -> declined. Older paid
--                                                          request: exactly as before.
--   pay_for_booking(id) returns json                       guest pays within the window; charges
--                                                          price + guest commission + deposit; records
--                                                          the guest commission as paid and the host's as
--                                                          pending; confirms the dates. Past the window
--                                                          it returns {"status":"expired"} (454c).
--   cancel_shortlet_booking(id)                            withdraw an unpaid request (no refund
--                                                          needed) or cancel a paid booking under the
--                                                          48h / 50% / none policy; a 100% refund also
--                                                          removes the booking's commission records
--   get_my_booking_requests()                              host/owner feed (adds is_paid, lane, ETA, pay window)
--   get_admin_booking_queue()                              admin feed of every in-flight request, urgent first
-- The complete source of every function above was applied through the migration tool as
-- 454b and 454c and is held in the database; the earlier migrations 450-453 contain the
-- functions this one replaces.
