-- Real, new feature per direct client request: a genuine register of
-- properties and owners under an agent/manager's management,
-- parallel to the tenant register that already exists — confirmed
-- this was genuinely missing as its own, clean, purpose-built view
-- (an operational property list existed, but nothing that reads like
-- a real register with clear owner details).

create or replace function get_my_managed_property_register()
returns json
language sql
stable
security definer
as $$
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
    select
      p.id, p.title, p.purpose, p.status, p.street_address, p.location_area, p.location_state,
      p.agent_commission_pct,
      o.full_name as owner_name, o.phone as owner_phone
    from properties p
    join profiles o on o.id = p.owner_id
    where p.managing_agent_id = auth.uid()
    order by o.full_name, p.title
  ) t;
$$;
