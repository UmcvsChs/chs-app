-- ═══════════════════════════════════════════════════════════════
-- CHS — Marketplace Bundles (additive to 03_marketplace_schema.sql)
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 03_marketplace_schema.sql. Bundles are a
-- genuinely separate listing type from individual products — a
-- vendor-curated package at one combined price — kept in their own
-- table rather than folded into marketplace_products, so individual
-- material price comparison (the whole point of standardising units)
-- stays clean and isn't diluted by bundle pricing sitting alongside it.
-- ═══════════════════════════════════════════════════════════════

select count(*) as marketplace_schema_exists from marketplace_vendors;
-- If this errors, run 03_marketplace_schema.sql first.

create table if not exists marketplace_bundles (
  id uuid primary key default uuid_generate_v4(),
  vendor_id uuid not null references marketplace_vendors(id) on delete cascade,
  bundle_name text not null,
  category text not null check (category in ('interior_design','furniture','bedding_textiles','home_equipment','building_materials')),
  description text,
  included_items text not null,      -- plain-text description of what's in the bundle —
                                      -- kept simple for now rather than a fully relational
                                      -- item-by-item join table, since a bundle's contents
                                      -- are illustrative/marketing detail, not something a
                                      -- buyer needs to price-compare line by line (that's
                                      -- what individual listings are for)
  price numeric not null,
  photos text[] default '{}',
  status text not null default 'active' check (status in ('active','sold_out','delisted')),
  created_at timestamptz default now()
);

alter table marketplace_bundles enable row level security;

create policy "marketplace_bundles_public_read"
  on marketplace_bundles for select
  using (
    status = 'active'
    and exists (select 1 from marketplace_vendors where marketplace_vendors.id = marketplace_bundles.vendor_id and marketplace_vendors.verification_status = 'verified')
  );

create policy "marketplace_bundles_vendor_all"
  on marketplace_bundles for all
  using (
    exists (select 1 from marketplace_vendors where marketplace_vendors.id = marketplace_bundles.vendor_id and marketplace_vendors.user_id = auth.uid())
  );

create policy "marketplace_bundles_admin_all"
  on marketplace_bundles for all
  using (is_admin());

-- Uses the same marketplace-media storage bucket already set up in
-- 03_marketplace_schema.sql — no new bucket needed.

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select table_name from information_schema.tables where table_name = 'marketplace_bundles';
