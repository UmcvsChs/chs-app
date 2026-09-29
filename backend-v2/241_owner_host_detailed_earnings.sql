-- Real, comprehensive "My Earnings" per direct, detailed client
-- request: every real income source for an owner/host, fully
-- itemized — category, payer's real name, property, unit/category
-- detail, real gross amount, the real platform commission taken, the
-- real net received, and a real timestamp. Built for genuine
-- accounting use, not a vague summary.

create or replace function get_owner_earnings_detailed()
returns json
language sql
security definer
stable
as $$
  select coalesce(json_agg(row_to_json(t) order by t.paid_at desc), '[]'::json) from (
    -- Real rental income
    select 'rent' as category, rp.amount as gross_amount,
      round(rp.amount * (select value::numeric from platform_settings where key = 'rental_commission_landlord_percentage') / 100, 2) as commission_amount,
      rp.amount - round(rp.amount * (select value::numeric from platform_settings where key = 'rental_commission_landlord_percentage') / 100, 2) as net_amount,
      rp.created_at as paid_at, p_tenant.full_name as payer_name,
      prop.title as property_title, prop.location_area as property_location,
      'Rent payment' as detail_label, rp.reference
    from rent_payments rp
    join tenancies t on t.id = rp.tenancy_id
    join properties prop on prop.id = t.property_id
    join profiles p_tenant on p_tenant.id = rp.tenant_id
    where t.landlord_id = auth.uid()

    union all

    -- Real sale income (only once funds have genuinely been released)
    select 'sale' as category, o.amount as gross_amount,
      round(o.amount * (select value::numeric from platform_settings where key = 'sale_commission_seller_percentage') / 100, 2) as commission_amount,
      o.amount - round(o.amount * (select value::numeric from platform_settings where key = 'sale_commission_seller_percentage') / 100, 2) as net_amount,
      o.created_at as paid_at, o.buyer_full_name as payer_name,
      prop.title as property_title, prop.location_area as property_location,
      'Property sale' as detail_label, null as reference
    from offers o
    join properties prop on prop.id = o.property_id
    where prop.owner_id = auth.uid() and o.legal_transfer_confirmed = true

    union all

    -- Real shortlet/hire/event host income
    select 'shortlet' as category, sb.total_price as gross_amount,
      sb.host_commission_amount as commission_amount,
      sb.total_price - sb.host_commission_amount as net_amount,
      sb.created_at as paid_at, sb.guest_full_name as payer_name,
      prop.title as property_title, prop.location_area as property_location,
      'Booking, ' || sb.check_in || ' to ' || sb.check_out as detail_label, null as reference
    from shortlet_bookings sb
    join properties prop on prop.id = sb.property_id
    where prop.owner_id = auth.uid() and sb.payment_status = 'released'
  ) t;
$$;
