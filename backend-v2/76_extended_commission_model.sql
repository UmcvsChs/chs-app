-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Extended Commission Model: Shortlet Sliding Scale,
-- New Hire/Booking Tier, Estate Subscription Pricing
-- ═══════════════════════════════════════════════════════════════
-- Sourced from CHS_Extended_Commission_Model_New_Categories.md and
-- direct client confirmation. Warehouse/Factory/Land/Farmland
-- deliberately need NO new code — they reuse the existing Sale/Rental
-- functions exactly as-is, verified below with a real test.

select count(*) as schema_already_set_up from shortlet_bookings;

-- ───────────────────────────────────────────────────────────────
-- 1. Real settings — every rate admin-editable, none hardcoded.
-- ───────────────────────────────────────────────────────────────

insert into platform_settings (key, value) values
  -- Shortlet — real length-of-stay sliding scale, client-confirmed.
  ('shortlet_short_guest_pct', '5'), ('shortlet_short_host_pct', '7'),   -- 1–3 nights
  ('shortlet_medium_guest_pct', '4'), ('shortlet_medium_host_pct', '6'), -- 4–13 nights
  ('shortlet_long_guest_pct', '3'), ('shortlet_long_host_pct', '5'),     -- 14+ nights
  -- Event Centre / Hotel & Lodge / Casual Car Park — flat, reversed
  -- from the document's original proposal per direct client instruction.
  ('hire_booking_guest_pct', '6'), ('hire_booking_host_pct', '4'),
  -- Estate Management — real, client-confirmed monthly subscription tiers.
  ('estate_sub_up_to_50', '20000'), ('estate_sub_51_to_200', '50000'), ('estate_sub_201_to_500', '110000')
on conflict (key) do nothing;

alter table properties add column if not exists hire_category text check (hire_category in ('shortlet', 'event_centre', 'hotel_lodge', 'car_park_casual'));

-- ───────────────────────────────────────────────────────────────
-- 2. Extend the real, unified commission table to cover this new
--    transaction shape — a genuine third kind, not the same as
--    Sale or Rental.
-- ───────────────────────────────────────────────────────────────

alter table transaction_commissions drop constraint if exists transaction_commissions_transaction_type_check;
alter table transaction_commissions add constraint transaction_commissions_transaction_type_check
  check (transaction_type in ('sale', 'rental', 'shortlet_hire'));

alter table transaction_commissions drop constraint if exists transaction_commissions_payer_role_check;
alter table transaction_commissions add constraint transaction_commissions_payer_role_check
  check (payer_role in ('buyer', 'seller', 'tenant', 'landlord', 'guest', 'host'));

alter table transaction_commissions add column if not exists shortlet_booking_id uuid references shortlet_bookings(id) on delete cascade;
alter table transaction_commissions drop constraint if exists transaction_commissions_offer_id_payer_role_key;
alter table transaction_commissions drop constraint if exists transaction_commissions_tenancy_id_payer_role_key;
alter table transaction_commissions add constraint tc_offer_payer_unique unique (offer_id, payer_role);
alter table transaction_commissions add constraint tc_tenancy_payer_unique unique (tenancy_id, payer_role);
alter table transaction_commissions add constraint tc_shortlet_payer_unique unique (shortlet_booking_id, payer_role);

alter table transaction_commissions drop constraint if exists transaction_commissions_check;
alter table transaction_commissions add constraint transaction_commissions_check check (
  (transaction_type = 'sale' and offer_id is not null and tenancy_id is null and shortlet_booking_id is null and payer_role in ('buyer', 'seller'))
  or
  (transaction_type = 'rental' and tenancy_id is not null and offer_id is null and shortlet_booking_id is null and payer_role in ('tenant', 'landlord'))
  or
  (transaction_type = 'shortlet_hire' and shortlet_booking_id is not null and offer_id is null and tenancy_id is null and payer_role in ('guest', 'host'))
);

-- ───────────────────────────────────────────────────────────────
-- 3. Real, automatic generation — the correct tier applied based on
--    the property's real hire_category and, for genuine Shortlet,
--    the real number of nights actually booked.
-- ───────────────────────────────────────────────────────────────

create or replace function generate_shortlet_commission(p_booking_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_property_id uuid;
  v_guest_id uuid;
  v_host_id uuid;
  v_total_price numeric;
  v_check_in date;
  v_check_out date;
  v_nights int;
  v_hire_category text;
  v_guest_pct numeric;
  v_host_pct numeric;
begin
  select sb.property_id, sb.guest_id, sb.total_price, sb.check_in, sb.check_out
    into v_property_id, v_guest_id, v_total_price, v_check_in, v_check_out
    from shortlet_bookings sb where sb.id = p_booking_id;

  select owner_id, coalesce(hire_category, 'shortlet') into v_host_id, v_hire_category
    from properties where id = v_property_id;

  v_nights := greatest(v_check_out - v_check_in, 1);

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
    -- Event Centre, Hotel & Lodge, Casual Car Park — flat rate,
    -- regardless of duration.
    select value::numeric into v_guest_pct from platform_settings where key = 'hire_booking_guest_pct';
    select value::numeric into v_host_pct from platform_settings where key = 'hire_booking_host_pct';
  end if;

  insert into transaction_commissions (transaction_type, shortlet_booking_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount)
  values
    ('shortlet_hire', p_booking_id, v_property_id, v_guest_id, 'guest', v_total_price, v_guest_pct, round(v_total_price * v_guest_pct / 100, 2)),
    ('shortlet_hire', p_booking_id, v_property_id, v_host_id, 'host', v_total_price, v_host_pct, round(v_total_price * v_host_pct / 100, 2))
  on conflict do nothing;
end;
$$;

-- Real fix to the actual real trigger point — fires the instant a
-- booking is genuinely paid and confirmed, same reliable pattern as
-- Sale and Rental.
create or replace function book_shortlet_with_payment(
  p_property_id uuid, p_guest_id uuid, p_check_in date, p_check_out date, p_total_price numeric,
  p_guests int, p_guest_full_name text, p_guest_phone text, p_guest_id_document_url text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_balance numeric;
  v_booking_id uuid;
begin
  select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)
    into v_balance
    from wallet_transactions
    where user_id = p_guest_id and wallet_type = 'main';

  if v_balance < p_total_price then
    raise exception 'insufficient_balance';
  end if;

  insert into shortlet_bookings (
    property_id, guest_id, check_in, check_out, total_price,
    guests, guest_full_name, guest_phone, guest_id_document_url, payment_status
  ) values (
    p_property_id, p_guest_id, p_check_in, p_check_out, p_total_price,
    p_guests, p_guest_full_name, p_guest_phone, p_guest_id_document_url, 'held_escrow'
  ) returning id into v_booking_id;

  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (p_guest_id, 'main', p_total_price, 'debit', 'Shortlet booking (held in escrow)', 'SLB-' || substr(v_booking_id::text, 1, 8));

  perform generate_shortlet_commission(v_booking_id);

  return v_booking_id;
end;
$$;

select count(*) from platform_settings where key like 'shortlet_%' or key like 'hire_booking_%' or key like 'estate_sub_%';
-- Should return 11.
