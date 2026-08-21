-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Wallet Auto-Creation, RLS Lockdown, P2P
-- Transfer, and Admin Login Approval (code-based)
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql, in the same Supabase project.
--
-- Found during a real audit: a new user registering today would hit a
-- BROKEN wallet page — no wallet was ever auto-created anywhere.
-- Separately, and more serious: the wallets table's own RLS policy
-- allowed a user to UPDATE their own row directly, including
-- main_balance — a real, exploitable hole letting anyone set their
-- own balance to any number via a direct API call, bypassing every
-- payment flow in the app. Both fixed here, along with real
-- user-to-user transfer (which never existed at all), and the
-- role-agnostic groundwork for admin login approval.

select count(*) as schema_already_set_up from wallets;
-- If this errors, run 01_schema.sql first.

-- ───────────────────────────────────────────────────────────────
-- 1. Auto-create a wallet the moment a profile is created — a real
--    trigger, not scattered app-code that a future registration path
--    could forget to call.
-- ───────────────────────────────────────────────────────────────

create or replace function create_wallet_for_new_profile()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into wallets (user_id, main_balance, rent_savings, maintenance_reserve, agent_earnings_paid, agent_earnings_pending)
  values (new.id, 0, 0, 0, 0, 0)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_create_wallet_for_new_profile on profiles;
create trigger trg_create_wallet_for_new_profile
  after insert on profiles
  for each row
  execute function create_wallet_for_new_profile();

-- Real backfill — any existing profile without a wallet gets one now,
-- rather than only fixing this going forward.
insert into wallets (user_id, main_balance, rent_savings, maintenance_reserve, agent_earnings_paid, agent_earnings_pending)
select id, 0, 0, 0, 0, 0 from profiles
where id not in (select user_id from wallets)
on conflict (user_id) do nothing;

-- ───────────────────────────────────────────────────────────────
-- 2. Lock down direct wallet writes — the real security fix. A user
--    can still genuinely SEE their own wallet, but every balance
--    change must go through a real, audited function from now on
--    (credit_wallet, debit_wallet_for_withdrawal, the new transfer
--    function below), the same pattern already used correctly
--    elsewhere in this app — this table was the one real exception.
-- ───────────────────────────────────────────────────────────────

drop policy if exists "wallets_own_all" on wallets;

create policy "wallets_own_read"
  on wallets for select
  using (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────
-- 3. Real user-to-user transfer — genuinely didn't exist before.
--    Recipients are found by phone or email (what a real person
--    would actually type), not a raw user ID nobody would know.
-- ───────────────────────────────────────────────────────────────

create or replace function find_transfer_recipient(p_contact text)
returns table(id uuid, full_name text, role text)
language sql
stable
security definer
as $$
  select id, full_name, role from profiles
  where (phone = p_contact or email = p_contact) and id != auth.uid()
  limit 1;
$$;

create or replace function transfer_wallet_funds(p_recipient_id uuid, p_amount numeric, p_note text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_sender_balance numeric;
  v_sender_frozen boolean;
  v_recipient_frozen boolean;
  v_reference text;
begin
  if p_recipient_id = auth.uid() then
    raise exception 'You cannot transfer funds to yourself.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter a real amount to transfer.';
  end if;

  select main_balance, frozen into v_sender_balance, v_sender_frozen
    from wallets where user_id = auth.uid();
  if coalesce(v_sender_frozen, false) then
    raise exception 'Your wallet is currently frozen — contact support.';
  end if;
  if v_sender_balance is null or v_sender_balance < p_amount then
    raise exception 'Insufficient wallet balance for this transfer.';
  end if;

  select frozen into v_recipient_frozen from wallets where user_id = p_recipient_id;
  if v_recipient_frozen is null then
    raise exception 'Recipient not found.';
  end if;
  if v_recipient_frozen then
    raise exception 'This recipient''s wallet cannot currently receive funds.';
  end if;

  v_reference := 'P2P-' || substr(gen_random_uuid()::text, 1, 12);

  update wallets set main_balance = main_balance - p_amount, updated_at = now() where user_id = auth.uid();
  update wallets set main_balance = main_balance + p_amount, updated_at = now() where user_id = p_recipient_id;

  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', p_amount, 'debit', coalesce('Transfer sent' || (case when p_note is not null then ' — ' || p_note else '' end), 'Transfer sent'), v_reference);

  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (p_recipient_id, 'main', p_amount, 'credit', coalesce('Transfer received' || (case when p_note is not null then ' — ' || p_note else '' end), 'Transfer received'), v_reference);

  insert into notifications (user_id, title, body)
  values (p_recipient_id, 'Money received',
    'You received a transfer of ₦' || p_amount::text || ' from another CHS user.');
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 4. Admin login approval — role-agnostic groundwork. Built now,
--    ready to wire into RLS once the actual sub-admin roles and
--    dashboard segments are defined — deliberately NOT touching
--    is_admin() itself here, since dozens of existing RLS policies
--    already depend on it and this needs real testing per policy,
--    not a blind same-session rewrite of something this load-bearing.
-- ───────────────────────────────────────────────────────────────

alter table profiles add column if not exists is_super_admin boolean not null default false;

-- The real CHS admin account becomes the one, genuine super admin —
-- everyone else with role='admin' added after this point is a
-- sub-admin, subject to the approval flow below.
update profiles set is_super_admin = true where role = 'admin';

create table if not exists admin_login_requests (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid not null references profiles(id) on delete cascade,
  code text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  created_at timestamptz default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id)
);

alter table admin_login_requests enable row level security;

create policy "admin_login_requests_own_read"
  on admin_login_requests for select
  using (auth.uid() = admin_id);

create policy "admin_login_requests_super_admin_all"
  on admin_login_requests for all
  using (exists (select 1 from profiles where id = auth.uid() and is_super_admin = true));

create or replace function request_admin_login()
returns text
language plpgsql
security definer
as $$
declare
  v_code text;
  v_name text;
  v_role text;
begin
  -- A real super admin never needs to approve themselves.
  if exists (select 1 from profiles where id = auth.uid() and is_super_admin = true) then
    return 'super_admin';
  end if;

  select full_name, role into v_name, v_role from profiles where id = auth.uid();
  v_code := lpad(floor(random() * 1000000)::text, 6, '0');

  insert into admin_login_requests (admin_id, code)
  values (auth.uid(), v_code);

  insert into notifications (user_id, title, body)
  select id, '🔐 Admin login approval needed',
    v_name || ' (' || v_role || ') is trying to log in. Code: ' || v_code
  from profiles where is_super_admin = true;

  return v_code;
end;
$$;

create or replace function has_approved_admin_login(p_admin_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from admin_login_requests
    where admin_id = p_admin_id
      and status = 'approved'
      and resolved_at > now() - interval '12 hours'
  );
$$;

create or replace function resolve_admin_login(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
as $$
declare
  v_admin_id uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_super_admin = true) then
    raise exception 'Only a super admin can approve or reject a login request.';
  end if;

  select admin_id into v_admin_id from admin_login_requests where id = p_request_id and status = 'pending';
  if v_admin_id is null then
    raise exception 'This request no longer needs a decision (already resolved or expired).';
  end if;

  update admin_login_requests
    set status = case when p_approve then 'approved' else 'rejected' end,
        resolved_at = now(), resolved_by = auth.uid()
    where id = p_request_id;

  insert into notifications (user_id, title, body)
  values (v_admin_id,
    case when p_approve then '✓ Login approved' else '✕ Login rejected' end,
    case when p_approve then 'Your login has been approved by a super admin.'
         else 'Your login request was rejected by a super admin.' end);
end;
$$;

select column_name from information_schema.columns where table_name = 'profiles' and column_name = 'is_super_admin';
-- Should return one row.
