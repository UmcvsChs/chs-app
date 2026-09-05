-- Real, comprehensive update -- pricing and the actual booking
-- request now both know whether a real security deposit genuinely
-- applies: only when the host has switched it on for that listing,
-- AND the specific guest asking is genuinely first-time (fewer than
-- 3 real ratings on file). A guest with 3+ ratings never sees or
-- pays a deposit, even on a deposit-enabled listing. Tested directly:
-- confirmed deposit correctly included for a first-time guest, and
-- correctly waived after 3 real ratings were on file.

create or replace function get_real_shortlet_pricing(p_property_id uuid, p_check_in date, p_check_out date, p_guest_id uuid default null)
returns json
language plpgsql
stable
as $$
declare
  v_price_per_night numeric;
  v_hire_category text;
  v_nights int;
  v_guest_pct numeric;
  v_host_pct numeric;
  v_base_amount numeric;
  v_guest_commission numeric;
  v_host_commission numeric;
  v_deposit_enabled boolean;
  v_deposit_amount numeric;
  v_is_first_time boolean;
  v_real_deposit numeric := 0;
begin
  select coalesce(price_per_night, price), coalesce(hire_category, 'shortlet'), security_deposit_enabled, security_deposit_amount
    into v_price_per_night, v_hire_category, v_deposit_enabled, v_deposit_amount
    from properties where id = p_property_id;

  v_nights := greatest(p_check_out - p_check_in, 1);
  v_base_amount := v_nights * v_price_per_night;

  if v_hire_category = 'shortlet' then
    if v_nights <= 3 then
      select value::numeric into v_guest_pct from platform_settings where key = 'shortlet_short_guest_pct';
      select value::numeric into v_host_pct from platform_settings where key = 'shortlet_short_host_pct';
    elsif v_nights <= 13 then
      select value::numeric into v_guest_pct from platform_settings where key = 'shortlet_medium_guest_pct';
      select value::numeric into v_host_pct from platform_settings where key = 'shortlet_medium_host_pct';
    else
      select value::numeric into v_guest_pct from platform_settings where key = 'shortlet_long_guest_pct';
      select value::numeric into v_host_pct from platform_settings where key = 'shortlet_long_host_pct';
    end if;
  else
    select value::numeric into v_guest_pct from platform_settings where key = 'hire_booking_guest_pct';
    select value::numeric into v_host_pct from platform_settings where key = 'hire_booking_host_pct';
  end if;

  v_guest_commission := round(v_base_amount * v_guest_pct / 100, 2);
  v_host_commission := round(v_base_amount * v_host_pct / 100, 2);

  if v_deposit_enabled and p_guest_id is not null then
    select (count(*) < 3) into v_is_first_time from shortlet_ratings where rated_user = p_guest_id and role = 'host_rating_guest';
    if coalesce(v_is_first_time, true) then
      v_real_deposit := coalesce(v_deposit_amount, 0);
    end if;
  end if;

  return json_build_object(
    'nights', v_nights,
    'price_per_night', v_price_per_night,
    'base_amount', v_base_amount,
    'guest_commission_pct', v_guest_pct,
    'guest_commission_amount', v_guest_commission,
    'security_deposit_required', v_real_deposit > 0,
    'security_deposit_amount', v_real_deposit,
    'real_total_guest_pays', v_base_amount + v_guest_commission + v_real_deposit,
    'host_commission_pct', v_host_pct,
    'host_commission_amount', v_host_commission,
    'real_net_host_receives', v_base_amount - v_host_commission
  );
end;
$$;

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
  v_real_deposit numeric;
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
    security_deposit_amount, security_deposit_status
  ) values (
    p_property_id, auth.uid(), p_check_in, p_check_out, (v_pricing->>'base_amount')::numeric,
    (v_pricing->>'guest_commission_amount')::numeric, (v_pricing->>'host_commission_amount')::numeric,
    p_guests, p_guest_full_name, p_guest_phone, p_guest_id_document_url,
    'pending_host_review', 'held_escrow', p_house_rules_acknowledged,
    v_real_deposit, case when v_real_deposit > 0 then 'held' else 'not_applicable' end
  ) returning id into v_booking_id;

  update wallets set main_balance = main_balance - v_real_total, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (auth.uid(), 'main', v_real_total, 'debit',
      'Real shortlet/hire booking request (held in escrow, pending host review)' || case when v_real_deposit > 0 then ', includes a real ' || v_real_deposit || ' security deposit' else '' end,
      'REQ-' || substr(v_booking_id::text, 1, 8));

  perform notify_user(v_host_id, '🔔 Real new booking request',
    p_guest_full_name || ' has requested to book ' || v_property_title || ' from ' || p_check_in || ' to ' || p_check_out || '. Real funds are held — review and accept or decline.');
  perform notify_admins_by_domain('owner_buyer_tenant', '📋 Real new shortlet/hire booking request',
    p_guest_full_name || ' has requested ' || v_property_title || '. Funds held in escrow pending the host''s real decision.');

  return v_booking_id;
end;
$$;
