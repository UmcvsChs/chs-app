-- 493 SPLIT PAYMENTS: friends and family chip in for a booking (Oct 13 2026)
-- The booking owner (organiser) opens a split on a booking that is waiting for payment and shares a code. Anyone with a CHS
-- wallet can put in an amount; it is held (debited from them, not yet spent) until the pool plus the organiser's own part
-- covers the whole price before the payment window closes. Then the pool is moved to the organiser's wallet and the booking
-- is paid exactly as normal, so every cancellation, refund and no-fault path keeps working untouched. When money later comes
-- back to the organiser from that booking, each contributor automatically receives their proportional share. If the window
-- closes, the organiser withdraws the split, or the booking is declined, every held contribution goes straight back.

create table if not exists public.booking_splits (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique,
  organiser_id uuid not null,
  code text not null unique,
  status text not null default 'open' check (status in ('open', 'paid', 'lapsed', 'cancelled')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
alter table public.booking_splits enable row level security;
revoke all on public.booking_splits from anon, authenticated;

create table if not exists public.booking_split_contributions (
  id uuid primary key default gen_random_uuid(),
  split_id uuid not null,
  booking_id uuid not null,
  contributor_id uuid not null,
  amount numeric not null check (amount > 0),
  status text not null default 'held' check (status in ('held', 'applied', 'returned')),
  refunded_back numeric not null default 0,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
alter table public.booking_split_contributions enable row level security;
revoke all on public.booking_split_contributions from anon, authenticated;
create index if not exists booking_split_contributions_split on public.booking_split_contributions (split_id);

insert into public.platform_settings (key, value) values ('split_min_contribution', '1000'), ('split_max_contributors', '20') on conflict (key) do nothing;

-- the normal payment, for a named payer (the same steps as pay_for_booking)
create or replace function public._pay_booking_core(p_booking_id uuid, p_payer uuid) returns json
language plpgsql security definer set search_path to 'public' as $$
declare b record; v_total numeric; v_balance numeric; v_title text; v_host uuid; v_guest_name text;
begin
  select * into b from shortlet_bookings where id = p_booking_id for update;
  if not found then raise exception 'This booking does not exist.'; end if;
  if b.guest_id <> p_payer then raise exception 'Only the guest on this booking can pay for it.'; end if;
  if b.status <> 'awaiting_payment' then raise exception 'This booking is not waiting for payment (it is now: %).', b.status; end if;
  if b.hold_expires_at is not null and b.hold_expires_at < now() then
    raise exception 'The payment window has passed, so the dates were released. Please send a new request.';
  end if;
  v_total := b.total_price + coalesce(b.guest_commission_amount, 0) + coalesce(b.security_deposit_amount, 0);
  select main_balance into v_balance from wallets where user_id = p_payer for update;
  if v_balance is null or v_balance < v_total then raise exception 'insufficient_balance'; end if;
  select title, owner_id into v_title, v_host from properties where id = b.property_id;
  select full_name into v_guest_name from profiles where id = b.guest_id;

  update wallets set main_balance = main_balance - v_total, updated_at = now() where user_id = p_payer;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (p_payer, 'main', v_total, 'debit',
    'Booking payment for ' || v_title || ' (held in escrow)' || case when coalesce(b.security_deposit_amount, 0) > 0 then ', includes a refundable security deposit of ' || b.security_deposit_amount else '' end,
    'REQ-' || substr(b.id::text, 1, 8));
  update shortlet_bookings set status = 'confirmed', payment_status = 'held_escrow', paid_at = now(), hold_expires_at = null,
    security_deposit_status = case when coalesce(security_deposit_amount, 0) > 0 then 'held' else 'not_applicable' end
  where id = b.id;
  if coalesce(b.guest_commission_amount, 0) > 0 then
    insert into transaction_commissions (transaction_type, shortlet_booking_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount, status, paid_at)
    values ('shortlet_hire', b.id, b.property_id, p_payer, 'guest', b.total_price, round(b.guest_commission_amount / nullif(b.total_price, 0) * 100, 2), b.guest_commission_amount, 'paid', now());
  end if;
  perform generate_shortlet_commission(b.id);
  perform notify_user(p_payer, '✓ Booking confirmed and paid', 'Your booking for ' || v_title || ' (' || b.check_in || ' to ' || b.check_out || ') is confirmed. ' || fmt_naira(v_total) || ' is held safely by CHS and is released to the host as soon as you arrive and confirm everything is as described.', '/guest?tab=bookings');
  perform notify_user(v_host, '💰 Booking paid — dates confirmed', v_guest_name || ' has paid for ' || v_title || ' (' || b.check_in || ' to ' || b.check_out || '). The money is held by CHS and is released to you as soon as the guest arrives and confirms everything is as described (or 24 hours after check-in if they do not respond), net of your CHS commission.', booking_request_link(v_host));
  perform notify_admins_by_domain('owner_buyer_tenant', '🎉 Real shortlet/hire booking confirmed', v_guest_name || '''s booking for ' || v_title || ' is paid and confirmed (' || fmt_naira(v_total) || ' held in escrow).', '/admin?tab=escrowoversight');
  return json_build_object('status', 'confirmed', 'paid', v_total);
end $$;

create or replace function public._split_needed(p_booking uuid) returns numeric
language sql stable security definer set search_path to 'public' as $$
  select total_price + coalesce(guest_commission_amount, 0) + coalesce(security_deposit_amount, 0) from shortlet_bookings where id = p_booking;
$$;
create or replace function public._split_pool(p_split uuid) returns numeric
language sql stable security definer set search_path to 'public' as $$
  select coalesce(sum(amount), 0) from booking_split_contributions where split_id = p_split and status = 'held';
$$;

create or replace function public._split_return_all(p_split uuid, p_status text, p_why text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare c record; s record; v_title text;
begin
  select * into s from booking_splits where id = p_split for update;
  select p.title into v_title from shortlet_bookings b join properties p on p.id = b.property_id where b.id = s.booking_id;
  for c in select * from booking_split_contributions where split_id = p_split and status = 'held' loop
    update wallets set main_balance = main_balance + c.amount, updated_at = now() where user_id = c.contributor_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (c.contributor_id, 'main', c.amount, 'credit', 'Your contribution for ' || coalesce(v_title, 'a booking') || ' was returned: ' || p_why, 'SPX-' || substr(c.id::text, 1, 8));
    update booking_split_contributions set status = 'returned', settled_at = now() where id = c.id;
    perform notify_user(c.contributor_id, '↩️ Your contribution is back in your wallet', fmt_naira(c.amount) || ' for ' || coalesce(v_title, 'a booking') || ' was returned: ' || p_why, '/guest?tab=wallet');
  end loop;
  update booking_splits set status = p_status, closed_at = now() where id = p_split;
end $$;

create or replace function public._lapse_splits() returns void
language plpgsql security definer set search_path to 'public' as $$
declare s record;
begin
  for s in select sp.id, b.status as bstatus, b.hold_expires_at from booking_splits sp join shortlet_bookings b on b.id = sp.booking_id where sp.status = 'open' loop
    if s.bstatus <> 'awaiting_payment' then perform _split_return_all(s.id, 'lapsed', 'the booking is no longer waiting for payment');
    elsif s.hold_expires_at is not null and s.hold_expires_at < now() then perform _split_return_all(s.id, 'lapsed', 'the payment window closed before the full amount was raised');
    end if;
  end loop;
end $$;

create or replace function public._split_finalize(p_booking uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare s record; v_pool numeric; v_title text; c record;
begin
  select * into s from booking_splits where booking_id = p_booking for update;
  select p.title into v_title from shortlet_bookings b join properties p on p.id = b.property_id where b.id = p_booking;
  v_pool := _split_pool(s.id);
  if v_pool > 0 then
    update wallets set main_balance = main_balance + v_pool, updated_at = now() where user_id = s.organiser_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (s.organiser_id, 'main', v_pool, 'credit', 'Contributions from friends and family for ' || v_title, 'SPC-' || substr(p_booking::text, 1, 8));
  end if;
  perform _pay_booking_core(p_booking, s.organiser_id);
  update booking_split_contributions set status = 'applied', settled_at = now() where split_id = s.id and status = 'held';
  update booking_splits set status = 'paid', closed_at = now() where id = s.id;
  for c in select distinct contributor_id from booking_split_contributions where split_id = s.id and status = 'applied' loop
    perform notify_user(c.contributor_id, '🎉 The booking is paid', 'Thanks to your contribution, the booking for ' || v_title || ' is paid and confirmed. If it is ever cancelled, your share of any refund comes back to your wallet automatically.', '/guest?tab=wallet');
  end loop;
end $$;

create or replace function public.open_booking_split(p_booking uuid) returns json
language plpgsql security definer set search_path to 'public' as $$
declare b record; s record; v_code text;
begin
  select * into b from shortlet_bookings where id = p_booking for update;
  if not found or b.guest_id <> auth.uid() then raise exception 'This is not your booking.'; end if;
  perform _lapse_splits();
  if b.status <> 'awaiting_payment' then raise exception 'You can split the payment once the host has accepted and while the booking waits for payment.'; end if;
  if b.hold_expires_at is not null and b.hold_expires_at < now() then raise exception 'The payment window has passed.'; end if;
  select * into s from booking_splits where booking_id = b.id;
  if found and s.status = 'open' then return json_build_object('code', s.code); end if;
  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from booking_splits where code = v_code);
  end loop;
  if found then update booking_splits set status = 'open', code = v_code, closed_at = null where id = s.id;
  else insert into booking_splits(booking_id, organiser_id, code) values (b.id, b.guest_id, v_code); end if;
  return json_build_object('code', v_code);
end $$;

create or replace function public._split_json(p_split uuid) returns json
language sql stable security definer set search_path to 'public' as $$
  select json_build_object('id', s.id, 'code', s.code, 'status', s.status, 'booking_id', s.booking_id, 'title', p.title, 'check_in', b.check_in, 'check_out', b.check_out,
    'needed', _split_needed(b.id), 'pooled', case when s.status = 'paid' then (select coalesce(sum(amount), 0) from booking_split_contributions where split_id = s.id and status = 'applied') else _split_pool(s.id) end,
    'hold_expires_at', b.hold_expires_at, 'organiser', public_display_name(o.full_name),
    'contributions', coalesce((select json_agg(json_build_object('who', public_display_name(cp.full_name), 'amount', c.amount, 'status', c.status, 'returned_back', c.refunded_back) order by c.created_at)
      from booking_split_contributions c join profiles cp on cp.id = c.contributor_id where c.split_id = s.id and c.status <> 'returned'), '[]'::json))
  from booking_splits s join shortlet_bookings b on b.id = s.booking_id join properties p on p.id = b.property_id join profiles o on o.id = s.organiser_id where s.id = p_split;
$$;

create or replace function public.get_booking_split(p_booking uuid) returns json
language plpgsql security definer set search_path to 'public' as $$
declare s record;
begin
  perform _lapse_splits();
  select * into s from booking_splits where booking_id = p_booking and organiser_id = auth.uid();
  if not found then return null; end if;
  return _split_json(s.id);
end $$;

create or replace function public.get_split_by_code(p_code text) returns json
language plpgsql security definer set search_path to 'public' as $$
declare s record; j json;
begin
  if auth.uid() is null then raise exception 'Please sign in to chip in.'; end if;
  perform _lapse_splits();
  select * into s from booking_splits where code = upper(trim(p_code));
  if not found then raise exception 'That code does not match any payment. Check it with the person who sent it.'; end if;
  j := _split_json(s.id);
  return json_build_object('split', j, 'i_am_organiser', s.organiser_id = auth.uid(),
    'my_total', coalesce((select sum(amount) from booking_split_contributions where split_id = s.id and contributor_id = auth.uid() and status <> 'returned'), 0));
end $$;

create or replace function public.contribute_to_split(p_code text, p_amount numeric) returns json
language plpgsql security definer set search_path to 'public' as $$
declare s record; b record; v_pool numeric; v_need numeric; v_bal numeric; v_frozen boolean; v_id uuid := gen_random_uuid(); v_title text; v_name text; v_min numeric := booking_setting_int('split_min_contribution', 1000); v_max int := booking_setting_int('split_max_contributors', 20);
begin
  if auth.uid() is null then raise exception 'Please sign in to chip in.'; end if;
  perform _lapse_splits();
  select * into s from booking_splits where code = upper(trim(p_code)) for update;
  if not found then raise exception 'That code does not match any payment.'; end if;
  if s.status <> 'open' then raise exception 'This payment is no longer open (%).', s.status; end if;
  select * into b from shortlet_bookings where id = s.booking_id for update;
  if b.status <> 'awaiting_payment' or (b.hold_expires_at is not null and b.hold_expires_at < now()) then raise exception 'The payment window has closed.'; end if;
  if s.organiser_id = auth.uid() then raise exception 'This is your own booking. Use "Pay the rest" to pay your part.'; end if;
  v_need := _split_needed(b.id); v_pool := _split_pool(s.id);
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount.'; end if;
  if p_amount < least(v_min, v_need - v_pool) then raise exception 'The smallest amount is %.', fmt_naira(v_min); end if;
  if p_amount > v_need - v_pool then raise exception 'Only % is still needed.', fmt_naira(v_need - v_pool); end if;
  if (select count(distinct contributor_id) from booking_split_contributions where split_id = s.id and status = 'held') >= v_max
     and not exists (select 1 from booking_split_contributions where split_id = s.id and contributor_id = auth.uid() and status = 'held') then raise exception 'This payment already has the most contributors allowed.'; end if;
  select main_balance, frozen into v_bal, v_frozen from wallets where user_id = auth.uid() for update;
  if coalesce(v_frozen, false) then raise exception 'Your wallet is frozen. Please contact CHS.'; end if;
  if v_bal is null or v_bal < p_amount then raise exception 'insufficient_balance'; end if;
  select p.title into v_title from properties p where p.id = b.property_id;
  select full_name into v_name from profiles where id = auth.uid();
  update wallets set main_balance = main_balance - p_amount, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', p_amount, 'debit', 'Your contribution toward ' || coalesce(v_title, 'a booking') || ' (held until the full amount is raised; returned if it is not)', 'SPL-' || substr(v_id::text, 1, 8));
  insert into booking_split_contributions(id, split_id, booking_id, contributor_id, amount) values (v_id, s.id, b.id, auth.uid(), p_amount);
  perform notify_user(s.organiser_id, '💛 Someone chipped in', public_display_name(v_name) || ' put in ' || fmt_naira(p_amount) || ' toward ' || v_title || '. ' || fmt_naira(v_need - v_pool - p_amount) || ' still to go.', '/guest?tab=bookings');
  if v_pool + p_amount >= v_need then
    perform _split_finalize(b.id);
    return json_build_object('status', 'paid', 'remaining', 0);
  end if;
  return json_build_object('status', 'held', 'remaining', v_need - v_pool - p_amount);
end $$;

create or replace function public.split_pay_rest(p_booking uuid) returns json
language plpgsql security definer set search_path to 'public' as $$
declare s record; b record; v_need numeric; v_pool numeric; v_bal numeric;
begin
  perform _lapse_splits();
  select * into s from booking_splits where booking_id = p_booking and organiser_id = auth.uid() for update;
  if not found or s.status <> 'open' then raise exception 'There is no open split on this booking.'; end if;
  select * into b from shortlet_bookings where id = p_booking for update;
  v_need := _split_needed(b.id); v_pool := _split_pool(s.id);
  select main_balance into v_bal from wallets where user_id = auth.uid() for update;
  if v_bal is null or v_bal < v_need - v_pool then raise exception 'insufficient_balance'; end if;
  perform _split_finalize(b.id);
  return json_build_object('status', 'paid', 'paid_by_you', v_need - v_pool);
end $$;

create or replace function public.cancel_booking_split(p_booking uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare s record;
begin
  select * into s from booking_splits where booking_id = p_booking and organiser_id = auth.uid() for update;
  if not found or s.status <> 'open' then raise exception 'There is no open split on this booking.'; end if;
  perform _split_return_all(s.id, 'cancelled', 'the organiser stopped the split');
end $$;

create or replace function public.get_my_split_contributions() returns json
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  perform _lapse_splits();
  return coalesce((select json_agg(json_build_object('id', c.id, 'amount', c.amount, 'status', c.status, 'returned_back', c.refunded_back, 'title', p.title, 'check_in', b.check_in,
    'code', s.code, 'split_status', s.status, 'organiser', public_display_name(o.full_name), 'created_at', c.created_at) order by c.created_at desc)
    from booking_split_contributions c join booking_splits s on s.id = c.split_id join shortlet_bookings b on b.id = c.booking_id join properties p on p.id = b.property_id join profiles o on o.id = s.organiser_id
    where c.contributor_id = auth.uid()), '[]'::json);
end $$;

-- money coming back to the organiser from a split booking is shared back automatically
create or replace function public.trg_split_refund_share() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare s record; c record; v_total numeric; v_share numeric; v_bal numeric; v_title text;
begin
  if new.direction <> 'credit' or new.wallet_type <> 'main' or new.reference !~ '^(CXL|HCX|DSR|EXP|DEC|DEP|RFD)-' then return null; end if;
  select sp.* into s from booking_splits sp where sp.organiser_id = new.user_id and sp.status = 'paid' and sp.booking_id::text like substr(new.reference, 5, 8) || '%' limit 1;
  if not found then return null; end if;
  v_total := _split_needed(s.booking_id);
  if v_total is null or v_total <= 0 then return null; end if;
  select p.title into v_title from shortlet_bookings b join properties p on p.id = b.property_id where b.id = s.booking_id;
  for c in select * from booking_split_contributions where split_id = s.id and status = 'applied' loop
    v_share := round(new.amount * c.amount / v_total, 2);
    select main_balance into v_bal from wallets where user_id = new.user_id for update;
    v_share := least(v_share, coalesce(v_bal, 0));
    if v_share > 0 then
      update wallets set main_balance = main_balance - v_share, updated_at = now() where user_id = new.user_id;
      insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
      values (new.user_id, 'main', v_share, 'debit', 'Shared back to a contributor: their part of the refund for ' || coalesce(v_title, 'a booking'), 'SPR-' || substr(c.id::text, 1, 8));
      update wallets set main_balance = main_balance + v_share, updated_at = now() where user_id = c.contributor_id;
      insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
      values (c.contributor_id, 'main', v_share, 'credit', 'Your share of the refund for ' || coalesce(v_title, 'a booking'), 'SPR-' || substr(c.id::text, 1, 8));
      update booking_split_contributions set refunded_back = refunded_back + v_share where id = c.id;
      perform notify_user(c.contributor_id, '↩️ Your share came back', fmt_naira(v_share) || ' of the refund for ' || coalesce(v_title, 'a booking') || ' is in your wallet.', '/guest?tab=wallet');
    end if;
  end loop;
  return null;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_split_refund_share' and tgrelid = 'public.wallet_transactions'::regclass) then
    create trigger trg_split_refund_share after insert on public.wallet_transactions for each row execute function public.trg_split_refund_share();
  end if;
end $$;

-- the admin refund now carries the booking in its reference so a split can be shared back
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.proname = 'refund_shortlet_booking' and p.pronamespace = 'public'::regnamespace;
  if d like '%''REFUND-'' || substr(gen_random_uuid()::text, 1, 8)%' then
    execute replace(d, '''REFUND-'' || substr(gen_random_uuid()::text, 1, 8)', '''RFD-'' || substr(p_booking_id::text, 1, 8)');
  end if;
end $$;

grant execute on function public.open_booking_split(uuid), public.get_booking_split(uuid), public.get_split_by_code(text), public.contribute_to_split(text, numeric),
  public.split_pay_rest(uuid), public.cancel_booking_split(uuid), public.get_my_split_contributions() to authenticated;
