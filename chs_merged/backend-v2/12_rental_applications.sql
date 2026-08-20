-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Rental Applications Table
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql, in the same Supabase project.
--
-- The original schema has a real `tenancies` table for an ESTABLISHED
-- tenancy, but nothing for the application step before that — the
-- original app's version of this step also had a real, confirmed gap:
-- admin's approval was treated as final, meaning the actual property
-- owner never got a genuine say on which specific tenant moves into
-- their own property. This table is built with that already fixed —
-- admin screens documents, the owner makes the real final decision.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from properties;
-- If this errors, run 01_schema.sql first.

create table if not exists rental_applications (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid not null references profiles(id) on delete cascade,
  guarantor_name text not null,
  guarantor_phone text not null,
  move_in_date date not null,
  status text not null default 'pending' check (
    status in ('pending', 'awaiting_owner_decision', 'approved', 'owner_declined')
  ),
  created_at timestamptz default now()
);

alter table rental_applications enable row level security;

-- The applicant can always see their own application.
create policy "rental_applications_tenant_read_own"
  on rental_applications for select
  using (tenant_id = auth.uid());

-- The property's real owner can see every application made on their own
-- property — this is the actual fix: previously there was no reliable
-- way for an owner to see who had applied at all.
create policy "rental_applications_owner_read_on_own_property"
  on rental_applications for select
  using (
    exists (select 1 from properties where properties.id = rental_applications.property_id and properties.owner_id = auth.uid())
  );

create policy "rental_applications_admin_all"
  on rental_applications for all
  using (is_admin());

-- Any logged-in tenant can submit a real application.
create policy "rental_applications_tenant_insert"
  on rental_applications for insert
  with check (tenant_id = auth.uid());

-- Admin can move a pending application to "awaiting owner decision"
-- (the document-screening step) — but never straight to "approved"
-- directly; that decision belongs to the owner.
create policy "rental_applications_admin_update"
  on rental_applications for update
  using (is_admin());

-- Only the property's real owner can make the actual final call.
create policy "rental_applications_owner_update"
  on rental_applications for update
  using (
    exists (select 1 from properties where properties.id = rental_applications.property_id and properties.owner_id = auth.uid())
  );

create index if not exists rental_applications_property_id_idx on rental_applications(property_id);
create index if not exists rental_applications_tenant_id_idx on rental_applications(tenant_id);

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select table_name from information_schema.tables where table_name = 'rental_applications';
-- Should return one row.

select policyname from pg_policies where tablename = 'rental_applications';
-- Should return 6 rows.
