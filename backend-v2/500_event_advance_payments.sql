-- 500: Advance (default 60%) to the event centre and to every service provider, balance after the event.
-- The guest still pays everything up front into CHS escrow. CHS then pays out part of what each payee will
-- eventually earn EARLY (the advance); the rest (balance) follows after the event, as before.
-- Settings: event_advance_pct (default 60, 0 = off, max 90), event_advance_release_hours (default 48 = release the
-- advance this many hours before the event; the guest's free-cancel window closes at 48h).

-- ---------- columns ----------
alter table public.shortlet_bookings
  add column if not exists advance_pct numeric,
  add column if not exists advance_paid numeric not null default 0,
  add column if not exists advance_paid_at timestamptz,
  add column if not exists advance_clawed numeric not null default 0,
  add column if not exists advance_recover_due numeric not null default 0;
grant select (advance_pct, advance_paid, advance_paid_at) on public.shortlet_bookings to authenticated;

alter table public.service_payments
  add column if not exists advance_paid numeric not null default 0,
  add column if not exists advance_paid_at timestamptz,
  add column if not exists advance_recover_due numeric not null default 0;

alter table public.service_provider_payouts
  add column if not exists advance_due numeric not null default 0,
  add column if not exists advance_status text not null default 'none',
  add column if not exists advance_paid_at timestamptz,
  add column if not exists advance_paid_ref text,
  add column if not exists advance_paid_by uuid;

do $s$ begin
  insert into public.platform_settings(key, value) values ('event_advance_pct', '60') on conflict (key) do nothing;
  insert into public.platform_settings(key, value) values ('event_advance_release_hours', '48') on conflict (key) do nothing;
exception when others then raise notice 'settings not inserted: %', sqlerrm; end $s$;

-- ---------- helpers ----------
create or replace function public._svc_take(p_user uuid, p_amount numeric, p_desc text, p_ref text)
returns numeric language plpgsql security definer set search_path to 'public' as $f$
declare bal numeric; t numeric;
begin
  if p_amount is null or p_amount <= 0 then return 0; end if;
  select main_balance into bal from wallets where user_id = p_user for update;
  t := least(coalesce(bal, 0), p_amount);
  if t <= 0 then return 0; end if;
  update wallets set main_balance = main_balance - t, updated_at = now() where user_id = p_user;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference) values (p_user, 'main', t, 'debit', p_desc, p_ref);
  return t;
end $f$;

create or replace function public._advance_pct()
returns numeric language sql stable security definer set search_path to 'public' as $f$
  select least(90, greatest(0, booking_setting_int('event_advance_pct', 60)))::numeric $f$;

-- Pay (or schedule) the advance for ONE service payment.
create or replace function public._service_advance(p_payment uuid, p_notify boolean default true)
returns void language plpgsql security definer set search_path to 'public' as $f$
declare sp record; b record; v_title text; v_adv numeric; n int;
begin
  select * into sp from service_payments where id = p_payment for update;
  if not found or sp.status <> 'held' then return; end if;
  select * into b from shortlet_bookings where id = sp.booking_id;
  if b.advance_paid_at is null or coalesce(b.advance_pct, 0) <= 0 then return; end if;
  select title into v_title from properties where id = sp.property_id;
  if sp.kind = 'venue' then
    if sp.advance_paid_at is not null then return; end if;
    v_adv := round((sp.amount - round(sp.amount * sp.host_pct / 100, 2)) * b.advance_pct / 100, 2);
    perform public._svc_credit(sp.host_id, v_adv, 'Advance (' || b.advance_pct || '%) for event service at ' || v_title || ': ' || sp.label, 'SVA-' || substr(sp.id::text, 1, 8));
    update service_payments set advance_paid = v_adv, advance_paid_at = now() where id = sp.id;
    if p_notify and v_adv > 0 then perform notify_user(sp.host_id, '💰 Service advance paid', fmt_naira(v_adv) || ' (' || b.advance_pct || '%) for ' || sp.label || ' (' || v_title || ') is in your wallet. The balance follows after the event.', '/host?tab=services'); end if;
  else
    update service_provider_payouts set advance_due = round(amount_due * b.advance_pct / 100, 2), advance_status = 'owed'
    where payment_id = sp.id and advance_status = 'none' and status = 'pending';
    get diagnostics n = row_count;
    if n > 0 and p_notify then
      perform notify_admins_by_domain('owner_buyer_tenant', '💼 Provider advance due', coalesce(sp.provider_name, 'Provider') || ': ' || b.advance_pct || '% advance for ' || sp.label || ' at ' || v_title || ' is due now. Please transfer it and record the reference.', '/admin?tab=servicesourcing');
    end if;
  end if;
end $f$;

-- Take back an advance already paid out (the booking was cancelled or refunded).
create or replace function public._advance_clawback(p_booking uuid)
returns void language plpgsql security definer set search_path to 'public' as $f$
declare b record; v_host uuid; v_title text; v_taken numeric;
begin
  select * into b from shortlet_bookings where id = p_booking for update;
  if not found or coalesce(b.advance_paid, 0) <= 0 then return; end if;
  select owner_id, title into v_host, v_title from properties where id = b.property_id;
  v_taken := public._svc_take(v_host, b.advance_paid, 'Advance returned: booking cancelled (' || v_title || ')', 'ADC-' || substr(b.id::text, 1, 8));
  update shortlet_bookings set advance_clawed = advance_clawed + v_taken, advance_recover_due = advance_paid - v_taken, advance_paid = 0 where id = b.id;
  perform notify_user(v_host, 'Advance returned', fmt_naira(v_taken) || ' of the advance for ' || v_title || ' was taken back because the booking was cancelled.', '/host');
  if v_taken < b.advance_paid then
    perform notify_admins_by_domain('owner_buyer_tenant', '⚠️ Advance could not be fully recovered', v_title || ': ' || fmt_naira(b.advance_paid - v_taken) || ' of the advance paid to the host is still to be recovered (wallet balance too low).', '/admin?tab=eventcentres');
  end if;
end $f$;

-- Unwind one service payment's advance before a refund is worked out.
create or replace function public._svc_advance_unwind(p_payment uuid)
returns void language plpgsql security definer set search_path to 'public' as $f$
declare sp record; v_taken numeric; v_title text; v_po record;
begin
  select * into sp from service_payments where id = p_payment;
  if not found then return; end if;
  select title into v_title from properties where id = sp.property_id;
  if sp.kind = 'venue' and coalesce(sp.advance_paid, 0) > 0 then
    v_taken := public._svc_take(sp.host_id, sp.advance_paid, 'Service advance returned (' || sp.label || ', ' || v_title || ')', 'SVC-' || substr(sp.id::text, 1, 8));
    update service_payments set advance_recover_due = sp.advance_paid - v_taken, advance_paid = 0 where id = sp.id;
    if v_taken < sp.advance_paid then
      perform notify_admins_by_domain('owner_buyer_tenant', '⚠️ Service advance could not be fully recovered', sp.label || ' at ' || v_title || ': ' || fmt_naira(sp.advance_paid - v_taken) || ' still to be recovered from the host.', '/admin?tab=eventcentres');
    end if;
  elsif sp.kind = 'sourced' then
    select * into v_po from service_provider_payouts where payment_id = sp.id;
    if found and v_po.advance_status = 'owed' then
      update service_provider_payouts set advance_status = 'cancelled', advance_due = 0 where id = v_po.id;
    elsif found and v_po.advance_status = 'paid' then
      update service_provider_payouts set note = coalesce(note || ' | ', '') || 'Advance of ' || v_po.advance_due || ' was already paid; booking refunded. CHS to recover or absorb.' where id = v_po.id;
      perform notify_admins_by_domain('owner_buyer_tenant', '⚠️ Refund after provider advance', coalesce(sp.provider_name, 'Provider') || ' (' || sp.label || ' at ' || v_title || ') had already received an advance of ' || fmt_naira(v_po.advance_due) || '. Please recover or absorb.', '/admin?tab=servicesourcing');
    end if;
  end if;
end $f$;

-- Release the advance for a whole event booking (hall + services).
create or replace function public.release_event_advance(p_booking uuid)
returns numeric language plpgsql security definer set search_path to 'public' as $f$
declare b record; v_host uuid; v_title text; v_pct numeric := public._advance_pct(); v_adv numeric; sp record; v_svc int := 0;
begin
  select * into b from shortlet_bookings where id = p_booking for update;
  if not found or b.status <> 'confirmed' or b.payment_status <> 'held_escrow' or b.advance_paid_at is not null then return 0; end if;
  if public._property_cat(b.property_id) <> 'event' or v_pct <= 0 then return 0; end if;
  select owner_id, title into v_host, v_title from properties where id = b.property_id;
  v_adv := round((b.total_price - coalesce(b.host_commission_amount, 0)) * v_pct / 100, 2);
  perform public._svc_credit(v_host, v_adv, 'Advance (' || v_pct || '%) for the event at ' || v_title || ', net of your CHS commission', 'ADV-' || substr(b.id::text, 1, 8));
  update shortlet_bookings set advance_pct = v_pct, advance_paid = v_adv, advance_paid_at = now() where id = b.id;
  for sp in select id from service_payments where booking_id = b.id and status = 'held' loop
    perform public._service_advance(sp.id, false); v_svc := v_svc + 1;
  end loop;
  perform notify_user(v_host, '💰 Event advance paid', fmt_naira(v_adv) || ' (' || v_pct || '% of your payout) for ' || v_title || ' is in your wallet. The balance is released after the event.', '/host');
  perform notify_admins_by_domain('owner_buyer_tenant', '💼 Event advance released', v_title || ' (event ' || b.check_in || '): ' || fmt_naira(v_adv) || ' paid to the venue; ' || v_svc || ' service payment(s) processed. Check Provider payouts for advances to transfer.', '/admin?tab=servicesourcing');
  perform log_audit_event('event_advance_released', 'shortlet_bookings', b.id, v_pct || '% / ' || v_adv, null);
  return v_adv;
end $f$;

create or replace function public.admin_release_event_advance(p_booking uuid)
returns numeric language plpgsql security definer set search_path to 'public' as $f$
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  return public.release_event_advance(p_booking);
end $f$;

create or replace function public._sweep_event_advances()
returns integer language plpgsql security definer set search_path to 'public' as $f$
declare r record; n int := 0; v_hrs int := greatest(0, booking_setting_int('event_advance_release_hours', 48));
begin
  if public._advance_pct() <= 0 then return 0; end if;
  for r in select id from shortlet_bookings
           where status = 'confirmed' and payment_status = 'held_escrow' and advance_paid_at is null
             and check_in::timestamptz - make_interval(hours => v_hrs) <= now() loop
    begin
      if public.release_event_advance(r.id) > 0 then n := n + 1; end if;
    exception when others then raise warning 'event advance failed for %: %', r.id, sqlerrm; end;
  end loop;
  return n;
end $f$;

-- Services paid after the venue advance was released are advanced straight away.
create or replace function public.trg_service_advance_late()
returns trigger language plpgsql security definer set search_path to 'public' as $f$
begin
  if tg_table_name = 'service_payments' then
    if new.kind = 'venue' then perform public._service_advance(new.id, true); end if;
  else
    perform public._service_advance(new.payment_id, true);
  end if;
  return new;
end $f$;
create or replace trigger trg_svc_adv_late_sp after insert on public.service_payments for each row execute function public.trg_service_advance_late();
create or replace trigger trg_svc_adv_late_po after insert on public.service_provider_payouts for each row execute function public.trg_service_advance_late();

revoke all on function public._svc_take(uuid, numeric, text, text), public._advance_pct(), public._service_advance(uuid, boolean),
  public._advance_clawback(uuid), public._svc_advance_unwind(uuid), public.release_event_advance(uuid), public._sweep_event_advances() from public, anon, authenticated;
grant execute on function public.admin_release_event_advance(uuid) to authenticated;

-- ---------- patch the existing money functions (exact-text replacement, each asserted) ----------
create function pg_temp._p(p_sig text, p_old text, p_new text) returns void language plpgsql as $f$
declare d text; nd text;
begin
  d := pg_get_functiondef(p_sig::regprocedure);
  if position(p_old in d) = 0 then raise exception 'anchor not found in %: %', p_sig, left(p_old, 60); end if;
  nd := replace(d, p_old, p_new);
  execute nd;
end $f$;

select pg_temp._p('public.host_cancel_booking(uuid,text)',
  $a$-- the guest is made whole$a$,
  $a$perform public._advance_clawback(b.id);
  -- the guest is made whole$a$);
select pg_temp._p('public.refund_shortlet_booking(uuid,text)',
  $a$perform notify_user(v_guest_id, '✓ Refund issued',$a$,
  $a$perform public._advance_clawback(p_booking_id);
  perform notify_user(v_guest_id, '✓ Refund issued',$a$);
select pg_temp._p('public.cancel_shortlet_booking(uuid)',
  $a$v_k := (100 - v_pct) / 100;$a$,
  $a$v_k := (100 - v_pct) / 100;
  perform public._advance_clawback(b.id);$a$);
select pg_temp._p('public.release_booking_payout(uuid)',
  $a$v_net := b.total_price - coalesce(b.host_commission_amount, 0);$a$,
  $a$v_net := b.total_price - coalesce(b.host_commission_amount, 0);
  v_net := greatest(v_net - coalesce(b.advance_paid, 0), 0);$a$);
select pg_temp._p('public.release_booking_payout(uuid)',
  $a$'Real shortlet/hire payout, net of your real commission'$a$,
  $a$case when coalesce(b.advance_paid, 0) > 0 then 'Balance of your event payout (advance of ' || fmt_naira(b.advance_paid) || ' already paid), net of your CHS commission' else 'Real shortlet/hire payout, net of your real commission' end$a$);
select pg_temp._p('public.auto_release_arrived_bookings()',
  $a$v_net := r.total_price - coalesce(r.host_commission_amount, 0);$a$,
  $a$v_net := greatest(r.total_price - coalesce(r.host_commission_amount, 0) - coalesce(r.advance_paid, 0), 0);$a$);
select pg_temp._p('public._service_release(uuid)',
  $a$v_credit := sp.amount - v_fee;$a$,
  $a$v_credit := sp.amount - v_fee - coalesce(sp.advance_paid, 0);$a$);
select pg_temp._p('public._service_refund(uuid,numeric,text)',
  $a$v_ret := sp.amount - v_ref_amt;$a$,
  $a$v_ret := sp.amount - v_ref_amt;
  perform public._svc_advance_unwind(sp.id);$a$);
select pg_temp._p('public.sweep_expired_booking_holds()',
  $a$n := n + auto_release_arrived_bookings();$a$,
  $a$n := n + public._sweep_event_advances();
  n := n + auto_release_arrived_bookings();$a$);
select pg_temp._p('public.admin_mark_provider_paid(uuid,text)',
  $a$if not found or o.status not in ('owed', 'pending') then raise exception 'This payout is not waiting to be paid.'; end if;$a$,
  $a$if not found or o.status not in ('owed', 'pending') then raise exception 'This payout is not waiting to be paid.'; end if;
  if o.advance_status = 'owed' then raise exception 'Pay the advance first and record its transfer reference, then pay the balance.'; end if;$a$);

-- ---------- admin: advance + balance per provider ----------
create or replace function public.admin_mark_provider_advance_paid(p_payout uuid, p_ref text)
returns void language plpgsql security definer set search_path to 'public' as $f$
declare o record;
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  if nullif(trim(coalesce(p_ref, '')), '') is null then raise exception 'Enter the transfer reference or a short note.'; end if;
  select * into o from service_provider_payouts where id = p_payout for update;
  if not found or o.advance_status <> 'owed' then raise exception 'There is no advance waiting to be paid on this payout.'; end if;
  update service_provider_payouts set advance_status = 'paid', advance_paid_at = now(), advance_paid_ref = trim(p_ref), advance_paid_by = auth.uid() where id = o.id;
  perform log_audit_event('provider_advance_paid', 'service_provider_payouts', o.id, trim(p_ref), jsonb_build_object('amount', o.advance_due));
end $f$;
grant execute on function public.admin_mark_provider_advance_paid(uuid, text) to authenticated;

create or replace function public.admin_get_service_payouts()
returns json language plpgsql security definer set search_path to 'public' as $f$
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  return json_build_object(
    'payouts', coalesce((select json_agg(x order by q.rank, q.created_at desc) from (
      select case when o.advance_status = 'owed' then 0 when o.status = 'owed' then 1 when o.status = 'pending' then 2 else 3 end as rank, o.created_at,
        json_build_object('id', o.id, 'status', o.status, 'provider_name', o.provider_name, 'provider_contact', o.provider_contact, 'amount_due', o.amount_due,
          'advance_status', o.advance_status, 'advance_due', o.advance_due, 'advance_paid_at', o.advance_paid_at, 'advance_paid_ref', o.advance_paid_ref,
          'balance_due', o.amount_due - case when o.advance_status in ('owed', 'paid') then o.advance_due else 0 end,
          'paid_at', o.paid_at, 'paid_ref', o.paid_ref, 'note', o.note, 'label', sp.label, 'property_title', pr.title, 'check_in', b.check_in, 'reference', sp.reference,
          'payment_status', sp.status) as x
      from service_provider_payouts o join service_payments sp on sp.id = o.payment_id join properties pr on pr.id = o.property_id join shortlet_bookings b on b.id = o.booking_id
      where o.status in ('owed', 'pending') or o.advance_status = 'owed' or (o.status = 'paid' and o.paid_at > now() - interval '60 days')) q), '[]'::json),
    'revenue', json_build_object(
      'held', coalesce((select sum(amount + guest_fee) from service_payments where status = 'held'), 0),
      'earned', coalesce((select sum(chs_earned) from service_payments where status in ('released', 'part_refunded', 'refunded')), 0),
      'owed_to_providers', coalesce((select sum(case when advance_status = 'owed' then advance_due else 0 end) from service_provider_payouts where advance_status = 'owed'), 0)
        + coalesce((select sum(amount_due - case when advance_status in ('owed', 'paid') then advance_due else 0 end) from service_provider_payouts where status = 'owed'), 0),
      'pending_to_providers', coalesce((select sum(amount_due - case when advance_status in ('owed', 'paid') then advance_due else 0 end) from service_provider_payouts where status = 'pending'), 0)));
end $f$;
