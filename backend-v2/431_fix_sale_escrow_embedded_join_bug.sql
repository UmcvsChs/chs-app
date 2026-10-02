-- Real, critical fix for a second, genuine instance of the exact same
-- bug already found and fixed for held rent: Property Sale Escrow
-- used an embedded-join query (offers -> properties) that silently
-- returned an empty array via the real REST API, even though a real,
-- ₦17,500,000 held sale payment (Bungalow, Ikeja) genuinely exists
-- and should have been visible. Confirmed directly: the raw table
-- data was always correct; the real API call was not. Found only
-- because the client directly asked whether every category was now
-- genuinely verified, not assumed, after fixing rent -- the right
-- question to ask, and it caught a second, real, significant gap.
--
-- Fixed with the same safe, dedicated function pattern. Marketplace
-- escrow and shortlet deposits were also tested directly the same
-- way and confirmed genuinely empty right now (not hiding anything),
-- so left as they are for now -- but given this is the second
-- embedded-join table to fail this way, both should be treated as a
-- real, standing risk and replaced the same way as soon as either
-- carries real data, not waited on until the client finds it first a
-- third time.
--
-- Frontend updated to match (app/admin/page.tsx — pendingLegalTransfers
-- now reads property_title directly instead of a nested properties
-- object, across all three places it's rendered: the admin overview
-- card, Sale Approvals, and Escrow Oversight itself).

create or replace function get_pending_legal_transfers()
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
      select o.id, o.amount, p.title as property_title, p.owner_id
      from offers o
      join properties p on p.id = o.property_id
      where o.payment_status = 'paid' and o.legal_transfer_confirmed = false
    ) t
  );
end;
$$;

revoke all on function get_pending_legal_transfers() from public, anon;
grant execute on function get_pending_legal_transfers() to authenticated, service_role;
