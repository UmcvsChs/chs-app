-- Real, serious regression caught before it reached a real user: the
-- previous version blocked a regular (non-agent/manager) user from
-- even CHANGING their one existing account, since it couldn't
-- distinguish "replacing my only account" from "adding a second one."
-- Fixed by adding a real, explicit replace mode for regular users,
-- while agents/managers keep the genuine ability to add up to 4.
-- Tested directly: confirmed a regular buyer account can replace
-- their one bank account repeatedly without being blocked, and that
-- each replacement correctly clears any prior pending change first.

create or replace function add_linked_bank_account(p_bank_name text, p_bank_code text, p_account_number text, p_account_name text, p_replace_existing boolean default false)
returns uuid
language plpgsql
security definer
as $$
declare
  v_role text;
  v_secondary_roles text[];
  v_is_agent_or_manager boolean;
  v_existing_count int;
  v_new_id uuid;
  v_effective_at timestamptz;
begin
  select role, secondary_roles into v_role, v_secondary_roles from profiles where id = auth.uid();
  v_is_agent_or_manager := v_role in ('agent', 'manager') or 'agent' = any(v_secondary_roles) or 'manager' = any(v_secondary_roles);

  select count(*) into v_existing_count from linked_bank_accounts where user_id = auth.uid();

  if v_existing_count >= 1 and not v_is_agent_or_manager and not p_replace_existing then
    raise exception 'Only agents and property managers can link more than one real bank account.';
  end if;
  if v_existing_count >= 4 and not p_replace_existing then
    raise exception 'A maximum of 4 real bank accounts can be linked.';
  end if;

  v_effective_at := now() + interval '48 hours';

  if p_replace_existing then
    delete from pending_bank_account_changes where user_id = auth.uid() and status = 'pending';
  end if;

  insert into pending_bank_account_changes (user_id, bank_name, bank_code, account_number, account_name, status, effective_at, replaces_existing)
  values (auth.uid(), p_bank_name, p_bank_code, p_account_number, p_account_name, 'pending', v_effective_at, p_replace_existing)
  returning id into v_new_id;

  perform notify_user(auth.uid(), '⏳ New bank account pending — 48-hour protection window',
    'Your request to link ' || p_bank_name || ' will take effect in 48 real hours. If you did not request this, contact CHS support immediately.');

  return v_new_id;
end;
$$;

alter table pending_bank_account_changes add column if not exists replaces_existing boolean default false;

create or replace function apply_matured_bank_changes()
returns void
language plpgsql
security definer
as $$
declare
  r record;
  v_existing_count int;
begin
  for r in
    select * from pending_bank_account_changes
    where status = 'pending' and effective_at <= now()
  loop
    if r.replaces_existing then
      delete from linked_bank_accounts where user_id = r.user_id;
    end if;

    select count(*) into v_existing_count from linked_bank_accounts where user_id = r.user_id;

    insert into linked_bank_accounts (user_id, bank_name, bank_code, account_number, account_name, updated_at, is_active_for_withdrawal)
    values (r.user_id, r.bank_name, r.bank_code, r.account_number, r.account_name, now(), v_existing_count = 0)
    on conflict (user_id, account_number, bank_code) do update
      set bank_name = excluded.bank_name, updated_at = now();

    update pending_bank_account_changes set status = 'applied' where id = r.id;

    perform notify_user(r.user_id, 'Your new bank account is now active',
      'Your linked bank account change to ' || r.bank_name || ' has taken effect after the real 48-hour protection window.');
  end loop;
end;
$$;
