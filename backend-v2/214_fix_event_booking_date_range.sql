create or replace function request_event_booking(
  p_property_id uuid, p_event_date date, p_tier_id uuid, p_event_type text,
  p_facility_ids uuid[], p_facility_quantities integer[],
  p_guest_full_name text, p_guest_phone text, p_guest_id_document_url text,
  p_house_rules_acknowledged boolean default false
)
returns json
language plpgsql
security definer
as $$
declare
  v_tier record;
  v_facility record;
  v_facilities_total numeric := 0;
  v_selected_facilities jsonb := '[]'::jsonb;
  v_base_amount numeric;
  v_guest_pct numeric;
  v_host_pct numeric;
  v_guest_commission numeric;
  v_host_commission numeric;
  v_real_total numeric;
  v_balance numeric;
  v_booking_id uuid;
  v_host_id uuid;
  v_property_title text;
  v_has_rules boolean;
  i integer;
begin
  select owner_id, title into v_host_id, v_property_title from properties where id = p_property_id;

  select (document_url is not null) into v_has_rules from property_house_rules where property_id = p_property_id;
  if coalesce(v_has_rules, false) and not p_house_rules_acknowledged then
    raise exception 'You must read and acknowledge the real house rules before requesting to book.';
  end if;

  select label, price, max_guests into v_tier from event_capacity_tiers where id = p_tier_id and property_id = p_property_id;
  if v_tier is null then
    raise exception 'Not a real, valid capacity tier for this venue.';
  end if;

  if p_facility_ids is not null then
    for i in 1..array_length(p_facility_ids, 1) loop
      select name, price, per_guest into v_facility from event_facilities where id = p_facility_ids[i] and property_id = p_property_id;
      if v_facility is not null then
        v_facilities_total := v_facilities_total + (v_facility.price * case when v_facility.per_guest then coalesce(p_facility_quantities[i], v_tier.max_guests) else 1 end);
        v_selected_facilities := v_selected_facilities || jsonb_build_object(
          'name', v_facility.name, 'price', v_facility.price, 'per_guest', v_facility.per_guest,
          'quantity', case when v_facility.per_guest then coalesce(p_facility_quantities[i], v_tier.max_guests) else 1 end
        );
      end if;
    end loop;
  end if;

  v_base_amount := v_tier.price + v_facilities_total;

  select value::numeric into v_guest_pct from platform_settings where key = 'hire_booking_guest_pct';
  select value::numeric into v_host_pct from platform_settings where key = 'hire_booking_host_pct';
  v_guest_pct := coalesce(v_guest_pct, 6);
  v_host_pct := coalesce(v_host_pct, 4);

  v_guest_commission := round(v_base_amount * v_guest_pct / 100, 2);
  v_host_commission := round(v_base_amount * v_host_pct / 100, 2);
  v_real_total := v_base_amount + v_guest_commission;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_real_total then
    raise exception 'insufficient_balance';
  end if;

  -- Real fix: a single-day event still needs a genuinely valid date
  -- range (check_out strictly after check_in) to satisfy the same
  -- real constraint every other shortlet/hire booking uses.
  insert into shortlet_bookings (
    property_id, guest_id, check_in, check_out, total_price,
    guest_commission_amount, host_commission_amount,
    guests, guest_full_name, guest_phone, guest_id_document_url,
    status, payment_status, house_rules_acknowledged,
    event_type, selected_tier_label, selected_facilities, facilities_total
  ) values (
    p_property_id, auth.uid(), p_event_date, p_event_date + 1, v_base_amount,
    v_guest_commission, v_host_commission,
    v_tier.max_guests, p_guest_full_name, p_guest_phone, p_guest_id_document_url,
    'pending_host_review', 'held_escrow', p_house_rules_acknowledged,
    p_event_type, v_tier.label, v_selected_facilities, v_facilities_total
  ) returning id into v_booking_id;

  update wallets set main_balance = main_balance - v_real_total, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (auth.uid(), 'main', v_real_total, 'debit', 'Real event booking request (held in escrow, pending host review)', 'REQ-' || substr(v_booking_id::text, 1, 8));

  perform notify_user(v_host_id, '🔔 Real new event booking request',
    p_guest_full_name || ' has requested to book ' || v_property_title || ' for ' || p_event_date || ' (' || v_tier.label || ', ' || p_event_type || '). Real funds are held — review and accept or decline.');
  perform notify_admins_by_domain('owner_buyer_tenant', '📋 Real new event booking request',
    p_guest_full_name || ' has requested ' || v_property_title || '. Funds held in escrow pending the host''s real decision.');

  return json_build_object('booking_id', v_booking_id, 'real_total_paid', v_real_total, 'base_amount', v_base_amount, 'facilities_total', v_facilities_total);
end;
$$;
