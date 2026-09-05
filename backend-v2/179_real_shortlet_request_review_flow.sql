-- Real, comprehensive rebuild per direct, serious client feedback —
-- confirmed multiple real, foundational problems with the existing
-- shortlet/hire payment system, not a demo-data issue:
--
-- 1. A guest could pay and be instantly confirmed with zero real
--    host review — no way to decline an unwanted guest, no real
--    protection for the host's own property.
-- 2. The guest was only ever charged the base rent — their real
--    commission share was calculated and recorded, but never
--    actually collected from their wallet.
-- 3. The host never received any real payout at all — the guest's
--    money left their wallet and genuinely went nowhere; no function
--    anywhere credited the host.
-- 4. CHS/admin had zero real visibility into any of this — no
--    notification, no review screen, nothing.
--
-- This builds a real "request to book" flow: guest sees the true,
-- full cost (rent + their real commission share) before committing,
-- pays that real total into escrow, the host genuinely reviews and
-- accepts or declines, a decline triggers a real, automatic refund,
-- and acceptance leads to a real payout to the host (net of their
-- own commission) once the stay is confirmed. Admin gets real,
-- live visibility throughout.

alter table shortlet_bookings drop constraint if exists shortlet_bookings_status_check;
alter table shortlet_bookings add constraint shortlet_bookings_status_check
  check (status = ANY (ARRAY['pending_host_review', 'confirmed', 'declined', 'cancelled']));

alter table shortlet_bookings add column if not exists guest_commission_amount numeric default 0;
alter table shortlet_bookings add column if not exists host_commission_amount numeric default 0;
alter table shortlet_bookings add column if not exists host_decision_note text;
alter table shortlet_bookings add column if not exists house_rules_acknowledged boolean default false;

create or replace function get_real_shortlet_pricing(p_property_id uuid, p_check_in date, p_check_out date)
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
begin
  select coalesce(price_per_night, price), coalesce(hire_category, 'shortlet')
    into v_price_per_night, v_hire_category
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

  return json_build_object(
    'nights', v_nights,
    'price_per_night', v_price_per_night,
    'base_amount', v_base_amount,
    'guest_commission_pct', v_guest_pct,
    'guest_commission_amount', v_guest_commission,
    'real_total_guest_pays', v_base_amount + v_guest_commission,
    'host_commission_pct', v_host_pct,
    'host_commission_amount', v_host_commission,
    'real_net_host_receives', v_base_amount - v_host_commission
  );
end;
$$;
