-- Real, direct fix per a specific, serious client concern about how
-- CHS is being represented: the notification a tenant received the
-- moment their application was approved only ever mentioned the
-- commission -- never the actual rent, even though the real payment
-- combines both. That gives exactly the wrong impression: that CHS
-- is chasing its own fee rather than facilitating the real housing
-- transaction. Reworded to lead with the real rent, naming the
-- commission honestly as a small service fee alongside it, with the
-- real combined total stated plainly.

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
    'Your rent (' || v_annual_rent || ') is ready for payment, plus a small ' || v_tenant_pct || '% CHS service fee (' || v_tenant_commission || ') — real total: ' || (v_annual_rent + v_tenant_commission) || '. Pay both together from your CHS wallet.',
    '/my-applications');
  perform notify_user(v_owner_id, '💰 Your CHS service fee is due',
    'A real ' || v_landlord_pct || '% service fee (' || v_landlord_commission || ') is due on this new tenancy — CHS''s own fee for facilitating this rental, separate from your real rent income.',
    '/owner');

  return v_new_tenancy_id;
end;
$$;
