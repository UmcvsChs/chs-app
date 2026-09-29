-- Real, corrected fix: the actual function the real booking form
-- calls is request_shortlet_booking, not book_shortlet_with_payment --
-- confirmed by reading the real component's own RPC call directly
-- before assuming which function needed the new event fields.

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
    case when v_addon_summary != '' then ' Event requests:' || v_addon_summary else '' end);
  perform notify_admins_by_domain('owner_buyer_tenant', '📋 Real new shortlet/hire booking request',
    p_guest_full_name || ' has requested ' || v_property_title || '. Funds held in escrow pending the host''s real decision.');

  return v_booking_id;
end;
$$;
