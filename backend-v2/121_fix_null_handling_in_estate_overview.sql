-- Real bug caught while building demo data: SQL's three-valued logic
-- means "occupancy_type = 'owner_occupier'" evaluates to NULL (not
-- false) for a genuinely vacant unit where occupancy_type is NULL —
-- which silently excluded every real vacant unit from the
-- vacant_units count entirely, rather than counting it. Fixed with a
-- real null-safe comparison.

create or replace function get_estate_overview(p_estate_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_manager_id uuid;
  v_result json;
begin
  select manager_id into v_manager_id from estates where id = p_estate_id;
  if v_manager_id != auth.uid() and not is_admin() then
    raise exception 'You do not manage this estate.';
  end if;

  select json_build_object(
    'total_units', (select count(*) from properties where estate_id = p_estate_id),
    'occupied_units', (
      select count(*) from properties p where p.estate_id = p_estate_id and (
        exists (select 1 from tenancies t where t.property_id = p.id and t.status = 'active')
        or p.occupancy_type is not distinct from 'owner_occupier'
      )
    ),
    'vacant_units', (
      select count(*) from properties p where p.estate_id = p_estate_id and not (
        exists (select 1 from tenancies t where t.property_id = p.id and t.status = 'active')
        or p.occupancy_type is not distinct from 'owner_occupier'
      )
    ),
    'owner_occupied_units', (select count(*) from properties where estate_id = p_estate_id and occupancy_type is not distinct from 'owner_occupier'),
    'pending_disputes', (select count(*) from disputes d join tenancies t on t.id = d.tenancy_id join properties p on p.id = t.property_id where p.estate_id = p_estate_id and d.status = 'open'),
    'pending_maintenance', (
      select count(*) from fault_reports fr join properties p on p.id = fr.property_id
      where p.estate_id = p_estate_id and fr.status != 'resolved'
    ),
    'service_charges_pending', (select count(*) from service_charges where estate_id = p_estate_id and status = 'pending'),
    'service_charges_overdue', (select count(*) from service_charges where estate_id = p_estate_id and status = 'pending' and due_date < current_date),
    'total_collected_this_month', (select coalesce(sum(amount), 0) from service_charges where estate_id = p_estate_id and status = 'paid' and paid_at >= date_trunc('month', now()))
  ) into v_result;

  return v_result;
end;
$$;
