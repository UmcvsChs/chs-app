-- Real, new feature per direct client request: agents manage far more
-- individual, scattered properties than estate managers manage
-- estates, and deserve the same real tools — a portfolio view, direct
-- tenant messaging, and formal notices — without needing a formal
-- "estate" container, since their real properties span different
-- owners and locations.

create or replace function get_agent_managed_portfolio(p_agent_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  if p_agent_id != auth.uid() and not is_admin() then
    raise exception 'You can only view your own real managed portfolio.';
  end if;

  select json_build_object(
    'total_managed_properties', (select count(*) from properties where managing_agent_id = p_agent_id),
    'occupied_units', (
      select count(*) from properties p where p.managing_agent_id = p_agent_id and (
        exists (select 1 from tenancies t where t.property_id = p.id and t.status = 'active')
        or p.occupancy_type is not distinct from 'owner_occupier'
      )
    ),
    'vacant_units', (
      select count(*) from properties p where p.managing_agent_id = p_agent_id and not (
        exists (select 1 from tenancies t where t.property_id = p.id and t.status = 'active')
        or p.occupancy_type is not distinct from 'owner_occupier'
      )
    ),
    'pending_maintenance', (
      select count(*) from fault_reports fr join properties p on p.id = fr.property_id
      where p.managing_agent_id = p_agent_id and fr.status != 'resolved'
    ),
    'pending_disputes', (
      select count(*) from disputes d join tenancies t on t.id = d.tenancy_id join properties p on p.id = t.property_id
      where p.managing_agent_id = p_agent_id and d.status = 'open'
    ),
    'total_collected_this_month', (
      select coalesce(sum(wt.amount), 0) from wallet_transactions wt
      where wt.user_id = p_agent_id and wt.direction = 'credit'
      and wt.created_at >= date_trunc('month', now())
    )
  ) into v_result;

  return v_result;
end;
$$;
