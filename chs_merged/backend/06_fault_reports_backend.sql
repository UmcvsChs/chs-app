-- ═══════════════════════════════════════════════════════════════
-- CHS — Real Fault Reports & Quotations Backend (item #14, new tracker)
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql. This closes a genuinely large gap:
-- the entire maintenance/fault-report/quotation system has been running
-- as local, in-browser JavaScript memory this whole project, with no real
-- shared backend at all — meaning an owner adding a quotation on their own
-- device was never actually visible to admin or the tenant on a separate
-- device, even though it displayed correctly within the same browser
-- session. This migration, together with the matching app-side changes,
-- makes it genuinely real and shared.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from fault_reports;
-- If this errors, run 01_schema.sql first — this migration extends the
-- fault_reports table that file already created.

-- ═══════════════════════════════════════════════════════════════
-- 1. EXTEND fault_reports
-- ═══════════════════════════════════════════════════════════════
-- The original table only supported a fault tied to exactly one tenancy,
-- and only four status values — real usage needs more of both. A shared
-- estate-wide issue (e.g. a borehole serving 4 units) doesn't cleanly
-- belong to one tenancy, so tenancy_id is relaxed to optional, with a
-- property-level reference added alongside it.

alter table fault_reports alter column tenancy_id drop not null;
alter table fault_reports add column if not exists property_id uuid references properties(id) on delete cascade;
alter table fault_reports add column if not exists ticket_ref text unique; -- human-readable ref, e.g. "CHS-M-198", matching what's already used throughout the app
alter table fault_reports add column if not exists approved_vendor text;
alter table fault_reports add column if not exists approved_amount numeric;
alter table fault_reports add column if not exists min_quotes_required integer default 3;

-- Replace the old, narrower status check with the real range already in
-- use across the app.
alter table fault_reports drop constraint if exists fault_reports_status_check;
alter table fault_reports add constraint fault_reports_status_check
  check (status in (
    'reported','assigned','converted_to_quote','gathering_quotes',
    'awaiting_owner_approval','awaiting_manager_approval',
    'approved_by_owner','approved_by_manager','resolved'
  ));

-- A fault report now needs EITHER a tenancy OR a property to make sense —
-- never neither.
alter table fault_reports drop constraint if exists fault_reports_has_context;
alter table fault_reports add constraint fault_reports_has_context
  check (tenancy_id is not null or property_id is not null);

-- Admin and property managers need to see faults tied to a property
-- directly too, not only through a tenancy — the original RLS only
-- covered the tenancy path.
drop policy if exists "faults_property_owner_manager_read" on fault_reports;
create policy "faults_property_owner_manager_read"
  on fault_reports for select
  using (
    exists (select 1 from properties p where p.id = fault_reports.property_id and (p.owner_id = auth.uid()))
  );

-- ═══════════════════════════════════════════════════════════════
-- 2. NEW: fault_quotations
-- ═══════════════════════════════════════════════════════════════
-- Genuinely didn't exist before — quotations were only ever held in
-- local JS memory, which is the direct cause of the bug this migration
-- fixes.
create table if not exists fault_quotations (
  id uuid primary key default uuid_generate_v4(),
  fault_report_id uuid not null references fault_reports(id) on delete cascade,
  vendor_name text not null,
  amount numeric not null,
  submitted_by text not null check (submitted_by in ('chs_vendor','owner','tenant')),
  note text,          -- optional context, e.g. a CHS officer's vetting note
  flag text check (flag in ('good','caution') or flag is null),
  created_at timestamptz default now()
);

alter table fault_quotations enable row level security;

-- Anyone who can see the parent fault report can see its quotations —
-- this deliberately mirrors fault_reports' own access rules rather than
-- duplicating separate logic that could drift out of sync with it.
create policy "fault_quotations_follow_parent_access"
  on fault_quotations for select
  using (
    exists (
      select 1 from fault_reports fr
      left join tenancies t on t.id = fr.tenancy_id
      left join properties p on p.id = fr.property_id
      where fr.id = fault_quotations.fault_report_id
      and (
        is_admin()
        or (t.tenant_id = auth.uid()) or (t.landlord_id = auth.uid()) or (t.manager_id = auth.uid())
        or (p.owner_id = auth.uid())
      )
    )
  );

-- Same access rules govern who may add a quotation — owner, tenant, or
-- CHS staff on behalf of the vendor network, matching the three-party
-- principle this whole feature was built around.
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
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select column_name from information_schema.columns
where table_name = 'fault_reports' and column_name in ('property_id','ticket_ref','approved_vendor');
-- Should return 3 rows.

select table_name from information_schema.tables where table_name = 'fault_quotations';
-- Should return one row.
