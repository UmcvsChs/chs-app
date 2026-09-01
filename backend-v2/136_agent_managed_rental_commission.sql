-- Real, new feature — the rental equivalent of the agent-managed sale
-- commission model. Mirrors the same real principle: the client pays
-- only the agent's own real market rate (charged as the classic
-- Nigerian "agency fee," to the incoming tenant), the landlord is
-- never charged CHS's standard commission in this model, and CHS
-- takes its real, capped 3% cut only from the agent's own earnings.

create or replace function approve_rental_application_agent_managed(p_application_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_property_id uuid;
  v_tenant_id uuid;
  v_owner_id uuid;
  v_agent_id uuid;
  v_annual_rent numeric;
  v_move_in date;
  v_new_tenancy_id uuid;
  v_agent_pct numeric;
  v_chs_fee_pct numeric;
  v_agent_commission numeric;
  v_chs_fee_amount numeric;
  v_agent_net numeric;
begin
  select property_id, tenant_id, move_in_date into v_property_id, v_tenant_id, v_move_in from rental_applications where id = p_application_id;
  select owner_id, price, managing_agent_id, agent_commission_pct into v_owner_id, v_annual_rent, v_agent_id, v_agent_pct from properties where id = v_property_id;

  if v_agent_id != auth.uid() and v_owner_id != auth.uid() and not is_admin() then
    raise exception 'Only the real property owner or managing agent can approve this application.';
  end if;
  if v_agent_pct is null then
    raise exception 'This property has no real agent commission rate set — use the standard approval instead.';
  end if;

  update rental_applications set status = 'approved' where id = p_application_id;

  insert into tenancies (property_id, tenant_id, landlord_id, manager_id, lease_start, lease_end, annual_rent, status)
  values (v_property_id, v_tenant_id, v_owner_id, v_agent_id, coalesce(v_move_in, current_date), coalesce(v_move_in, current_date) + interval '1 year', v_annual_rent, 'active')
  returning id into v_new_tenancy_id;

  update properties set status = 'rented' where id = v_property_id;

  select value::numeric into v_chs_fee_pct from platform_settings where key = 'agent_platform_fee_pct';
  v_agent_commission := round(v_annual_rent * v_agent_pct / 100, 2);
  v_chs_fee_amount := round(v_agent_commission * v_chs_fee_pct / 100, 2);
  v_agent_net := v_agent_commission - v_chs_fee_amount;

  insert into transaction_commissions (transaction_type, tenancy_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount)
  values ('agent_managed_rental', v_new_tenancy_id, v_property_id, v_tenant_id, 'tenant', v_annual_rent, v_agent_pct, v_agent_commission);

  perform notify_user(v_tenant_id, '🏠 Your rental application was approved!',
    'A real agency fee of ' || v_agent_commission || ' (' || v_agent_pct || '% of the annual rent) is due — please settle it from your CHS wallet.');
  perform notify_user(v_owner_id, '✓ New tenancy started',
    'A new tenant has been approved for your property, arranged through your real managing agent. No CHS commission is charged to you in this arrangement.');

  return v_new_tenancy_id;
end;
$$;

alter table transaction_commissions drop constraint if exists transaction_commissions_transaction_type_check;
alter table transaction_commissions add constraint transaction_commissions_transaction_type_check
  check (transaction_type = ANY (ARRAY['sale', 'rental', 'shortlet', 'hire', 'rent_to_own', 'agent_managed_sale', 'agent_managed_rental']));
