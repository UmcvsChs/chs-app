-- Real update to request_shortlet_booking() — now requires and
-- stores real house-rules acknowledgment when a property has real
-- house rules on file, blocking the request outright if the guest
-- hasn't actually checked the box. Tested directly: a request without
-- acknowledgment was correctly blocked with a clear error, and the
-- same request with acknowledgment correctly succeeded.

create or replace function request_shortlet_booking(
  p_property_id uuid, p_check_in date, p_check_out date,
  p_guests int, p_guest_full_name text, p_guest_phone text, p_guest_id_document_url text,
  p_house_rules_acknowledged boolean default false
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
  v_has_rules boolean;
begin
  select owner_id, title into v_host_id, v_property_title from properties where id = p_property_id;

  select (document_url is not null) into v_has_rules from property_house_rules where property_id = p_property_id;
  if coalesce(v_has_rules, false) and not p_house_rules_acknowledged then
    raise exception 'You must read and acknowledge the real house rules before requesting to book.';
  end if;

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
    status, payment_status, house_rules_acknowledged
  ) values (
    p_property_id, auth.uid(), p_check_in, p_check_out, (v_pricing->>'base_amount')::numeric,
    (v_pricing->>'guest_commission_amount')::numeric, (v_pricing->>'host_commission_amount')::numeric,
    p_guests, p_guest_full_name, p_guest_phone, p_guest_id_document_url,
    'pending_host_review', 'held_escrow', p_house_rules_acknowledged
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
