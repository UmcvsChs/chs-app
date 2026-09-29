-- Real, genuinely missing feature found and built per direct client
-- report: a tenant had no real way to report a fault at all. The only
-- real fault_reports insert anywhere in the app was manager-initiated
-- planned maintenance -- confirmed by directly searching every real
-- frontend file. Built properly: a real tenant submission, correctly
-- routed to whichever of the owner or delegated manager is genuinely
-- responsible, with a real, working notification link.

create sequence if not exists fault_ticket_seq start 1;

create or replace function report_fault(
  p_tenancy_id uuid, p_category text, p_urgency text, p_location text, p_description text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_property_id uuid;
  v_responsible_id uuid;
  v_property_title text;
  v_new_id uuid;
  v_ticket text;
begin
  select property_id, (case when management_delegated then manager_id else landlord_id end)
    into v_property_id, v_responsible_id
    from tenancies where id = p_tenancy_id and tenant_id = auth.uid();

  if v_property_id is null then
    raise exception 'You are not the real tenant on this tenancy.';
  end if;

  select title into v_property_title from properties where id = v_property_id;
  v_ticket := 'FLT-' || lpad(nextval('fault_ticket_seq')::text, 6, '0');

  insert into fault_reports (ticket_number, tenancy_id, property_id, category, urgency, location_in_property, description, status)
  values (v_ticket, p_tenancy_id, v_property_id, p_category, p_urgency, p_location, p_description, 'reported')
  returning id into v_new_id;

  perform notify_user(v_responsible_id, '🔧 A real fault has been reported',
    'Ref ' || v_ticket || ' — ' || v_property_title || ': ' || p_description,
    '/owner');

  return v_new_id;
end;
$$;
