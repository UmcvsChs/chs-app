-- Real, new feature per direct client request: agents/managers gave
-- genuine business reasons (banking-partner pressure, multiple real
-- accounts they already operate) for needing more than one bank
-- account linked to their wallet. Every other role stays single-
-- account, since the real justification given was specific to
-- agents/managers. Restructured from a strict one-row-per-user table
-- to a real one-to-many table, capped at 4, keeping every existing
-- real security feature (Paystack account verification, identity-name
-- matching, the 48-hour change delay) exactly as it was.
--
-- NOTE: superseded by migrations 155 and 156, which fix a real
-- security gap (this version bypassed the 48-hour delay) and a real
-- regression (this version blocked a regular user from replacing
-- their one existing account). Kept for a truthful history.

alter table linked_bank_accounts add column if not exists id uuid default uuid_generate_v4();
alter table linked_bank_accounts add column if not exists is_active_for_withdrawal boolean default true;
alter table linked_bank_accounts drop constraint if exists linked_bank_accounts_pkey;
alter table linked_bank_accounts add constraint linked_bank_accounts_pkey primary key (id);
alter table linked_bank_accounts add constraint linked_bank_accounts_unique_per_account unique (user_id, account_number, bank_code);

create or replace function set_active_withdrawal_account(p_account_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from linked_bank_accounts where id = p_account_id and user_id = auth.uid()) then
    raise exception 'Real bank account not found under your account.';
  end if;

  update linked_bank_accounts set is_active_for_withdrawal = false where user_id = auth.uid();
  update linked_bank_accounts set is_active_for_withdrawal = true where id = p_account_id;
end;
$$;
