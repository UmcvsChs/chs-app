-- Real, serious fix found during Phase 3: a dispute ruling only ever
-- sent a text notification saying who "won" — the real disputed
-- amount never actually moved between the two parties.

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
        'You were ruled to owe ' || v_amount || ' but your wallet balance is insufficient. Please fund your wallet to settle this.');
    end if;
  end if;

  perform notify_user(v_raised_by, 'Your dispute has been resolved',
    'CHS has ruled ' || (case when p_status = 'ruled_for_tenant' then 'in the tenant''s favour' else 'in the owner''s favour' end) || '. ' || coalesce(p_notes, ''));
  if v_against is not null then
    perform notify_user(v_against, 'A dispute involving you has been resolved',
      'CHS has ruled ' || (case when p_status = 'ruled_for_tenant' then 'in the tenant''s favour' else 'in the owner''s favour' end) || '. ' || coalesce(p_notes, ''));
  end if;
end;
$$;
