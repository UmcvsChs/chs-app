-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: House Rules & Regulations
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql, in the same Supabase project.
--
-- A genuinely new, complete feature — even the original app never
-- had a real owner-side upload for this, only a tenant-facing
-- acknowledgment screen using fake, hardcoded data. Built properly
-- here: a real upload, a real per-tenancy acknowledgment record,
-- and real visibility for the owner, admin, and tenant alike.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from properties;
-- If this errors, run 01_schema.sql first.

create table if not exists property_house_rules (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade unique,
  document_url text not null,
  uploaded_by uuid not null references profiles(id),
  created_at timestamptz default now()
);

alter table property_house_rules enable row level security;

create policy "house_rules_public_read"
  on property_house_rules for select
  using (true); -- a real, deliberate choice: a prospective tenant should be able to review real house rules before even applying, not only after moving in

create policy "house_rules_owner_manage"
  on property_house_rules for all
  using (exists (select 1 from properties p where p.id = property_house_rules.property_id and p.owner_id = auth.uid()));

create policy "house_rules_admin_all"
  on property_house_rules for all
  using (is_admin());

create table if not exists house_rules_acknowledgments (
  id uuid primary key default uuid_generate_v4(),
  tenancy_id uuid not null references tenancies(id) on delete cascade,
  tenant_id uuid not null references profiles(id),
  acknowledged_at timestamptz default now(),
  unique (tenancy_id)
);

alter table house_rules_acknowledgments enable row level security;

create policy "house_rules_ack_tenant_own"
  on house_rules_acknowledgments for all
  using (tenant_id = auth.uid());

create policy "house_rules_ack_owner_manager_read"
  on house_rules_acknowledgments for select
  using (exists (select 1 from tenancies t where t.id = house_rules_acknowledgments.tenancy_id and (t.landlord_id = auth.uid() or t.manager_id = auth.uid())));

create policy "house_rules_ack_admin_all"
  on house_rules_acknowledgments for all
  using (is_admin());

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select table_name from information_schema.tables
where table_name in ('property_house_rules', 'house_rules_acknowledgments');
-- Should return 2 rows.
