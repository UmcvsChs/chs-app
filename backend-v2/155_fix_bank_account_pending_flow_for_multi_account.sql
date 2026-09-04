-- Real, serious gap caught by reviewing my own previous migration: my
-- new add_linked_bank_account function bypassed the real, existing
-- 48-hour security delay entirely — meaning a compromised account
-- could have a new, attacker-controlled bank account added and used
-- immediately, with none of the real protection every other bank
-- change already goes through. Fixed by routing new-account requests
-- through the same real pending-change flow. Also fixes
-- apply_matured_bank_changes itself, which still assumed the old,
-- single-row-per-user schema and would have failed outright on the
-- very first real pending change processed after the restructure.
--
-- NOTE: superseded by migration 156, which fixes a further real
-- regression this version introduced (blocking a regular user from
-- replacing their one existing account). Kept for a truthful history.

create or replace function add_linked_bank_account(p_bank_name text, p_bank_code text, p_account_number text, p_account_name text)
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
begin
  select role, secondary_roles into v_role, v_secondary_roles from profiles where id = auth.uid();
  v_is_agent_or_manager := v_role in ('agent', 'manager') or 'agent' = any(v_secondary_roles) or 'manager' = any(v_secondary_roles);

  select count(*) into v_existing_count from linked_bank_accounts where user_id = auth.uid();

  if v_existing_count >= 1 and not v_is_agent_or_manager then
    raise exception 'Only agents and property managers can link more than one real bank account.';
  end if;
  if v_existing_count >= 4 then
    raise exception 'A maximum of 4 real bank accounts can be linked.';
  end if;

  insert into pending_bank_account_changes (user_id, bank_name, bank_code, account_number, account_name, status, effective_at)
  values (auth.uid(), p_bank_name, p_bank_code, p_account_number, p_account_name, 'pending', now() + interval '48 hours')
  returning id into v_new_id;

  perform notify_user(auth.uid(), '⏳ New bank account pending — 48-hour protection window',
    'Your request to link ' || p_bank_name || ' will take effect in 48 real hours. If you did not request this, contact CHS support immediately.');

  return v_new_id;
end;
$$;

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
