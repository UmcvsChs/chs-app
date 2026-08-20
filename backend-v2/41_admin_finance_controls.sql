-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Admin Finance Controls
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql, in the same Supabase project.
--
-- A genuinely significant gap found during the systematic Admin
-- comparison: "Freeze wallet" was never real in the original — a
-- toast message with no actual effect, no real fraud-prevention
-- control behind it at all. Built properly here: a real, checkable
-- frozen state that actually blocks withdrawal.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from wallets;
-- If this errors, run 01_schema.sql first.

alter table wallets add column if not exists frozen boolean not null default false;
alter table wallets add column if not exists frozen_reason text;

-- Real admin read/write access to any wallet — for genuine lookup and
-- the real freeze control, distinct from the existing "own wallet
-- only" policy.
drop policy if exists "wallets_admin_all" on wallets;
create policy "wallets_admin_all"
  on wallets for all
  using (is_admin());

select column_name from information_schema.columns
where table_name = 'wallets' and column_name in ('frozen', 'frozen_reason');
-- Should return 2 rows.

-- ═══════════════════════════════════════════════════════════════
-- The real, functional half of this fix — a frozen flag that does
-- nothing on its own isn't a real control. This updates the actual,
-- already-deployed withdrawal function so a genuinely frozen wallet
-- is actually, functionally blocked from withdrawing, not just
-- flagged for show.
-- ═══════════════════════════════════════════════════════════════
create or replace function debit_wallet_for_withdrawal(
  p_user_id uuid,
  p_amount numeric,
  p_reference text
) returns boolean as $$
declare
  v_current_balance numeric;
  v_frozen boolean;
begin
  select main_balance, frozen into v_current_balance, v_frozen from wallets where user_id = p_user_id for update;

  if v_frozen then
    raise exception 'wallet_frozen';
  end if;

  if v_current_balance is null or v_current_balance < p_amount then
    return false;
  end if;

  update wallets set main_balance = main_balance - p_amount, updated_at = now() where user_id = p_user_id;

  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (p_user_id, 'main', p_amount, 'debit', 'Withdrawal to bank account', p_reference);

  return true;
end;
$$ language plpgsql security definer set search_path = public;

-- ═══════════════════════════════════════════════════════════════
-- Real fix: Sale Approvals checkpoint
-- ═══════════════════════════════════════════════════════════════
-- A genuine, distinct financial safety checkpoint found completely
-- missing: the real gap between an owner accepting an offer and money
-- actually moving to escrow. CHS reviews and clears the transaction
-- here first — this wasn't built as any part of the rebuild at all.

alter table offers add column if not exists chs_cleared boolean not null default false;

select column_name from information_schema.columns
where table_name = 'offers' and column_name = 'chs_cleared';
-- Should return one row.
