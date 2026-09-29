create or replace function pay_rent(p_tenancy_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_landlord_id uuid;
  v_annual_rent numeric;
  v_lease_end date;
  v_balance numeric;
  v_reference text;
  v_new_lease_end date;
  v_is_renewal boolean;
  v_renewal_pct numeric;
  v_renewal_commission numeric;
  v_tenant_commission numeric := 0;
  v_real_total numeric;
begin
  select tenant_id, landlord_id, annual_rent, lease_end
    into v_tenant_id, v_landlord_id, v_annual_rent, v_lease_end
    from tenancies where id = p_tenancy_id;

  if v_tenant_id != auth.uid() then
    raise exception 'Only the real tenant on this tenancy can pay this rent.';
  end if;

  select exists(select 1 from rent_payments where tenancy_id = p_tenancy_id) into v_is_renewal;

  if not v_is_renewal then
    select commission_amount into v_tenant_commission from transaction_commissions
      where tenancy_id = p_tenancy_id and payer_role = 'tenant' and status != 'paid'
      limit 1;
    v_tenant_commission := coalesce(v_tenant_commission, 0);
  end if;

  v_real_total := v_annual_rent + v_tenant_commission;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_real_total then
    raise exception 'insufficient_balance';
  end if;

  v_reference := 'RENT-' || substr(gen_random_uuid()::text, 1, 8);
  v_new_lease_end := v_lease_end + interval '1 year';

  update wallets set main_balance = main_balance - v_real_total, updated_at = now() where user_id = v_tenant_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_tenant_id, 'main', v_real_total, 'debit',
    'Rent payment' || case when v_tenant_commission > 0 then ' (rent ' || v_annual_rent || ' + your real ' || v_tenant_commission || ' commission)' else '' end,
    v_reference);

  update wallets set main_balance = main_balance + v_annual_rent, updated_at = now() where user_id = v_landlord_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_landlord_id, 'main', v_annual_rent, 'credit', 'Rent payment received', v_reference);

  if v_tenant_commission > 0 then
    update transaction_commissions set status = 'paid', paid_at = now()
      where tenancy_id = p_tenancy_id and payer_role = 'tenant' and status != 'paid';
  end if;

  insert into rent_payments (tenancy_id, tenant_id, landlord_id, amount, covers_period_start, covers_period_end, reference)
  values (p_tenancy_id, v_tenant_id, v_landlord_id, v_annual_rent, v_lease_end, v_new_lease_end, v_reference);

  update tenancies set lease_end = v_new_lease_end where id = p_tenancy_id;

  if v_is_renewal then
    select value::numeric into v_renewal_pct from platform_settings where key = 'rental_renewal_commission_landlord_pct';
    v_renewal_commission := round(v_annual_rent * v_renewal_pct / 100, 2);

    insert into transaction_commissions (transaction_type, tenancy_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount)
    select 'rental', p_tenancy_id, t.property_id, v_landlord_id, 'landlord', v_annual_rent, v_renewal_pct, v_renewal_commission
    from tenancies t where t.id = p_tenancy_id;

    perform notify_user(v_landlord_id, '💰 Subsequent-year renewal commission due',
      'Your tenant just renewed for another year. A real, reduced renewal commission of ' || v_renewal_commission || ' (' || v_renewal_pct || '% — no charge to your tenant this year) is due from your CHS wallet, covering ongoing service and platform facilities.',
      '/my-receipts');
  end if;

  -- Real, direct fix per a direct client report: this notification had
  -- no link at all, so clicking it genuinely did nothing.
  perform notify_user(v_tenant_id, '✓ Rent paid', 'Your rent has been paid and your lease renewed to ' || v_new_lease_end || '.', '/my-receipts');
  perform notify_user(v_landlord_id, '💰 Rent received', 'A tenant just paid ' || v_annual_rent || ' — your real, current balance has been credited.', '/my-receipts');

  return json_build_object('reference', v_reference, 'real_total_paid', v_real_total, 'rent', v_annual_rent, 'tenant_commission', v_tenant_commission);
end;
$$;
