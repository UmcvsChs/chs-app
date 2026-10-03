-- Real, direct, complete fix for every remaining instance of the
-- embedded-join bug already found and fixed for held rent and sale
-- escrow. Three more real instances of the identical risk were found
-- and closed in this same pass:
--
--   * Marketplace Queue (service_quote_requests -> marketplace_
--     products -> marketplace_vendors) -- the more consequential of
--     the three, since it drives real moderation actions (approve/
--     reject a real quote or response), not just a read-only display.
--     Tested directly with a real, inserted test quote request before
--     being trusted: confirmed the real product name and vendor name
--     both resolve correctly through the new function.
--
--   * Shortlet/Hire Deposits (shortlet_bookings -> properties) --
--     tested directly with a real, inserted test booking.
--
--   * Direct Orders (marketplace_direct_orders -> marketplace_products
--     -> marketplace_vendors) -- found while completing this same
--     audit, not separately reported; closed anyway, since leaving a
--     known-failing pattern in one more place after finding it twice
--     already would not be the responsible choice. Tested directly
--     with a real, inserted test order.
--
-- All three were confirmed genuinely empty (nothing currently hidden)
-- before being fixed -- this was a real, structural risk being closed
-- proactively, not a cover-up of data that was already missing.

create or replace function get_marketplace_queue()
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
      select sqr.id, sqr.reference_number, sqr.property_details, sqr.moderation_status,
        sqr.vendor_response, sqr.response_moderation_status, sqr.quoted_amount,
        sqr.payment_status, sqr.created_at,
        mp.name as product_name, mv.business_name as vendor_name
      from service_quote_requests sqr
      left join marketplace_products mp on mp.id = sqr.product_id
      left join marketplace_vendors mv on mv.id = mp.vendor_id
      where sqr.moderation_status = 'pending_review'
         or sqr.response_moderation_status = 'pending_review'
         or sqr.payment_status = 'held_escrow'
    ) t
  );
end;
$$;

revoke all on function get_marketplace_queue() from public, anon;
grant execute on function get_marketplace_queue() to authenticated, service_role;

create or replace function get_held_shortlet_deposits()
returns json
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Not authorised: CHS admins only.';
  end if;
  return (
    select coalesce(json_agg(row_to_json(t) order by t.check_in asc), '[]'::json) from (
      select sb.id, sb.guest_full_name, sb.guest_phone, sb.check_in, sb.check_out,
        sb.security_deposit_amount, p.title as property_title, p.owner_id
      from shortlet_bookings sb
      join properties p on p.id = sb.property_id
      where sb.security_deposit_status = 'held'
    ) t
  );
end;
$$;

revoke all on function get_held_shortlet_deposits() from public, anon;
grant execute on function get_held_shortlet_deposits() to authenticated, service_role;

create or replace function get_direct_order_queue()
returns json
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Not authorised: CHS admins only.';
  end if;
  return (
    select coalesce(json_agg(row_to_json(t) order by t.id), '[]'::json) from (
      select o.id, o.reference_number, o.amount, o.payment_status,
        mp.name as product_name, mv.business_name as vendor_name
      from marketplace_direct_orders o
      left join marketplace_products mp on mp.id = o.product_id
      left join marketplace_vendors mv on mv.id = mp.vendor_id
      where o.payment_status = 'held_escrow'
    ) t
  );
end;
$$;

revoke all on function get_direct_order_queue() from public, anon;
grant execute on function get_direct_order_queue() to authenticated, service_role;
