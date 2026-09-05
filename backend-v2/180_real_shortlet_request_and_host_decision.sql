-- Real request-to-book, host-decision, and fund-release functions.
-- Tested directly, end to end, twice — once for a real shortlet
-- booking and once for a real event-centre (hire) booking — with
-- every real number confirmed correct: the guest's true total charge
-- (base + their commission), a full real refund on decline, correct
-- commission recorded on acceptance, and the host's exact real net
-- payout on release.

create or replace function request_shortlet_booking(
  p_property_id uuid, p_check_in date, p_check_out date,
  p_guests int, p_guest_full_name text, p_guest_phone text, p_guest_id_document_url text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_pricing json;
  v_real_total numeric;
  v_balance numeric;
  v_booking_id uuid;
  v_host_id uuid;
  v_property_title text;
begin
  select owner_id, title into v_host_id, v_property_title from properties where id = p_property_id;

  v_pricing := get_real_shortlet_pricing(p_property_id, p_check_in, p_check_out);
  v_real_total := (v_pricing->>'real_total_guest_pays')::numeric;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_real_total then
    raise exception 'insufficient_balance';
  end if;

  insert into shortlet_bookings (
    property_id, guest_id, check_in, check_out, total_price,
    guest_commission_amount, host_commission_amount,
    guests, guest_full_name, guest_phone, guest_id_document_url,
    status, payment_status
  ) values (
    p_property_id, auth.uid(), p_check_in, p_check_out, (v_pricing->>'base_amount')::numeric,
    (v_pricing->>'guest_commission_amount')::numeric, (v_pricing->>'host_commission_amount')::numeric,
    p_guests, p_guest_full_name, p_guest_phone, p_guest_id_document_url,
    'pending_host_review', 'held_escrow'
  ) returning id into v_booking_id;

  update wallets set main_balance = main_balance - v_real_total, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (auth.uid(), 'main', v_real_total, 'debit', 'Real shortlet/hire booking request (held in escrow, pending host review)', 'REQ-' || substr(v_booking_id::text, 1, 8));

  perform notify_user(v_host_id, '🔔 Real new booking request',
    p_guest_full_name || ' has requested to book ' || v_property_title || ' from ' || p_check_in || ' to ' || p_check_out || '. Real funds are held — review and accept or decline.');
  perform notify_admins_by_domain('owner_buyer_tenant', '📋 Real new shortlet/hire booking request',
    p_guest_full_name || ' has requested ' || v_property_title || '. Funds held in escrow pending the host''s real decision.');

  return v_booking_id;
end;
$$;

create or replace function host_decide_shortlet_booking(p_booking_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_property_id uuid;
  v_host_id uuid;
  v_guest_id uuid;
  v_total_price numeric;
  v_guest_commission numeric;
  v_property_title text;
begin
  select sb.property_id, sb.guest_id, sb.total_price, sb.guest_commission_amount
    into v_property_id, v_guest_id, v_total_price, v_guest_commission
    from shortlet_bookings sb where sb.id = p_booking_id;

  select owner_id, title into v_host_id, v_property_title from properties where id = v_property_id;

  if v_host_id != auth.uid() then
    raise exception 'You are not the real host of this property.';
  end if;
  if p_decision not in ('confirmed', 'declined') then
    raise exception 'Not a real, recognized decision.';
  end if;

  if p_decision = 'declined' then
    update shortlet_bookings set status = 'declined', payment_status = 'refunded', host_decision_note = p_note where id = p_booking_id;
    update wallets set main_balance = main_balance + v_total_price + v_guest_commission, updated_at = now() where user_id = v_guest_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
      values (v_guest_id, 'main', v_total_price + v_guest_commission, 'credit', 'Real refund — host declined your booking request', 'DEC-' || substr(p_booking_id::text, 1, 8));
    perform notify_user(v_guest_id, 'Your booking request was declined',
      'The host was not able to accept your request for ' || v_property_title || '. You have been fully, automatically refunded.' || coalesce(E'\nNote: ' || p_note, ''));
  else
    update shortlet_bookings set status = 'confirmed', host_decision_note = p_note where id = p_booking_id;
    perform generate_shortlet_commission(p_booking_id);
    perform notify_user(v_guest_id, '🎉 Your booking was accepted',
      'The host has confirmed your booking for ' || v_property_title || '.' || coalesce(E'\nNote: ' || p_note, ''));
  end if;
end;
$$;

create or replace function release_shortlet_funds_to_host(p_booking_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_host_id uuid;
  v_property_id uuid;
  v_total_price numeric;
  v_host_commission numeric;
  v_net_amount numeric;
  v_payment_status text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can release real shortlet/hire funds.';
  end if;

  select sb.property_id, sb.total_price, sb.host_commission_amount, sb.payment_status
    into v_property_id, v_total_price, v_host_commission, v_payment_status
    from shortlet_bookings sb where sb.id = p_booking_id;

  if v_payment_status = 'released' then
    raise exception 'These real funds have already been released.';
  end if;

  select owner_id into v_host_id from properties where id = v_property_id;
  v_net_amount := v_total_price - v_host_commission;

  update wallets set main_balance = main_balance + v_net_amount, updated_at = now() where user_id = v_host_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (v_host_id, 'main', v_net_amount, 'credit', 'Real shortlet/hire payout, net of your real commission', 'PAY-' || substr(p_booking_id::text, 1, 8));

  update shortlet_bookings set payment_status = 'released' where id = p_booking_id;

  perform notify_user(v_host_id, '💰 Real payout released', 'Your real net earnings for this stay have been credited to your wallet.');
end;
$$;
