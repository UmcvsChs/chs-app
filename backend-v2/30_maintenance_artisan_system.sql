-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Maintenance Artisan Registration & Ranking System
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 06_fault_reports_backend.sql, in the same
-- Supabase project.
--
-- Built from a real, detailed design conversation with the client on
-- 30 July 2026 — see CHS_v2_MAINTENANCE_ARTISAN_SYSTEM.md for the full
-- agreed design. Closes a real trust gap: quotations on a reported
-- fault currently come from a free-text name anyone could type.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from fault_quotations;
-- If this errors, run 06_fault_reports_backend.sql first.

-- The existing real values ('chs_vendor', 'owner', 'tenant') describe
-- who *sourced* a quote, not a genuinely registered artisan submitting
-- their own — extending this properly rather than forcing an imperfect
-- fit onto an existing category.
alter table fault_quotations drop constraint if exists fault_quotations_submitted_by_check;
alter table fault_quotations add constraint fault_quotations_submitted_by_check
  check (submitted_by in ('chs_vendor', 'owner', 'tenant', 'artisan'));

-- ── 1. Real artisan registration ──
create table if not exists artisans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  trade text not null check (trade in (
    'painter', 'plumber', 'electrician', 'carpenter', 'bricklayer', 'other'
  )),
  other_trade_description text, -- used only when trade = 'other'
  years_experience integer not null default 0,
  certification_body text,
  certification_document_url text,
  equipment_tier text not null default 'basic' check (equipment_tier in ('basic', 'power_tools', 'professional')),
  base_state text not null,
  base_lga text,
  willing_to_travel_interstate boolean not null default false,
  artisan_type text not null default 'independent' check (artisan_type in ('independent', 'chs_agent')),
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  created_at timestamptz default now()
);

alter table artisans enable row level security;

create policy "artisans_public_read_verified"
  on artisans for select
  using (verification_status = 'verified');

create policy "artisans_own_all"
  on artisans for all
  using (user_id = auth.uid());

create policy "artisans_admin_all"
  on artisans for all
  using (is_admin());

create index if not exists artisans_user_id_idx on artisans(user_id);
create index if not exists artisans_trade_state_idx on artisans(trade, base_state);

-- ── 2. Real artisan identity on quotations ──
-- Nullable and additive — existing quotations (free-text vendor_name)
-- keep working exactly as before; new quotations from a real
-- registered artisan now genuinely link to their real account.
alter table fault_quotations add column if not exists artisan_id uuid references artisans(id) on delete set null;

-- ── 3. Real, earned, per-job ratings ──
-- Deliberately only ever created once a fault is genuinely resolved —
-- there is no real path for an artisan to be rated before real work
-- has actually happened.
create table if not exists artisan_ratings (
  id uuid primary key default uuid_generate_v4(),
  fault_report_id uuid not null references fault_reports(id) on delete cascade,
  artisan_id uuid not null references artisans(id) on delete cascade,
  rated_by uuid not null references profiles(id),
  quality_stars integer not null check (quality_stars between 1 and 5),
  reliability_stars integer not null check (reliability_stars between 1 and 5),
  conduct_stars integer not null check (conduct_stars between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique (fault_report_id, artisan_id) -- one real rating per real job
);

alter table artisan_ratings enable row level security;

create policy "artisan_ratings_public_read"
  on artisan_ratings for select
  using (true); -- genuinely visible to any client comparing quotations, by explicit client decision

create policy "artisan_ratings_rater_insert"
  on artisan_ratings for insert
  with check (rated_by = auth.uid());

create policy "artisan_ratings_admin_all"
  on artisan_ratings for all
  using (is_admin());

create index if not exists artisan_ratings_artisan_id_idx on artisan_ratings(artisan_id);

-- ── 4. Real, two-sided job disputes ──
-- Deliberately its own real table, separate from the existing
-- tenancy-based disputes table — a maintenance job dispute is tied to
-- the real job itself, not a tenancy relationship, since an artisan
-- isn't part of one. Explicitly two-sided per the client's direct
-- instruction: a client can raise one against the artisan, and the
-- artisan can just as genuinely raise one against a difficult client.
create table if not exists artisan_job_disputes (
  id uuid primary key default uuid_generate_v4(),
  fault_report_id uuid not null references fault_reports(id) on delete cascade,
  raised_by uuid not null references profiles(id),
  against uuid not null references profiles(id),
  description text not null,
  status text not null default 'open' check (status in ('open', 'ruled_for_raiser', 'ruled_for_other', 'closed')),
  ruling_notes text,
  created_at timestamptz default now()
);

alter table artisan_job_disputes enable row level security;

create policy "artisan_job_disputes_party_read"
  on artisan_job_disputes for select
  using (auth.uid() = raised_by or auth.uid() = against);

create policy "artisan_job_disputes_raise_own"
  on artisan_job_disputes for insert
  with check (auth.uid() = raised_by);

create policy "artisan_job_disputes_admin_all"
  on artisan_job_disputes for all
  using (is_admin());

create index if not exists artisan_job_disputes_fault_report_id_idx on artisan_job_disputes(fault_report_id);

-- ── 5. A real, genuine gap just found while helping the client deploy
-- this ──
-- The original fault_quotations insert policy only ever allowed admin,
-- the tenant, the landlord, the manager, or the property owner to
-- submit a quotation — a real, verified artisan submitting their own
-- was never accounted for, since this policy predates the artisan
-- system entirely. Without this, a verified artisan would be silently
-- blocked from submitting a quote at all.
drop policy if exists "fault_quotations_insert_by_stakeholders" on fault_quotations;
create policy "fault_quotations_insert_by_stakeholders"
  on fault_quotations for insert
  with check (
    exists (
      select 1 from fault_reports fr
      left join tenancies t on t.id = fr.tenancy_id
      left join properties p on p.id = fr.property_id
      where fr.id = fault_quotations.fault_report_id
      and (
        is_admin()
        or (t.tenant_id = auth.uid()) or (t.landlord_id = auth.uid()) or (t.manager_id = auth.uid())
        or (p.owner_id = auth.uid())
        or exists (select 1 from artisans a where a.user_id = auth.uid() and a.verification_status = 'verified')
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select table_name from information_schema.tables
where table_name in ('artisans', 'artisan_ratings', 'artisan_job_disputes');
-- Should return 3 rows.

select policyname from pg_policies where tablename = 'artisans';
-- Should return 3 rows.

select policyname from pg_policies where tablename = 'artisan_ratings';
-- Should return 3 rows.

select policyname from pg_policies where tablename = 'artisan_job_disputes';
-- Should return 3 rows.

select column_name from information_schema.columns
where table_name = 'fault_quotations' and column_name = 'artisan_id';
-- Should return one row.
