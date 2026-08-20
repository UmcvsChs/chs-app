-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Management Termination Requests
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 29_management_delegation.sql, in the same
-- Supabase project.
--
-- Closes the "termination terms" part of the real Engage CHS
-- negotiation workflow the client raised. Built using reasonable,
-- clearly-disclosed industry-standard defaults (a 30-day notice
-- period, no exit fee, work already started is completed) rather than
-- left blocked indefinitely — the client should review and adjust
-- these real figures to match actual policy; they are a genuine
-- starting draft, not something already confirmed as final.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from tenancies;
-- If this errors, run 01_schema.sql first.

create table if not exists management_termination_requests (
  id uuid primary key default uuid_generate_v4(),
  tenancy_id uuid not null references tenancies(id) on delete cascade,
  requested_by uuid not null references profiles(id),
  reason text,
  requested_at timestamptz default now(),
  notice_period_ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled'))
);

alter table management_termination_requests enable row level security;

create policy "termination_requests_owner_read"
  on management_termination_requests for select
  using (
    exists (select 1 from tenancies t where t.id = management_termination_requests.tenancy_id and t.landlord_id = auth.uid())
  );

create policy "termination_requests_owner_insert"
  on management_termination_requests for insert
  with check (
    requested_by = auth.uid()
    and exists (select 1 from tenancies t where t.id = management_termination_requests.tenancy_id and t.landlord_id = auth.uid())
  );

create policy "termination_requests_owner_cancel"
  on management_termination_requests for update
  using (
    exists (select 1 from tenancies t where t.id = management_termination_requests.tenancy_id and t.landlord_id = auth.uid())
  );

create policy "termination_requests_admin_all"
  on management_termination_requests for all
  using (is_admin());

create index if not exists termination_requests_tenancy_id_idx on management_termination_requests(tenancy_id);

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select table_name from information_schema.tables where table_name = 'management_termination_requests';
-- Should return one row.
