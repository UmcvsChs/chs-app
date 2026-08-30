-- Real, sourced distinction: Building Plan Approval only genuinely
-- applies when there's an actual structure on the property — raw
-- land or farmland has no building to have been approved. Made a
-- real, conditional requirement rather than either always-required
-- (wrong for land) or never-required (wrong for a house or duplex).

create or replace function get_required_sale_documents(p_property_id uuid default null)
returns text[]
language plpgsql
stable
as $$
declare
  v_property_type text;
  v_base text[];
begin
  v_base := array['certificate_of_occupancy', 'deed_of_assignment', 'survey_plan', 'governors_consent', 'tax_clearance_certificate', 'sale_agreement'];

  if p_property_id is not null then
    select property_type into v_property_type from properties where id = p_property_id;
    if v_property_type is not null and lower(v_property_type) not like '%land%' and lower(v_property_type) not like '%farmland%' then
      v_base := array_append(v_base, 'building_plan_approval');
    end if;
  end if;

  return v_base;
end;
$$;

create or replace function are_sale_documents_verified(p_property_id uuid)
returns boolean
language sql
stable
as $$
  select (
    select count(*) from property_sale_documents
    where property_id = p_property_id
      and document_type = any(get_required_sale_documents(p_property_id))
      and verification_status = 'verified'
  ) >= array_length(get_required_sale_documents(p_property_id), 1);
$$;
