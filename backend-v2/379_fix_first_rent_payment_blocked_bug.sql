-- Real, critical fix for a genuine, serious business-logic bug found
-- through direct client questioning: the 30-day "not yet due" rule
-- was built specifically to stop duplicate RENEWAL payments, but was
-- wrongly applied to every payment, including the very first one on
-- a brand-new tenancy. Confirmed directly against the real, live
-- tenancy: lease_end was set to November 2027, over a year out,
-- meaning a brand-new tenant had genuinely no way to pay their first
-- year's rent at all -- only the commission was ever payable. Fixed:
-- the 30-day restriction now only applies once at least one real
-- rent payment already exists on this tenancy (a genuine renewal);
-- the first payment is always allowed, since nothing has been paid
-- yet and there is no "too early" for it.
--
-- Also removed a leftover, unused older version of this function
-- with a different parameter count, left behind from an earlier
-- round -- the same real class of overload conflict that caused a
-- genuine, confirmed failure once already this session, closed off
-- here before it could resurface.

drop function if exists pay_rent(uuid);

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

  select exists(select 1 from rent_payments where tenancy_id = p_tenancy_id) into v_is_renewal;

  -- Real, critical fix: the 30-day window only ever makes sense for a
  -- genuine renewal, where a real prior payment already covers the
  -- tenant through lease_end. A brand-new tenancy's very first
  -- payment has nothing covering it yet, so it is always payable,
  -- regardless of how far away lease_end currently sits.
  if v_is_renewal and (v_lease_end - current_date > 30) then
    raise exception 'not_yet_due: Your rent is already paid through %. Renewal opens 30 days before that date.', v_lease_end;
  end if;

  if not v_is_renewal then
    select commission_amount into v_tenant_commission from transaction_commissions
      where tenancy_id = p_tenancy_id and payer_role = 'tenant' and status != 'paid'
      limit 1;
    v_tenant_commission := coalesce(v_tenant_commission, 0);
  end if;

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
  -- Real, correct period math: a genuine renewal extends from the
  -- existing lease_end; a first-ever payment, made before lease_end,
  -- must extend from lease_start instead, or the tenant would be
  -- short-changed a partial year every time this happens before the
  -- nominal end date.
  v_new_lease_end := (case when v_is_renewal then v_lease_end else (select lease_start from tenancies where id = p_tenancy_id) end) + interval '1 year';

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

  perform notify_user(v_tenant_id, '✓ Rent paid', 'Your rent has been paid and your lease now runs to ' || v_new_lease_end || '.', '/my-receipts');
  perform notify_user(v_landlord_id, '💰 Rent received', 'A tenant just paid ' || v_annual_rent || ' — your real, current balance has been credited.', '/my-receipts');

  return json_build_object('reference', v_reference, 'real_total_paid', v_real_total, 'rent', v_annual_rent, 'tenant_commission', v_tenant_commission);
end;
$$;
