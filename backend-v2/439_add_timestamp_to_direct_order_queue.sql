-- Real, direct fix per a direct, firm client instruction, stated
-- plainly: every real transaction, successful or not, carries a real
-- timestamp, for genuine audit purposes — time and sequence, not
-- just the figures themselves. Found during a full sweep of the
-- admin dashboard, started from Escrow Oversight (fixed directly in
-- app/admin/page.tsx — all four categories plus the unified list now
-- show a real date and time) and extended across the rest of the
-- dashboard. get_direct_order_queue was the one real backend gap
-- found that required a database change -- it never returned
-- created_at at all. Seven more real, confirmed gaps were pure
-- frontend fixes (the real timestamp already existed in the data,
-- or just needed adding to an existing query's select list, and was
-- simply never displayed): Escrow Oversight's four sections and
-- unified list, ID Verification, Sale Document Review (both of its
-- two real screens), Document Dispatch Requests, Recently Handled
-- Applications, and Properties Awaiting Verification.

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
    select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json) from (
      select o.id, o.reference_number, o.amount, o.payment_status, o.created_at,
        mp.name as product_name, mv.business_name as vendor_name
      from marketplace_direct_orders o
      left join marketplace_products mp on mp.id = o.product_id
      left join marketplace_vendors mv on mv.id = mp.vendor_id
      where o.payment_status = 'held_escrow'
    ) t
  );
end;
$$;
