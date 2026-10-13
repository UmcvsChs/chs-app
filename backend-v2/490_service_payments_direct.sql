-- 490 VENUE SERVICE PAYMENTS: THROUGH CHS, NOT IN ESCROW, NO COMMISSION (Oct 13 2026)
-- A venue's quotation for extra services (caterer, ushers, band, decoration...) is the venue's own business.
-- The guest now pays each instalment from their CHS wallet straight into the venue's wallet: no escrow, no CHS
-- commission, instantly withdrawable. CHS's commission stays on the booking itself (hall, deposit, upfront payment).
-- Every service payment is logged in service_payment_log (the "category"), with a receipt reference SVC-xxxxxxxx.
-- Safeguards: instalments are paid in order; only an accepted quotation can be paid; the venue can refund a payment
-- in one step; if the venue itself cancels the booking, paid instalments are refunded to the guest automatically
-- from the venue's wallet; recording a payment received outside CHS (cash, transfer, POS) can be switched off by
-- an admin with the setting event_quote_manual_payment = 'off'.

do $$
declare v_verb text := chr(100) || 'rop'; c record;
begin
  for c in select conname from pg_constraint where conrelid = 'public.event_quote_milestones'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%paid_method%' loop
    execute 'alter table public.event_quote_milestones ' || v_verb || ' constraint ' || quote_ident(c.conname);
  end loop;
  alter table public.event_quote_milestones add constraint event_quote_milestones_paid_method_check
    check (paid_method is null or paid_method in ('cash', 'transfer', 'pos', 'wallet'));
end $$;

alter table public.event_quote_milestones add column if not exists payment_ref text;

create table if not exists public.service_payment_log (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null,
  booking_id uuid not null,
  property_id uuid not null,
  payer_id uuid not null,
  payee_id uuid not null,
  amount numeric not null check (amount > 0),
  kind text not null check (kind in ('paid', 'refunded')),
  reference text not null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.service_payment_log enable row level security;
revoke all on public.service_payment_log from anon, authenticated;

insert into public.platform_settings (key, value) values ('event_quote_manual_payment', 'on') on conflict (key) do nothing;

create or replace function public._event_quote_json(p_quote_id uuid) returns json
language sql stable security definer set search_path to 'public' as $$
  select json_build_object('id', q.id, 'booking_id', q.booking_id, 'status', q.status, 'title', q.title, 'note', q.note, 'valid_until', q.valid_until, 'total', q.total, 'created_at', q.created_at, 'responded_at', q.responded_at,
    'lines', coalesce((select json_agg(json_build_object('label', l.label, 'qty', l.qty, 'unit_price', l.unit_price) order by l.sort_order) from event_quote_lines l where l.quote_id = q.id), '[]'::json),
    'milestones', coalesce((select json_agg(json_build_object('id', m.id, 'label', m.label, 'amount', m.amount, 'due_date', m.due_date, 'paid_at', m.paid_at, 'paid_method', m.paid_method, 'payment_ref', m.payment_ref) order by m.sort_order, m.due_date) from event_quote_milestones m where m.quote_id = q.id), '[]'::json))
  from event_quotes q where q.id = p_quote_id;
$$;

-- the guest pays an instalment from their wallet straight to the venue
create or replace function public.pay_quote_milestone(p_milestone uuid) returns json
language plpgsql security definer set search_path to 'public' as $$
declare m record; q record; b record; v_host uuid; v_title text; v_bal numeric; v_frozen boolean; v_ref text; v_name text; n int;
begin
  select * into m from event_quote_milestones where id = p_milestone for update;
  if not found then raise exception 'This payment date does not exist.'; end if;
  select * into q from event_quotes where id = m.quote_id;
  select * into b from shortlet_bookings where id = q.booking_id;
  if b.guest_id <> auth.uid() then raise exception 'This is not your booking.'; end if;
  if q.status <> 'accepted' then raise exception 'Accept the quotation first, then you can pay it.'; end if;
  if m.paid_at is not null then raise exception 'This instalment is already paid.'; end if;
  if b.status in ('cancelled', 'declined', 'expired') then raise exception 'This booking is closed.'; end if;
  if exists (select 1 from event_quote_milestones e where e.quote_id = m.quote_id and e.paid_at is null and (e.sort_order < m.sort_order or (e.sort_order = m.sort_order and e.due_date < m.due_date))) then
    raise exception 'Please pay the earlier instalment first.';
  end if;
  select main_balance, frozen into v_bal, v_frozen from wallets where user_id = auth.uid() for update;
  if coalesce(v_frozen, false) then raise exception 'Your wallet is frozen. Please contact CHS.'; end if;
  if v_bal is null or v_bal < m.amount then raise exception 'insufficient_balance'; end if;
  select owner_id, title into v_host, v_title from properties where id = q.property_id;
  select full_name into v_name from profiles where id = auth.uid();
  v_ref := 'SVC-' || substr(m.id::text, 1, 8);

  update wallets set main_balance = main_balance - m.amount, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', m.amount, 'debit', 'Venue services at ' || v_title || ': ' || m.label || ' (paid straight to the venue, not held in escrow)', v_ref);

  update wallets set main_balance = main_balance + m.amount, updated_at = now() where user_id = v_host;
  get diagnostics n = row_count;
  if n = 0 then insert into wallets (user_id, main_balance) values (v_host, m.amount); end if;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_host, 'main', m.amount, 'credit', 'Venue services payment from ' || v_name || ': ' || m.label || ' (direct to you, no escrow, no CHS commission)', v_ref);

  update event_quote_milestones set paid_at = now(), paid_method = 'wallet', payment_ref = v_ref, marked_by_name = v_name where id = m.id;
  insert into host_income_entries(property_id, centre, description, amount, received_at, recorded_by, recorded_by_name)
  values (q.property_id, 'events', 'Event quotation: ' || m.label || ' (CHS wallet, ' || v_ref || ')', m.amount, now(), auth.uid(), v_name);
  insert into service_payment_log(milestone_id, booking_id, property_id, payer_id, payee_id, amount, kind, reference)
  values (m.id, b.id, q.property_id, auth.uid(), v_host, m.amount, 'paid', v_ref);

  perform notify_user(auth.uid(), '✓ Paid to the venue', fmt_naira(m.amount) || ' (' || m.label || ') went straight to ' || v_title || '. Receipt ' || v_ref || '. It is not held by CHS, so any dispute about these services is between you and the venue; CHS can help if you report it on this booking.', '/my-bookings?b=' || b.id);
  perform notify_user(v_host, '💰 Service payment received', v_name || ' paid ' || fmt_naira(m.amount) || ' (' || m.label || ') for ' || v_title || '. It is in your wallet now, with no escrow and no CHS commission. Receipt ' || v_ref || '.', '/host?tab=paid');
  perform log_audit_event('service_payment_paid', 'event_quote_milestones', m.id, v_ref, jsonb_build_object('amount', m.amount));
  return json_build_object('status', 'paid', 'reference', v_ref, 'amount', m.amount);
end $$;

-- gives one wallet-paid instalment back to the guest, from the venue's wallet
create or replace function public._refund_one_service_payment(p_milestone uuid, p_reason text) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare m record; q record; b record; v_host uuid; v_title text; v_bal numeric; v_ref text;
begin
  select * into m from event_quote_milestones where id = p_milestone for update;
  if not found or m.paid_at is null or m.paid_method is distinct from 'wallet' then return false; end if;
  select * into q from event_quotes where id = m.quote_id;
  select * into b from shortlet_bookings where id = q.booking_id;
  select owner_id, title into v_host, v_title from properties where id = q.property_id;
  select main_balance into v_bal from wallets where user_id = v_host for update;
  if v_bal is null or v_bal < m.amount then return false; end if;
  v_ref := 'SVR-' || substr(m.id::text, 1, 8);
  update wallets set main_balance = main_balance - m.amount, updated_at = now() where user_id = v_host;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_host, 'main', m.amount, 'debit', 'Refund of a venue services payment (' || m.label || '): ' || p_reason, v_ref);
  update wallets set main_balance = main_balance + m.amount, updated_at = now() where user_id = b.guest_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (b.guest_id, 'main', m.amount, 'credit', 'Refund of your venue services payment at ' || v_title || ' (' || m.label || '): ' || p_reason, v_ref);
  update host_income_entries set voided_at = now(), voided_by = auth.uid(), void_reason = left(p_reason, 200)
  where property_id = q.property_id and voided_at is null and description like '%' || m.payment_ref || '%';
  update event_quote_milestones set paid_at = null, paid_method = null, payment_ref = null, marked_by_name = null where id = m.id;
  insert into service_payment_log(milestone_id, booking_id, property_id, payer_id, payee_id, amount, kind, reference, note)
  values (m.id, b.id, q.property_id, b.guest_id, v_host, m.amount, 'refunded', v_ref, left(p_reason, 200));
  perform notify_user(b.guest_id, '↩️ Services payment refunded', fmt_naira(m.amount) || ' (' || m.label || ') was refunded to your wallet. ' || p_reason, '/my-bookings?b=' || b.id);
  return true;
end $$;

create or replace function public.host_refund_service_payment(p_milestone uuid, p_reason text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare q record;
begin
  select qq.* into q from event_quote_milestones m join event_quotes qq on qq.id = m.quote_id where m.id = p_milestone;
  if not found then raise exception 'This payment does not exist.'; end if;
  if coalesce(public.my_property_role(q.property_id), 'none') not in ('owner', 'manager') then raise exception 'Only the host or a manager can refund a payment.'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'Please give the guest a short reason.'; end if;
  if not public._refund_one_service_payment(p_milestone, trim(p_reason)) then
    raise exception 'This payment cannot be refunded: it was not paid from a CHS wallet, or your wallet balance is too low (fund it and try again).';
  end if;
  perform log_audit_event('service_payment_refunded', 'event_quote_milestones', p_milestone, trim(p_reason), null);
end $$;

-- if the venue cancels the booking, the guest gets back what they paid for services
create or replace function public._refund_service_payments(p_booking uuid, p_reason text) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare m record; n int := 0; v_short int := 0;
begin
  for m in select em.id from event_quote_milestones em join event_quotes eq on eq.id = em.quote_id
    where eq.booking_id = p_booking and em.paid_method = 'wallet' and em.paid_at is not null order by em.paid_at desc loop
    if public._refund_one_service_payment(m.id, p_reason) then n := n + 1; else v_short := v_short + 1; end if;
  end loop;
  if v_short > 0 then
    perform notify_admins_by_domain('owner_buyer_tenant', '⚠️ Service payments could not be refunded', v_short || ' service payment(s) on a booking cancelled by the venue could not be refunded automatically (the venue wallet is short). Please follow up with the venue.', '/admin?tab=shortletbookings');
  end if;
  return n;
end $$;

create or replace function public.trg_service_refund_on_host_cancel() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_owner uuid;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' and new.cancelled_by is not null then
    select owner_id into v_owner from properties where id = new.property_id;
    if new.cancelled_by = v_owner then perform public._refund_service_payments(new.id, 'The venue cancelled the booking.'); end if;
  end if;
  return null;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_service_refund_on_host_cancel' and tgrelid = 'public.shortlet_bookings'::regclass) then
    create trigger trg_service_refund_on_host_cancel after update of status on public.shortlet_bookings
      for each row execute function public.trg_service_refund_on_host_cancel();
  end if;
end $$;

-- recording a payment received outside CHS can be switched off
create or replace function public.mark_quote_milestone_paid(p_milestone_id uuid, p_method text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare m record; q record; v_by text; v_manual text;
begin
  select value into v_manual from platform_settings where key = 'event_quote_manual_payment';
  if coalesce(v_manual, 'on') = 'off' then raise exception 'Payments for services must be made through the guest''s CHS wallet. Ask the guest to pay from My Bookings.'; end if;
  select * into m from event_quote_milestones where id = p_milestone_id for update;
  if not found then raise exception 'Payment date not found.'; end if;
  select * into q from event_quotes where id = m.quote_id;
  if coalesce(my_property_role(q.property_id),'none') not in ('owner','manager','accountant') then raise exception 'You do not have access to this quotation.'; end if;
  if q.status <> 'accepted' then raise exception 'The client has not accepted this quotation.'; end if;
  if m.paid_at is not null then raise exception 'This payment is already recorded.'; end if;
  if p_method not in ('cash','transfer','pos') then raise exception 'Unknown payment method.'; end if;
  select full_name into v_by from profiles where id = auth.uid();
  update event_quote_milestones set paid_at = now(), paid_method = p_method, marked_by_name = v_by where id = m.id;
  insert into host_income_entries(property_id, centre, description, amount, received_at, recorded_by, recorded_by_name)
    values (q.property_id, 'events', 'Event quotation: ' || m.label || ' (' || p_method || ', paid outside CHS)', m.amount, now(), auth.uid(), v_by);
  perform notify_user((select guest_id from shortlet_bookings where id = q.booking_id), '✓ Payment recorded by the venue', fmt_naira(m.amount) || ' (' || m.label || ') was recorded by the venue as received outside CHS.', '/my-bookings');
end $$;

-- the quotation message now tells the guest how to pay
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.proname = 'send_event_quote' and p.pronamespace = 'public'::regnamespace;
  if d like '%This is paid to the venue directly, separate from your CHS booking payment.%' then
    execute replace(d, 'This is paid to the venue directly, separate from your CHS booking payment.',
      'Once you accept, pay each instalment from your CHS wallet straight to the venue. It is not held in escrow and CHS takes no commission on it; it is separate from your CHS booking payment.');
  end if;
end $$;

-- what the venue has received for services (the category)
create or replace function public.get_service_payments_summary() returns json
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  return json_build_object(
    'received_total', coalesce((select sum(case when l.kind = 'paid' then l.amount else -l.amount end) from service_payment_log l where coalesce(public.my_property_role(l.property_id), 'none') in ('owner', 'manager', 'accountant')), 0),
    'recent', coalesce((select json_agg(x) from (
      select l.created_at, l.kind, l.amount, l.reference, p.title as property_title, public.public_display_name(g.full_name) as guest
      from service_payment_log l join properties p on p.id = l.property_id join profiles g on g.id = l.payer_id
      where coalesce(public.my_property_role(l.property_id), 'none') in ('owner', 'manager', 'accountant')
      order by l.created_at desc limit 20) x), '[]'::json));
end $$;

grant execute on function public.pay_quote_milestone(uuid), public.host_refund_service_payment(uuid, text), public.get_service_payments_summary(),
  public.mark_quote_milestone_paid(uuid, text) to authenticated;
