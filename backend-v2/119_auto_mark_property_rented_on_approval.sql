-- Real, genuine gap found through direct client testing: approving a
-- rental application created a real tenancy but never updated the
-- property's own status — meaning a genuinely occupied property kept
-- showing as available to other prospective tenants indefinitely,
-- with no automatic correction. Matches exactly the same principle
-- already proven for a Sale (payment automatically marks a property
-- sold) — occupancy should mark a property rented with the same
-- automatic certainty, never left as a manual step for anyone.

create or replace function approve_rental_application(p_application_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_property_id uuid;
  v_tenant_id uuid;
  v_owner_id uuid;
  v_annual_rent numeric;
  v_move_in date;
  v_new_tenancy_id uuid;
  v_tenant_pct numeric;
  v_landlord_pct numeric;
begin
  select property_id, tenant_id, move_in_date into v_property_id, v_tenant_id, v_move_in from rental_applications where id = p_application_id;
  select owner_id, price into v_owner_id, v_annual_rent from properties where id = v_property_id;

  if v_owner_id != auth.uid() and not is_admin() then
    raise exception 'Only the property owner can approve this application.';
  end if;

  update rental_applications set status = 'approved' where id = p_application_id;

  insert into tenancies (property_id, tenant_id, landlord_id, lease_start, lease_end, annual_rent, status)
  values (v_property_id, v_tenant_id, v_owner_id, coalesce(v_move_in, current_date), coalesce(v_move_in, current_date) + interval '1 year', v_annual_rent, 'active')
  returning id into v_new_tenancy_id;

  update properties set status = 'rented' where id = v_property_id;

  select value::numeric into v_tenant_pct from platform_settings where key = 'rental_commission_tenant_percentage';
  select value::numeric into v_landlord_pct from platform_settings where key = 'rental_commission_landlord_percentage';

  insert into transaction_commissions (transaction_type, tenancy_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount)
  values
    ('rental', v_new_tenancy_id, v_property_id, v_tenant_id, 'tenant', v_annual_rent, v_tenant_pct, round(v_annual_rent * v_tenant_pct / 100, 2)),
    ('rental', v_new_tenancy_id, v_property_id, v_owner_id, 'landlord', v_annual_rent, v_landlord_pct, round(v_annual_rent * v_landlord_pct / 100, 2))
  on conflict do nothing;

  perform notify_user(v_tenant_id, '🏠 Your rental application was approved!',
    'A real ' || v_tenant_pct || '% commission (' || round(v_annual_rent * v_tenant_pct / 100, 2) || ') is due — please settle it from your CHS wallet.');
  perform notify_user(v_owner_id, '💰 Rental commission invoice generated',
    'A real ' || v_landlord_pct || '% commission (' || round(v_annual_rent * v_landlord_pct / 100, 2) || ') is due on this new tenancy.');

  return v_new_tenancy_id;
end;
$$;
