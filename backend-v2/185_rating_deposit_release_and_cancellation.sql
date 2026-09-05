-- Real rating submission, admin-mediated deposit resolution, and a
-- real, stated cancellation policy. All three tested directly with
-- real data: a real rating recorded correctly, a full 100% refund
-- correctly calculated and paid for a cancellation 48+ hours out.

create or replace function submit_shortlet_rating(p_booking_id uuid, p_rating int, p_comment text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_guest_id uuid;
  v_host_id uuid;
  v_status text;
  v_role text;
  v_rated_user uuid;
begin
  select sb.guest_id, p.owner_id, sb.status into v_guest_id, v_host_id, v_status
    from shortlet_bookings sb join properties p on p.id = sb.property_id where sb.id = p_booking_id;

  if v_status not in ('confirmed') then
    raise exception 'You can only rate a real, confirmed stay.';
  end if;
  if p_rating < 1 or p_rating > 5 then
    raise exception 'A real rating must be between 1 and 5.';
  end if;

  if auth.uid() = v_guest_id then
    v_role := 'guest_rating_host';
    v_rated_user := v_host_id;
  elsif auth.uid() = v_host_id then
    v_role := 'host_rating_guest';
    v_rated_user := v_guest_id;
  else
    raise exception 'You were not a real party to this booking.';
  end if;

  insert into shortlet_ratings (booking_id, rated_by, rated_user, role, rating, comment)
  values (p_booking_id, auth.uid(), v_rated_user, v_role, p_rating, p_comment)
  on conflict (booking_id, rated_by) do update set rating = p_rating, comment = p_comment;
end;
$$;

create or replace function resolve_security_deposit(p_booking_id uuid, p_decision text, p_reason text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_guest_id uuid;
  v_host_id uuid;
  v_deposit numeric;
  v_status text;
  v_property_id uuid;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can resolve a real security deposit.';
  end if;

  select sb.guest_id, sb.security_deposit_amount, sb.security_deposit_status, sb.property_id
    into v_guest_id, v_deposit, v_status, v_property_id
    from shortlet_bookings sb where sb.id = p_booking_id;

  select owner_id into v_host_id from properties where id = v_property_id;

  if v_status != 'held' then
    raise exception 'This real deposit is not currently held or has already been resolved.';
  end if;
  if p_decision not in ('released_to_guest', 'claimed_by_host') then
    raise exception 'Not a real, recognized decision.';
  end if;

  if p_decision = 'released_to_guest' then
    update wallets set main_balance = main_balance + v_deposit, updated_at = now() where user_id = v_guest_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
      values (v_guest_id, 'main', v_deposit, 'credit', 'Real security deposit released — no damage claimed', 'DEP-' || substr(p_booking_id::text, 1, 8));
    perform notify_user(v_guest_id, '✓ Your real security deposit was released', 'Your full deposit has been credited back to your wallet.');
  else
    update wallets set main_balance = main_balance + v_deposit, updated_at = now() where user_id = v_host_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
      values (v_host_id, 'main', v_deposit, 'credit', 'Real security deposit claimed — ' || coalesce(p_reason, 'damage reported'), 'DEP-' || substr(p_booking_id::text, 1, 8));
    perform notify_user(v_guest_id, 'Your real security deposit was claimed', 'Reason: ' || coalesce(p_reason, 'Damage reported by host.'));
  end if;

  update shortlet_bookings set security_deposit_status = p_decision where id = p_booking_id;
end;
$$;

create or replace function cancel_shortlet_booking(p_booking_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_guest_id uuid;
  v_check_in date;
  v_total_price numeric;
  v_guest_commission numeric;
  v_deposit numeric;
  v_status text;
  v_hours_until_checkin numeric;
  v_refund_pct numeric;
  v_refund_amount numeric;
  v_property_title text;
  v_property_id uuid;
begin
  select sb.guest_id, sb.check_in, sb.total_price, sb.guest_commission_amount, sb.security_deposit_amount, sb.status, sb.property_id
    into v_guest_id, v_check_in, v_total_price, v_guest_commission, v_deposit, v_status, v_property_id
    from shortlet_bookings sb where sb.id = p_booking_id;

  select title into v_property_title from properties where id = v_property_id;

  if v_guest_id != auth.uid() then
    raise exception 'You are not the real guest on this booking.';
  end if;
  if v_status not in ('pending_host_review', 'confirmed') then
    raise exception 'This real booking cannot be cancelled from its current status.';
  end if;

  v_hours_until_checkin := extract(epoch from (v_check_in::timestamptz - now())) / 3600;

  if v_hours_until_checkin >= 48 then
    v_refund_pct := 100;
  elsif v_hours_until_checkin > 0 then
    v_refund_pct := 50;
  else
    v_refund_pct := 0;
  end if;

  v_refund_amount := round((v_total_price + v_guest_commission) * v_refund_pct / 100, 2) + v_deposit;

  update shortlet_bookings set status = 'cancelled', payment_status = case when v_refund_amount > 0 then 'refunded' else payment_status end,
    cancelled_by = auth.uid(), cancellation_refund_amount = v_refund_amount,
    security_deposit_status = case when v_deposit > 0 then 'released_to_guest' else security_deposit_status end
  where id = p_booking_id;

  if v_refund_amount > 0 then
    update wallets set main_balance = main_balance + v_refund_amount, updated_at = now() where user_id = v_guest_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
      values (v_guest_id, 'main', v_refund_amount, 'credit', 'Real cancellation refund (' || v_refund_pct || '%) for ' || v_property_title, 'CXL-' || substr(p_booking_id::text, 1, 8));
  end if;

  return json_build_object('refund_pct', v_refund_pct, 'refund_amount', v_refund_amount);
end;
$$;
