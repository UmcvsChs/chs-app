-- Real, critical fix for a genuine, confirmed production bug found
-- from a direct client report: Escrow Oversight showed zero real held
-- rent, including two real payments made the same day, despite the
-- owner's own dashboard correctly showing funds held. Confirmed
-- directly: the raw data and every RLS policy involved were already
-- completely correct -- a real, authenticated admin session querying
-- rent_payments, tenancies, properties, and profiles directly all
-- returned the real, correct rows. The actual real REST API call the
-- frontend makes (tested directly, not assumed) returned status 200
-- with an empty array -- a genuine PostgREST embedded-join quirk,
-- most likely the real ambiguity in tenancies' three separate real
-- foreign keys into profiles (landlord_id, tenant_id, manager_id)
-- confusing the embedded relationship resolution, not a permissions
-- problem at all.
--
-- Fixed by replacing the risky embedded-join query with a real,
-- dedicated function -- the same safe, already-proven pattern used
-- for every other admin data feed on this dashboard -- sidestepping
-- PostgREST's embedding behavior entirely. Frontend updated to match
-- (app/admin/page.tsx — the heldRent query and its render section).

create or replace function get_held_rent_payments()
returns json
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Not authorised: CHS admins only.';
  end if;
  return (
    select coalesce(json_agg(row_to_json(t) order by t.release_deadline asc), '[]'::json) from (
      select rp.id, rp.amount, rp.release_deadline, rp.created_at,
        p.title as property_title, landlord.full_name as landlord_name
      from rent_payments rp
      join tenancies tn on tn.id = rp.tenancy_id
      join properties p on p.id = tn.property_id
      join profiles landlord on landlord.id = tn.landlord_id
      where rp.released_at is null
    ) t
  );
end;
$$;

revoke all on function get_held_rent_payments() from public, anon;
grant execute on function get_held_rent_payments() to authenticated, service_role;
