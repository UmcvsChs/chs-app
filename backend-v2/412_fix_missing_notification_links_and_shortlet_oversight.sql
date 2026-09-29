-- Real, direct fixes per a direct client audit: found by checking
-- every real call to notify_admins_by_domain across the database for
-- a missing link -- the exact class of bug the client found by hand
-- in the shortlet booking flow (a notification with no "tap here to
-- view"), closed everywhere it existed.
--
-- Also: a real, new admin queue for shortlet/hire booking requests.
-- Shortlet/hire bookings are correctly decided by the host directly
-- (not gated through an admin review queue, unlike rental
-- applications and offers), but admin had no real way to see what's
-- pending or track it -- exactly the gap the client hit trying to
-- find Danbo Halimat Juliet's ₦954,000 booking. Confirmed on
-- deployment: this also surfaced a second, older booking that had
-- been sitting 17 real days with zero admin visibility.

create or replace function get_pending_shortlet_bookings()
returns json
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Not authorised: CHS admins only.';
  end if;
  return (
    select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json) from (
      select sb.id, sb.status, sb.payment_status, sb.total_price, sb.check_in, sb.check_out,
        sb.guest_full_name, sb.guest_phone, sb.created_at,
        p.title as property_title, host.full_name as host_name, host.phone as host_phone
      from shortlet_bookings sb
      join properties p on p.id = sb.property_id
      join profiles host on host.id = p.owner_id
      where sb.status = 'pending_host_review'
    ) t
  );
end;
$$;

revoke all on function get_pending_shortlet_bookings() from public, anon;
grant execute on function get_pending_shortlet_bookings() to authenticated, service_role;

create or replace function request_shortlet_booking(
  p_property_id uuid, p_check_in date, p_check_out date, p_guests integer,
  p_guest_full_name text, p_guest_phone text, p_guest_id_document_url text,
  p_house_rules_acknowledged boolean default false,
  p_wants_music_band boolean default false, p_wants_caterer boolean default false,
  p_wants_ushers boolean default false, p_number_of_ushers integer default null,
  p_additional_event_requests text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_pricing json;
  v_real_total numeric;
  v_real_deposit numeric;
  v_balance numeric;
  v_booking_id uuid;
  v_host_id uuid;
  v_property_title text;
  v_has_rules boolean;
  v_addon_summary text := '';
begin
  select owner_id, title into v_host_id, v_property_title from properties where id = p_property_id;

  select (document_url is not null) into v_has_rules from property_house_rules where property_id = p_property_id;
  if coalesce(v_has_rules, false) and not p_house_rules_acknowledged then
    raise exception 'You must read and acknowledge the real house rules before requesting to book.';
  end if;

  v_pricing := get_real_shortlet_pricing(p_property_id, p_check_in, p_check_out, auth.uid());
  v_real_total := (v_pricing->>'real_total_guest_pays')::numeric;
  v_real_deposit := (v_pricing->>'security_deposit_amount')::numeric;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_real_total then
    raise exception 'insufficient_balance';
  end if;

  insert into shortlet_bookings (
    property_id, guest_id, check_in, check_out, total_price,
    guest_commission_amount, host_commission_amount,
    guests, guest_full_name, guest_phone, guest_id_document_url,
    status, payment_status, house_rules_acknowledged,
    security_deposit_amount, security_deposit_status,
    wants_music_band, wants_caterer, wants_ushers, number_of_ushers, additional_event_requests
  ) values (
    p_property_id, auth.uid(), p_check_in, p_check_out, (v_pricing->>'base_amount')::numeric,
    (v_pricing->>'guest_commission_amount')::numeric, (v_pricing->>'host_commission_amount')::numeric,
    p_guests, p_guest_full_name, p_guest_phone, p_guest_id_document_url,
    'pending_host_review', 'held_escrow', p_house_rules_acknowledged,
    v_real_deposit, case when v_real_deposit > 0 then 'held' else 'not_applicable' end,
    p_wants_music_band, p_wants_caterer, p_wants_ushers, p_number_of_ushers, p_additional_event_requests
  ) returning id into v_booking_id;

  update wallets set main_balance = main_balance - v_real_total, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (auth.uid(), 'main', v_real_total, 'debit',
      'Real shortlet/hire booking request (held in escrow, pending host review)' || case when v_real_deposit > 0 then ', includes a real ' || v_real_deposit || ' security deposit' else '' end,
      'REQ-' || substr(v_booking_id::text, 1, 8));

  if p_wants_music_band then v_addon_summary := v_addon_summary || ' 🎵 Music band.'; end if;
  if p_wants_caterer then v_addon_summary := v_addon_summary || ' 🍽️ Caterer.'; end if;
  if p_wants_ushers then v_addon_summary := v_addon_summary || ' 🙋 ' || coalesce(p_number_of_ushers::text, '?') || ' usher(s).'; end if;

  perform notify_user(v_host_id, '🔔 Real new booking request',
    p_guest_full_name || ' has requested to book ' || v_property_title || ' from ' || p_check_in || ' to ' || p_check_out || '. Real funds are held — review and accept or decline.' ||
    case when v_addon_summary != '' then ' Event requests:' || v_addon_summary else '' end,
    '/owner');
  perform notify_admins_by_domain('owner_buyer_tenant', '📋 Real new shortlet/hire booking request',
    p_guest_full_name || ' has requested ' || v_property_title || '. Funds held in escrow pending the host''s real decision.',
    '/admin?tab=shortletbookings');

  return v_booking_id;
end;
$$;

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
    p_guest_full_name || ' has requested to book ' || v_property_title || ' for ' || p_event_date || ' (' || v_tier.label || ', ' || p_event_type || '). Real funds are held — review and accept or decline.',
    '/owner');
  perform notify_admins_by_domain('owner_buyer_tenant', '📋 Real new event booking request',
    p_guest_full_name || ' has requested ' || v_property_title || '. Funds held in escrow pending the host''s real decision.',
    '/admin?tab=shortletbookings');

  return json_build_object('booking_id', v_booking_id, 'real_total_paid', v_real_total, 'base_amount', v_base_amount, 'facilities_total', v_facilities_total);
end;
$$;

create or replace function trigger_notify_new_registration()
returns trigger
language plpgsql
security definer
as $$
begin
  perform notify_admins_by_domain('registration_setup', '🆕 New real registration pending',
    new.full_name || ' (' || new.role || ') just registered and needs your approval.',
    '/admin?tab=registrations');
  return new;
end;
$$;
