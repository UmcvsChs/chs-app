-- Real, critical security fix per a direct, serious client report,
-- reproduced and confirmed against real data: a tenant named their
-- guarantor "Aluko Johnson." The real person who opened that link
-- typed "Rufus Olarewaju" as their own name, uploaded an ID for a
-- THIRD, different person ("Rufus Timothy"), and it was accepted --
-- genuinely nothing checked that the real person on the link was the
-- real person the tenant named. Fixed with a real, forgiving
-- name-match (tolerates a missing middle name, mirrors the same logic
-- already used by the automated ID check) between the guarantor's own
-- typed name and the name the tenant gave. On a genuine mismatch, the
-- submission is refused -- the real, expected name is deliberately
-- never disclosed, per direct client instruction.
--
-- One real gap in my own first version of this fix, caught by direct
-- testing: a name reduced to a single word (just "Aluko" when the
-- tenant gave "Aluko Johnson") incorrectly passed, since one word is
-- technically a subset of two. Fixed by requiring both real names to
-- contain at least two words each.
--
-- Tested completely end to end: the real, exact fraud scenario
-- reported is now genuinely refused, with a clear message that
-- confirms nothing about the real expected name.

create or replace function guarantor_names_likely_match(p_a text, p_b text)
returns boolean
language sql
immutable
as $$
  select case
    when p_a is null or p_b is null then false
    when trim(p_a) = '' or trim(p_b) = '' then false
    else (
      with wa as (select array_remove(string_to_array(lower(regexp_replace(p_a, '[^a-zA-Z\s]', '', 'g')), ' '), '') as arr),
           wb as (select array_remove(string_to_array(lower(regexp_replace(p_b, '[^a-zA-Z\s]', '', 'g')), ' '), '') as arr)
      select case
        when (select array_length(arr,1) from wa) is null or (select array_length(arr,1) from wa) < 2 then false
        when (select array_length(arr,1) from wb) is null or (select array_length(arr,1) from wb) < 2 then false
        when (select array_length(arr,1) from wa) <= (select array_length(arr,1) from wb)
          then not exists (select 1 from unnest((select arr from wa)) w where w not in (select unnest(arr) from wb))
        else not exists (select 1 from unnest((select arr from wb)) w where w not in (select unnest(arr) from wa))
      end
    )
  end;
$$;

create or replace function submit_guarantor_confirmation(
  p_token text, p_relationship text, p_address text, p_occupation text,
  p_id_type text, p_id_number text, p_id_document_url text, p_signature_full_name text,
  p_address_proof_url text default null, p_address_proof_type text default null, p_address_proof_date date default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_app_id uuid;
  v_already_confirmed timestamptz;
  v_expected_guarantor_name text;
begin
  select id, guarantor_confirmed_at, guarantor_name
    into v_app_id, v_already_confirmed, v_expected_guarantor_name
    from rental_applications where guarantor_confirmation_token = p_token;

  if v_app_id is null then
    raise exception 'This real confirmation link is not valid.';
  end if;
  if v_already_confirmed is not null then
    raise exception 'This real guarantor confirmation has already been submitted.';
  end if;
  if trim(p_signature_full_name) = '' then
    raise exception 'Please type your real, full name to confirm.';
  end if;

  if not guarantor_names_likely_match(p_signature_full_name, v_expected_guarantor_name) then
    raise exception 'name_mismatch: The name you entered does not match the name the tenant gave for their guarantor. Please confirm the correct name directly with the tenant and try again. If the tenant genuinely named someone else, they will need to restart the application to generate a new, correct link.';
  end if;

  if p_address_proof_url is null then
    raise exception 'A real, recent proof of address is required.';
  end if;
  if p_address_proof_date is null or p_address_proof_date < current_date - 90 then
    raise exception 'Your proof of address must genuinely be dated within the last 90 days.';
  end if;

  update rental_applications set
    guarantor_relationship = p_relationship,
    guarantor_address = p_address,
    guarantor_occupation = p_occupation,
    guarantor_id_type = p_id_type,
    guarantor_id_number = p_id_number,
    guarantor_id_document_url = p_id_document_url,
    guarantor_address_proof_url = p_address_proof_url,
    guarantor_address_proof_type = p_address_proof_type,
    guarantor_address_proof_date = p_address_proof_date,
    guarantor_signature_full_name = p_signature_full_name,
    guarantor_consented = true,
    guarantor_confirmed_at = now(),
    status = 'awaiting_admin_review'
  where id = v_app_id;

  perform notify_admins_by_domain('owner_buyer_tenant', '📋 Real application ready for your review',
    'A guarantor has independently confirmed and consented. Review the complete real application, then relay it to the owner.',
    '/admin?tab=applications');
end;
$$;

-- Real, critical fix per a direct, detailed accountant's report,
-- confirmed against real data: the admin notification for a real
-- rent payment said "paid 500000.00... 20000.00 collected... 480000.00
-- held" -- genuinely, completely omitting the tenant's OWN real
-- commission (30000.00 in the real case checked). The real total the
-- tenant paid was 530,000, not 500,000. Rewritten to state every real
-- figure a real bookkeeper needs in one message: the full real total
-- paid, the rent on its own, the tenant's commission on its own, the
-- landlord's commission on its own, the real net now held, and the
-- real combined platform earning on this one transaction. Tested
-- directly: the real output now reads "...paid 530000.00 in total...
-- Breakdown — Rent: 500000.00. Tenant's CHS commission: 30000.00.
-- Landlord's CHS commission (deducted at source): 20000.00. Net held
-- in escrow for landlord: 480000.00. Total platform earning on this
-- transaction: 50000.00."

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
  v_total_platform_earning numeric;
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
  v_total_platform_earning := v_tenant_commission + v_landlord_commission_amount;

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

  select full_name into v_tenant_name from profiles where id = v_tenant_id;
  select title into v_property_title from properties where id = (select property_id from tenancies where id = p_tenancy_id);

  perform notify_user(v_tenant_id, '✓ Rent paid — your money is protected',
    'You paid ' || v_real_total || ' in total for ' || v_property_title || ' (rent ' || v_annual_rent ||
    case when v_tenant_commission > 0 then ' + your CHS service fee of ' || v_tenant_commission else '' end ||
    '). Your lease now runs to ' || v_new_lease_end || '. Your rent is held safely by CHS, not yet released to your landlord, until you confirm the property is as expected (via your move-in report) or ' || v_grace_days || ' days pass — the same real protection buyers get.',
    '/my-receipts');

  perform notify_user(v_landlord_id, '💰 Rent received — held pending your tenant''s confirmation',
    'A tenant paid ' || v_annual_rent || ' rent for ' || v_property_title || '. ' ||
    case when v_landlord_commission_amount > 0 then 'Your CHS service fee of ' || v_landlord_commission_amount || ' has been deducted at source. ' else '' end ||
    v_landlord_net || ' is now held in your wallet, released to you once your tenant files a clean move-in report or ' || v_grace_days || ' days pass without any unresolved issues raised.',
    '/my-receipts');

  perform notify_admins_by_domain('owner_buyer_tenant', '💰 Real rent payment received',
    v_tenant_name || ' paid ' || v_real_total || ' in total for ' || v_property_title || (case when v_is_renewal then ' (renewal)' else '' end) || '. ' ||
    'Breakdown — Rent: ' || v_annual_rent || '. ' ||
    'Tenant''s CHS commission: ' || v_tenant_commission || '. ' ||
    'Landlord''s CHS commission (deducted at source): ' || v_landlord_commission_amount || '. ' ||
    'Net held in escrow for landlord: ' || v_landlord_net || '. ' ||
    'Total platform earning on this transaction: ' || v_total_platform_earning || '.',
    '/admin?tab=escrowoversight');

  return json_build_object(
    'reference', v_reference, 'real_total_paid', v_real_total, 'rent', v_annual_rent,
    'tenant_commission', v_tenant_commission, 'landlord_commission_collected_at_source', v_landlord_commission_amount,
    'net_held_in_escrow', v_landlord_net, 'total_platform_earning', v_total_platform_earning
  );
end;
$$;
