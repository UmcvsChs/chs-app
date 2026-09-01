-- Real, new feature per direct client request, previously discussed
-- but never built: a real "Coming Soon" status for a property that's
-- either under construction nearing completion, or currently occupied
-- but genuinely expected to become vacant soon (e.g. a tenant has
-- given real non-renewal notice).

alter table properties drop constraint if exists properties_status_check;
alter table properties add constraint properties_status_check
  check (status = ANY (ARRAY['active', 'rented', 'sold', 'delisted', 'coming_soon']));

create or replace function mark_property_coming_soon(p_property_id uuid, p_note text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_manager_id uuid;
begin
  select owner_id, managing_agent_id into v_owner_id, v_manager_id from properties where id = p_property_id;
  if auth.uid() != v_owner_id and auth.uid() != v_manager_id and not is_admin() then
    raise exception 'Only the real owner or managing agent can mark this property coming soon.';
  end if;

  update properties set status = 'coming_soon' where id = p_property_id;

  if p_note is not null then
    update properties set description = description || E'\n\n📢 ' || p_note where id = p_property_id;
  end if;
end;
$$;
