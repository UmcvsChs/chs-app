-- Real, new feature per direct client request: agents/managers who
-- collect rent in person (cash, bank transfer to their own account,
-- etc.) need a real, digital way to remit the owner's real share
-- through CHS, with their own agreed commission automatically
-- deducted — settling the exact problem raised: money "getting hung"
-- or an owner claiming they never received it. The agent's own real
-- wallet is debited the full amount they're remitting (representing
-- the real cash they've already collected), and the system
-- automatically splits it: the owner's wallet receives their real net
-- share, the agent receives their own agreed commission (net of CHS's
-- capped platform fee), and everything is logged with a real
-- reference either side can point to if a dispute ever comes up.

create table remittances (
  id uuid primary key default uuid_generate_v4(),
  remitted_by uuid not null references profiles(id),
  owner_id uuid not null references profiles(id),
  property_id uuid references properties(id),
  gross_amount numeric not null check (gross_amount > 0),
  commission_pct numeric,
  commission_amount numeric not null default 0,
  chs_fee_amount numeric not null default 0,
  owner_net_amount numeric not null,
  note text,
  reference text not null,
  created_at timestamptz default now()
);

alter table remittances enable row level security;
create policy "remittances_remitter" on remittances for select using (auth.uid() = remitted_by);
create policy "remittances_owner_view" on remittances for select using (auth.uid() = owner_id);
create policy "remittances_admin" on remittances for all using (staff_can_access('finance'));

create or replace function remit_collected_rent_to_owner(p_owner_id uuid, p_amount numeric, p_property_id uuid default null, p_note text default null)
returns uuid
language plpgsql
security definer
as $$
declare
  v_agent_balance numeric;
  v_commission_pct numeric;
  v_commission_amount numeric;
  v_chs_fee_pct numeric;
  v_chs_fee_amount numeric;
  v_agent_net numeric;
  v_owner_net numeric;
  v_reference text;
  v_new_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'A real, valid amount is required.';
  end if;

  select main_balance into v_agent_balance from wallets where user_id = auth.uid();
  if v_agent_balance is null or v_agent_balance < p_amount then
    raise exception 'Insufficient wallet balance. Fund your wallet with the real amount collected before remitting it.';
  end if;

  select commission_pct into v_commission_pct from agent_owner_commission_rates
  where agent_id = auth.uid() and owner_id = p_owner_id;

  v_commission_amount := coalesce(round(p_amount * v_commission_pct / 100, 2), 0);
  select value::numeric into v_chs_fee_pct from platform_settings where key = 'agent_platform_fee_pct';
  v_chs_fee_amount := round(v_commission_amount * coalesce(v_chs_fee_pct, 0) / 100, 2);
  v_agent_net := v_commission_amount - v_chs_fee_amount;
  v_owner_net := p_amount - v_commission_amount;

  v_reference := 'REMIT-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - p_amount, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', p_amount, 'debit', 'Real rent remittance to owner', v_reference);

  update wallets set main_balance = main_balance + v_owner_net, updated_at = now() where user_id = p_owner_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (p_owner_id, 'main', v_owner_net, 'credit', 'Real rent remittance received via your agent/manager', v_reference);

  if v_agent_net > 0 then
    update wallets set main_balance = main_balance + v_agent_net, updated_at = now() where user_id = auth.uid();
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (auth.uid(), 'main', v_agent_net, 'credit', 'Real agreed commission on remitted rent, net of CHS platform fee', v_reference);
  end if;

  insert into remittances (remitted_by, owner_id, property_id, gross_amount, commission_pct, commission_amount, chs_fee_amount, owner_net_amount, note, reference)
  values (auth.uid(), p_owner_id, p_property_id, p_amount, v_commission_pct, v_commission_amount, v_chs_fee_amount, v_owner_net, p_note, v_reference)
  returning id into v_new_id;

  perform notify_user(p_owner_id, '💰 Real rent remittance received',
    'Your agent/manager has remitted ' || v_owner_net || ' to your wallet' ||
    (case when v_commission_amount > 0 then ' (after their agreed ' || v_commission_pct || '% commission of ' || v_commission_amount || ')' else '' end) ||
    '. Reference: ' || v_reference || coalesce(E'\nNote: ' || p_note, ''));

  return v_new_id;
end;
$$;
