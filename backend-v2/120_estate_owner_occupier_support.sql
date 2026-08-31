-- Real, genuine gap identified from direct domain expertise: a real
-- Nigerian estate often has mixed occupancy — some units rented, but
-- others owned outright by the person living there (e.g. under a
-- government monetization scheme), with no ongoing rent at all.
-- The entire estate system previously only recognized occupancy
-- through an active rental tenancy — an owner-occupier's unit was
-- silently miscounted as vacant, never billed a service charge, and
-- had no real path to report a maintenance fault.

alter table properties add column if not exists occupant_id uuid references profiles(id);
alter table properties add column if not exists occupancy_type text check (occupancy_type in ('tenant', 'owner_occupier') or occupancy_type is null);

create or replace function set_unit_owner_occupier(p_property_id uuid, p_occupant_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_estate_id uuid;
  v_manager_id uuid;
begin
  select estate_id into v_estate_id from properties where id = p_property_id;
  select manager_id into v_manager_id from estates where id = v_estate_id;

  if v_manager_id != auth.uid() and not is_admin() then
    raise exception 'Only this estate''s real manager can set unit occupancy.';
  end if;

  update properties set occupant_id = p_occupant_id, occupancy_type = 'owner_occupier' where id = p_property_id;

  perform notify_user(p_occupant_id, '🏠 Welcome to your estate unit',
    'You''ve been registered as the real owner-occupier of your unit. You''ll receive real service charge bills and can report maintenance faults directly through CHS.');
end;
$$;

create or replace function bill_all_occupied_estate_units(p_estate_id uuid, p_amount numeric, p_description text, p_due_date date)
returns int
language plpgsql
security definer
as $$
declare
  v_manager_id uuid;
  v_billed int := 0;
  v_rec record;
begin
  select manager_id into v_manager_id from estates where id = p_estate_id;
  if v_manager_id != auth.uid() and not is_admin() then
    raise exception 'Only this estate''s real manager can bill service charges.';
  end if;

  for v_rec in
    select t.id as tenancy_id, t.tenant_id, t.property_id
    from tenancies t join properties p on p.id = t.property_id
    where p.estate_id = p_estate_id and t.status = 'active'
  loop
    insert into service_charges (estate_id, property_id, tenant_id, amount, description, due_date)
    values (p_estate_id, v_rec.property_id, v_rec.tenant_id, p_amount, p_description, p_due_date);
    v_billed := v_billed + 1;
  end loop;

  for v_rec in
    select id as property_id, occupant_id
    from properties
    where estate_id = p_estate_id and occupancy_type = 'owner_occupier'
  loop
    insert into service_charges (estate_id, property_id, tenant_id, amount, description, due_date)
    values (p_estate_id, v_rec.property_id, v_rec.occupant_id, p_amount, p_description, p_due_date);
    v_billed := v_billed + 1;
  end loop;

  return v_billed;
end;
$$;

drop policy if exists "fault_reports_owner_occupier" on fault_reports;
create policy "fault_reports_owner_occupier" on fault_reports for all using (
  exists (select 1 from properties p where p.id = property_id and p.occupant_id = auth.uid() and p.occupancy_type = 'owner_occupier')
);
