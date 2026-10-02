-- Real, direct fix per a direct, firm client instruction: the tenant
-- notification describing their real CHS service fee called it "a
-- small" fee -- language that reads as dismissive of a real charge a
-- real tenant is being asked to pay. A percentage that feels small to
-- one person can be a real, meaningful amount to another. Reworded to
-- state the fee as a plain, professional fact, with no diminishing
-- language anywhere in it.

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
  v_tenant_commission numeric;
  v_landlord_commission numeric;
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
  v_tenant_commission := round(v_annual_rent * v_tenant_pct / 100, 2);
  v_landlord_commission := round(v_annual_rent * v_landlord_pct / 100, 2);

  insert into transaction_commissions (transaction_type, tenancy_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount)
  values
    ('rental', v_new_tenancy_id, v_property_id, v_tenant_id, 'tenant', v_annual_rent, v_tenant_pct, v_tenant_commission),
    ('rental', v_new_tenancy_id, v_property_id, v_owner_id, 'landlord', v_annual_rent, v_landlord_pct, v_landlord_commission)
  on conflict do nothing;

  perform notify_user(v_tenant_id, '🏠 Your rental application was approved!',
    'Your rent is ' || v_annual_rent || '. A ' || v_tenant_pct || '% CHS service fee of ' || v_tenant_commission || ' also applies, for a combined total of ' || (v_annual_rent + v_tenant_commission) || ', payable together from your CHS wallet.',
    '/my-applications');
  perform notify_user(v_owner_id, '💰 Your CHS service fee is due',
    'A ' || v_landlord_pct || '% CHS service fee of ' || v_landlord_commission || ' is due on this new tenancy — CHS''s fee for facilitating this rental, separate from your rent income.',
    '/owner');

  return v_new_tenancy_id;
end;
$$;
