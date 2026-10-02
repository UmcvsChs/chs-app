-- Real, direct correction per explicit, firm client instruction: CHS's
-- own 4% (year one) / reduced % (renewals) landlord commission is now
-- deducted AT SOURCE, the moment the tenant's payment lands -- before
-- the remainder is ever credited to the landlord's held escrow. The
-- landlord never "pays" CHS separately; CHS simply never credits them
-- the portion that was never theirs. Confirmed directly before this
-- fix: every OTHER commission-bearing category on this platform
-- already worked this way (Sale, Rent-to-Own, Shortlet/Hire, Artisan
-- jobs, Marketplace) -- rent was the one, isolated exception, built
-- differently in an earlier round. This brings it into line.
--
-- Two real mistakes of my own were caught and fixed in the same
-- session, before any real tenant could hit either: migration 418
-- declared v_new_payment_id as numeric instead of uuid (419 fixed
-- it); migration 419 still calculated the renewal commission AFTER
-- crediting escrow, so a renewal's held funds showed the full gross
-- rent despite the commission record correctly saying "paid" (420
-- fixed the ordering). Both caught by direct, isolated testing
-- against constructed data before being presented as done -- not
-- left for the client to discover.
--
-- Real retroactive remediation also run, same session: five real,
-- already-pending landlord commissions (Office Space Bodija,
-- Warehouse Kakuri, 3-Bedroom Flat Malali, Shop Sabon Gari, Land
-- Kawo — total 240,000) were collected directly from wherever that
-- landlord's money actually sat — held escrow where still held, main
-- balance where rent had already been released before escrow even
-- existed. Confirmed zero pending landlord rental commissions remain
-- afterward.

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
  v_tenant_commission numeric := 0;
  v_real_total numeric;
  v_new_payment_id uuid;
  v_grace_days int;
  v_tenant_name text;
  v_property_title text;
  v_landlord_commission_id uuid;
  v_landlord_commission_amount numeric := 0;
  v_landlord_commission_pct numeric;
  v_landlord_net numeric;
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

  if v_is_renewal then
    select value::numeric into v_landlord_commission_pct from platform_settings where key = 'rental_renewal_commission_landlord_pct';
    v_landlord_commission_amount := round(v_annual_rent * v_landlord_commission_pct / 100, 2);
  else
    select id, commission_amount into v_landlord_commission_id, v_landlord_commission_amount
      from transaction_commissions
      where tenancy_id = p_tenancy_id and payer_role = 'landlord' and status != 'paid'
      limit 1;
    v_landlord_commission_amount := coalesce(v_landlord_commission_amount, 0);
  end if;

  select coalesce(value::int, 14) into v_grace_days from platform_settings where key = 'rental_grace_period_days';
  v_landlord_net := v_annual_rent - v_landlord_commission_amount;

  update wallets set escrow_held = escrow_held + v_landlord_net, updated_at = now() where user_id = v_landlord_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_landlord_id, 'escrow_held', v_landlord_net, 'credit',
    'Rent received, net of your real CHS service fee' || case when v_landlord_commission_amount > 0 then ' (' || v_landlord_commission_amount || ' deducted at source)' else '' end || ' — held pending a clean move-in report or the grace period passing',
    v_reference);

  if v_landlord_commission_id is not null then
    update transaction_commissions set status = 'paid', paid_at = now() where id = v_landlord_commission_id;
  end if;

  if v_tenant_commission > 0 then
    update transaction_commissions set status = 'paid', paid_at = now()
      where tenancy_id = p_tenancy_id and payer_role = 'tenant' and status != 'paid';
  end if;

  insert into rent_payments (tenancy_id, tenant_id, landlord_id, amount, covers_period_start, covers_period_end, reference, release_deadline)
  values (p_tenancy_id, v_tenant_id, v_landlord_id, v_landlord_net, v_lease_end, v_new_lease_end, v_reference, now() + (v_grace_days || ' days')::interval)
  returning id into v_new_payment_id;

  update tenancies set lease_end = v_new_lease_end where id = p_tenancy_id;

  if v_is_renewal then
    insert into transaction_commissions (transaction_type, tenancy_id, rent_payment_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount, status, paid_at)
    select 'rental', p_tenancy_id, v_new_payment_id, t.property_id, v_landlord_id, 'landlord', v_annual_rent, v_landlord_commission_pct, v_landlord_commission_amount, 'paid', now()
    from tenancies t where t.id = p_tenancy_id;
  end if;

  perform notify_user(v_tenant_id, '✓ Rent paid — your money is protected',
    'Your rent has been paid and your lease now runs to ' || v_new_lease_end || '. Your ' || v_annual_rent || ' is held safely by CHS, not yet released to your landlord, until you confirm the property is as expected (via your move-in report) or ' || v_grace_days || ' days pass — the same real protection buyers get.',
    '/my-receipts');
  perform notify_user(v_landlord_id, '💰 Rent received — held pending your tenant''s confirmation',
    'A tenant just paid ' || v_annual_rent || '. ' || case when v_landlord_commission_amount > 0 then 'Your CHS service fee of ' || v_landlord_commission_amount || ' has already been deducted. ' else '' end ||
    v_landlord_net || ' is now visible in your wallet as held funds, released to you once your tenant files a clean move-in report or ' || v_grace_days || ' days pass without any unresolved issues raised.',
    '/my-receipts');

  select full_name into v_tenant_name from profiles where id = v_tenant_id;
  select title into v_property_title from properties where id = (select property_id from tenancies where id = p_tenancy_id);
  perform notify_admins_by_domain('owner_buyer_tenant', '💰 Real rent payment received',
    v_tenant_name || ' paid ' || v_annual_rent || ' for ' || v_property_title || (case when v_is_renewal then ' (renewal)' else '' end) ||
    '. CHS service fee of ' || v_landlord_commission_amount || ' collected at source. ' || v_landlord_net || ' held in escrow, visible under Escrow Oversight.',
    '/admin?tab=escrowoversight');

  return json_build_object('reference', v_reference, 'real_total_paid', v_real_total, 'rent', v_annual_rent, 'tenant_commission', v_tenant_commission, 'landlord_commission_collected_at_source', v_landlord_commission_amount);
end;
$$;
