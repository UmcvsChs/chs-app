-- Real design correction: I initially built a separate, parallel
-- payment function for the agent-managed rental fee instead of
-- extending the one, real, shared function every other commission
-- type already pays through — leaving two different paths a tenant
-- could end up on. Merged the real agent-credit logic into the actual
-- shared function, and removed the redundant duplicate.

create or replace function pay_transaction_commission(p_commission_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_amount numeric;
  v_payer_id uuid;
  v_status text;
  v_balance numeric;
  v_reference text;
  v_transaction_type text;
  v_property_id uuid;
  v_agent_id uuid;
  v_chs_fee_pct numeric;
  v_chs_fee_amount numeric;
  v_agent_net numeric;
begin
  select commission_amount, payer_id, status, transaction_type, property_id
    into v_amount, v_payer_id, v_status, v_transaction_type, v_property_id
    from transaction_commissions where id = p_commission_id;

  if v_payer_id != auth.uid() then
    raise exception 'This commission invoice does not belong to you.';
  end if;
  if v_status = 'paid' then
    raise exception 'This commission has already been paid.';
  end if;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_amount then
    raise exception 'Insufficient wallet balance to settle this commission.';
  end if;

  v_reference := 'COMM-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - v_amount, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', v_amount, 'debit', 'Transaction commission payment', v_reference);

  if v_transaction_type = 'agent_managed_rental' then
    select managing_agent_id into v_agent_id from properties where id = v_property_id;
    select value::numeric into v_chs_fee_pct from platform_settings where key = 'agent_platform_fee_pct';
    v_chs_fee_amount := round(v_amount * v_chs_fee_pct / 100, 2);
    v_agent_net := v_amount - v_chs_fee_amount;

    update wallets set main_balance = main_balance + v_agent_net, updated_at = now() where user_id = v_agent_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (v_agent_id, 'main', v_agent_net, 'credit', 'Real agency fee earned, net of CHS platform fee', v_reference);

    perform notify_user(v_agent_id, '💰 Your real agency fee has been paid', 'You earned ' || v_agent_net || ' (net of CHS''s ' || v_chs_fee_pct || '% platform fee).');
  end if;

  update transaction_commissions set status = 'paid', paid_at = now(), reference = v_reference where id = p_commission_id;
end;
$$;
