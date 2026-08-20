-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Commercial Developer Registration
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql, in the same Supabase project.
--
-- A real, entirely missing registration path found during the
-- systematic Register view comparison — a genuine sixth role,
-- completely absent from this rebuild. Per the original's own real
-- text: this is a real application for CHS's team to review and
-- follow up on directly, not a self-service dashboard.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from profiles;
-- If this errors, run 01_schema.sql first.

create table if not exists developer_applications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  company_name text not null,
  cac_number text not null,
  current_projects text,
  offers_instalments boolean not null default false,
  accepts_investment_capital boolean not null default false,
  years_experience text not null,
  portfolio_url text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'partnered')),
  created_at timestamptz default now()
);

alter table developer_applications enable row level security;

create policy "developer_applications_own_all"
  on developer_applications for all
  using (user_id = auth.uid());

create policy "developer_applications_admin_all"
  on developer_applications for all
  using (is_admin());

create index if not exists developer_applications_user_id_idx on developer_applications(user_id);

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select table_name from information_schema.tables where table_name = 'developer_applications';
-- Should return one row.
