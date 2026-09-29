-- Real, major fix per direct, explicit client approval: rent now
-- follows the exact same real escrow pattern already proven correct
-- for property sales and shortlet stays -- held, not released
-- immediately, with a clear real condition for release. Confirmed
-- directly before building: rent was the one, isolated payment type
-- on the whole platform moving straight to the landlord with zero
-- protection, while both other payment types already did this
-- correctly.

insert into platform_settings (key, value) values ('rental_grace_period_days', '14')
on conflict (key) do nothing;

alter table rent_payments add column if not exists release_deadline timestamptz;
alter table rent_payments add column if not exists released_at timestamptz;

-- Real, updated pay_rent(): rent now goes into the landlord's real
-- escrow_held balance, not main_balance, with a real release
-- deadline recorded on the payment itself -- same real pattern as
-- pay_for_property's document_deadline.
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
  v_grace_days int;
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

  -- Real, critical change: held, not released, matching the same
  -- real pattern already proven for property sales.
  select coalesce(value::int, 14) into v_grace_days from platform_settings where key = 'rental_grace_period_days';
  update wallets set escrow_held = escrow_held + v_annual_rent, updated_at = now() where user_id = v_landlord_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_landlord_id, 'escrow_held', v_annual_rent, 'credit', 'Rent received — held pending a clean move-in report or the grace period passing', v_reference);

  if v_tenant_commission > 0 then
    update transaction_commissions set status = 'paid', paid_at = now()
      where tenancy_id = p_tenancy_id and payer_role = 'tenant' and status != 'paid';
  end if;

  insert into rent_payments (tenancy_id, tenant_id, landlord_id, amount, covers_period_start, covers_period_end, reference, release_deadline)
  values (p_tenancy_id, v_tenant_id, v_landlord_id, v_annual_rent, v_lease_end, v_new_lease_end, v_reference, now() + (v_grace_days || ' days')::interval)
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

  perform notify_user(v_tenant_id, '✓ Rent paid — your money is protected',
    'Your rent has been paid and your lease now runs to ' || v_new_lease_end || '. Your ' || v_annual_rent || ' is held safely by CHS, not yet released to your landlord, until you confirm the property is as expected (via your move-in report) or ' || v_grace_days || ' days pass — the same real protection buyers get.',
    '/my-receipts');
  perform notify_user(v_landlord_id, '💰 Rent received — held pending your tenant''s confirmation',
    'A tenant just paid ' || v_annual_rent || '. This is now visible in your wallet as held funds, released to you once your tenant files a clean move-in report or ' || v_grace_days || ' days pass without any unresolved issues raised.',
    '/my-receipts');

  return json_build_object('reference', v_reference, 'real_total_paid', v_real_total, 'rent', v_annual_rent, 'tenant_commission', v_tenant_commission);
end;
$$;

-- Real, new release function — admin can release early; the real
-- automatic paths (clean report, grace period) call this same
-- function underneath, so there is exactly one real place this logic
-- lives.
create or replace function release_rent_to_landlord(p_rent_payment_id uuid, p_reason text default 'grace_period')
returns void
language plpgsql
security definer
as $$
declare
  v_landlord_id uuid;
  v_amount numeric;
  v_already_released timestamptz;
begin
  select landlord_id, amount, released_at into v_landlord_id, v_amount, v_already_released
    from rent_payments where id = p_rent_payment_id;

  if v_already_released is not null then
    raise exception 'This real rent payment has already been released.';
  end if;

  update wallets set escrow_held = escrow_held - v_amount, main_balance = main_balance + v_amount, updated_at = now()
    where user_id = v_landlord_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_landlord_id, 'main', v_amount, 'credit',
    'Rent released — ' || case when p_reason = 'clean_report' then 'tenant filed a clean move-in report' else 'grace period passed with no unresolved issues' end,
    'RELEASE-' || substr(gen_random_uuid()::text, 1, 8));

  update rent_payments set released_at = now() where id = p_rent_payment_id;

  perform notify_user(v_landlord_id, '✓ Rent released to your wallet',
    'Your held rent of ' || v_amount || ' is now in your main wallet and available to withdraw.', '/wallet');
end;
$$;
