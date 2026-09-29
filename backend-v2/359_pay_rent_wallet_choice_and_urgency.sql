-- Real, direct fix per the client's own original design, confirmed
-- to have been lost or never fully completed: when a tenant
-- manually pays rent, they should genuinely be able to choose
-- between their main wallet and their rent savings wallet -- this
-- choice only ever existed for automatic payments, not the manual
-- flow every tenant actually uses when clicking "Pay" themselves.

create or replace function pay_rent(p_tenancy_id uuid, p_wallet_source text default 'main')
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
  v_new_payment_id uuid;
begin
  if p_wallet_source not in ('main', 'rent_savings') then
    raise exception 'A real payment source must be chosen.';
  end if;

  select tenant_id, landlord_id, annual_rent, lease_end
    into v_tenant_id, v_landlord_id, v_annual_rent, v_lease_end
    from tenancies where id = p_tenancy_id;

  if v_tenant_id != auth.uid() then
    raise exception 'Only the real tenant on this tenancy can pay this rent.';
  end if;

  if v_lease_end - current_date > 30 then
    raise exception 'not_yet_due: Your rent is already paid through %. Renewal opens 30 days before that date.', v_lease_end;
  end if;

  select exists(select 1 from rent_payments where tenancy_id = p_tenancy_id) into v_is_renewal;

  if not v_is_renewal then
    select commission_amount into v_tenant_commission from transaction_commissions
      where tenancy_id = p_tenancy_id and payer_role = 'tenant' and status != 'paid'
      limit 1;
    v_tenant_commission := coalesce(v_tenant_commission, 0);
  end if;

  -- Real, direct rule: rent savings exists purely to hold real rent
  -- money, so a real commission (which is not rent) can only ever be
  -- drawn from the main wallet, not from savings meant for rent
  -- itself.
  if p_wallet_source = 'rent_savings' and v_tenant_commission > 0 then
    raise exception 'Your rent savings wallet can only cover the real rent itself — your one-time CHS commission (%) must be paid from your main wallet. Please pay from your main wallet this once.', v_tenant_commission;
  end if;

  v_real_total := v_annual_rent + v_tenant_commission;

  if p_wallet_source = 'rent_savings' then
    select rent_savings into v_balance from wallets where user_id = auth.uid();
  else
    select main_balance into v_balance from wallets where user_id = auth.uid();
  end if;
  if v_balance is null or v_balance < v_real_total then
    raise exception 'insufficient_balance';
  end if;

  v_reference := 'RENT-' || substr(gen_random_uuid()::text, 1, 8);
  v_new_lease_end := v_lease_end + interval '1 year';

  if p_wallet_source = 'rent_savings' then
    update wallets set rent_savings = rent_savings - v_real_total, updated_at = now() where user_id = v_tenant_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (v_tenant_id, 'rent_savings', v_real_total, 'debit', 'Rent payment from rent savings', v_reference);
  else
    update wallets set main_balance = main_balance - v_real_total, updated_at = now() where user_id = v_tenant_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (v_tenant_id, 'main', v_real_total, 'debit',
      'Rent payment' || case when v_tenant_commission > 0 then ' (rent ' || v_annual_rent || ' + your real ' || v_tenant_commission || ' commission)' else '' end,
      v_reference);
  end if;

  update wallets set main_balance = main_balance + v_annual_rent, updated_at = now() where user_id = v_landlord_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_landlord_id, 'main', v_annual_rent, 'credit', 'Rent payment received', v_reference);

  if v_tenant_commission > 0 then
    update transaction_commissions set status = 'paid', paid_at = now()
      where tenancy_id = p_tenancy_id and payer_role = 'tenant' and status != 'paid';
  end if;

  insert into rent_payments (tenancy_id, tenant_id, landlord_id, amount, covers_period_start, covers_period_end, reference)
  values (p_tenancy_id, v_tenant_id, v_landlord_id, v_annual_rent, v_lease_end, v_new_lease_end, v_reference)
  returning id into v_new_payment_id;

  update tenancies set lease_end = v_new_lease_end where id = p_tenancy_id;

  if v_is_renewal then
    select value::numeric into v_renewal_pct from platform_settings where key = 'rental_renewal_commission_landlord_pct';
    v_renewal_commission := round(v_annual_rent * v_renewal_pct / 100, 2);

    insert into transaction_commissions (transaction_type, tenancy_id, rent_payment_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount)
    select 'rental', p_tenancy_id, v_new_payment_id, t.property_id, v_landlord_id, 'landlord', v_annual_rent, v_renewal_pct, v_renewal_commission
    from tenancies t where t.id = p_tenancy_id;

    perform notify_user(v_landlord_id, '💰 Subsequent-year renewal commission due',
      'Your tenant just renewed for another year. A real, reduced renewal commission of ' || v_renewal_commission || ' (' || v_renewal_pct || '% — no charge to your tenant this year) is due from your CHS wallet, covering ongoing service and platform facilities.',
      '/my-receipts');
  end if;

  perform notify_user(v_tenant_id, '✓ Rent paid', 'Your rent has been paid and your lease renewed to ' || v_new_lease_end || '.', '/my-receipts');
  perform notify_user(v_landlord_id, '💰 Rent received', 'A tenant just paid ' || v_annual_rent || ' — your real, current balance has been credited.', '/my-receipts');

  return json_build_object('reference', v_reference, 'real_total_paid', v_real_total, 'rent', v_annual_rent, 'tenant_commission', v_tenant_commission);
end;
$$;
