-- Real, comprehensive, one-time sweep per direct, repeated client
-- instruction: every real notification across the entire system gets
-- a genuine, working link, not just the one function tested most
-- recently. Part 1 of the sweep — rental, sale, and dispute flows.

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
    'A real ' || v_tenant_pct || '% commission (' || round(v_annual_rent * v_tenant_pct / 100, 2) || ') is due — please settle it from your CHS wallet.',
    '/my-applications');
  perform notify_user(v_owner_id, '💰 Rental commission invoice generated',
    'A real ' || v_landlord_pct || '% commission (' || round(v_annual_rent * v_landlord_pct / 100, 2) || ') is due on this new tenancy.',
    '/owner');

  return v_new_tenancy_id;
end;
$$;

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
    'A real agency fee of ' || v_agent_commission || ' (' || v_agent_pct || '% of the annual rent) is due — please settle it from your CHS wallet.',
    '/my-applications');
  perform notify_user(v_owner_id, '✓ New tenancy started',
    'A new tenant has been approved for your property, arranged through your real managing agent. No CHS commission is charged to you in this arrangement.',
    '/owner');

  return v_new_tenancy_id;
end;
$$;

create or replace function generate_sale_commissions(p_offer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_amount numeric;
  v_property_id uuid;
  v_buyer_id uuid;
  v_seller_id uuid;
  v_buyer_pct numeric;
  v_seller_pct numeric;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can finalize sale commissions.';
  end if;

  select amount, property_id, buyer_id into v_amount, v_property_id, v_buyer_id from offers where id = p_offer_id;
  select owner_id into v_seller_id from properties where id = v_property_id;
  select value::numeric into v_buyer_pct from platform_settings where key = 'sale_commission_buyer_percentage';
  select value::numeric into v_seller_pct from platform_settings where key = 'sale_commission_seller_percentage';

  insert into transaction_commissions (transaction_type, offer_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount)
  values
    ('sale', p_offer_id, v_property_id, v_buyer_id, 'buyer', v_amount, v_buyer_pct, round(v_amount * v_buyer_pct / 100, 2)),
    ('sale', p_offer_id, v_property_id, v_seller_id, 'seller', v_amount, v_seller_pct, round(v_amount * v_seller_pct / 100, 2))
  on conflict do nothing;

  perform notify_user(v_buyer_id, '💰 Sale commission invoice generated',
    'A real ' || v_buyer_pct || '% commission (' || round(v_amount * v_buyer_pct / 100, 2) || ') is due on your recent purchase. Please settle it from your CHS wallet.',
    '/property/' || v_property_id);
  perform notify_user(v_seller_id, '💰 Sale commission invoice generated',
    'A real ' || v_seller_pct || '% commission (' || round(v_amount * v_seller_pct / 100, 2) || ') is due on your recent sale. Please settle it from your CHS wallet.',
    '/property/' || v_property_id);
end;
$$;

create or replace function rule_on_dispute(p_dispute_id uuid, p_status text, p_notes text)
returns void
language plpgsql
security definer
as $$
declare
  v_tenancy_id uuid;
  v_amount numeric;
  v_tenant_id uuid;
  v_landlord_id uuid;
  v_raised_by uuid;
  v_against uuid;
  v_payer_id uuid;
  v_payee_id uuid;
  v_balance numeric;
  v_reference text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can rule on a dispute.';
  end if;
  if p_status not in ('ruled_for_tenant', 'ruled_for_owner') then
    raise exception 'Invalid ruling.';
  end if;

  select tenancy_id, amount_in_dispute, raised_by, against
    into v_tenancy_id, v_amount, v_raised_by, v_against
    from disputes where id = p_dispute_id;

  select tenant_id, landlord_id into v_tenant_id, v_landlord_id from tenancies where id = v_tenancy_id;

  update disputes set status = p_status, ruling_notes = p_notes where id = p_dispute_id;

  if v_amount is not null and v_amount > 0 then
    if p_status = 'ruled_for_tenant' then
      v_payer_id := v_landlord_id;
      v_payee_id := v_tenant_id;
    else
      v_payer_id := v_tenant_id;
      v_payee_id := v_landlord_id;
    end if;

    select main_balance into v_balance from wallets where user_id = v_payer_id;
    if v_balance is not null and v_balance >= v_amount then
      v_reference := 'DISP-' || substr(gen_random_uuid()::text, 1, 8);

      update wallets set main_balance = main_balance - v_amount, updated_at = now() where user_id = v_payer_id;
      insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
      values (v_payer_id, 'main', v_amount, 'debit', 'Dispute ruling — amount owed', v_reference);

      update wallets set main_balance = main_balance + v_amount, updated_at = now() where user_id = v_payee_id;
      insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
      values (v_payee_id, 'main', v_amount, 'credit', 'Dispute ruling — amount awarded', v_reference);
    else
      perform notify_user(v_payer_id, '⚠️ Dispute amount could not be collected',
        'You were ruled to owe ' || v_amount || ' but your wallet balance is insufficient. Please fund your wallet to settle this.', '/wallet');
    end if;
  end if;

  perform notify_user(v_raised_by, 'Your dispute has been resolved',
    'CHS has ruled ' || (case when p_status = 'ruled_for_tenant' then 'in the tenant''s favour' else 'in the owner''s favour' end) || '. ' || coalesce(p_notes, ''),
    '/my-receipts');
  if v_against is not null then
    perform notify_user(v_against, 'A dispute involving you has been resolved',
      'CHS has ruled ' || (case when p_status = 'ruled_for_tenant' then 'in the tenant''s favour' else 'in the owner''s favour' end) || '. ' || coalesce(p_notes, ''),
      '/my-receipts');
  end if;
end;
$$;
