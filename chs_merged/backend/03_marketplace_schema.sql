-- ═══════════════════════════════════════════════════════════════
-- CHS — Marketplace Schema (interior design, furniture, bedding,
-- home equipment, and building materials vendors)
-- For Supabase (tables + Row-Level Security + Storage)
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE in your Supabase project's SQL Editor, the same way
-- 01_schema.sql and 02_storage_setup.sql were run. This is a
-- genuinely separate part of the app — a physical-goods marketplace
-- is a different kind of business from real estate, so vendors get
-- their own registration, their own verification path (CAC business
-- registration, not the NIN/liveness check real estate owners use),
-- and their own tables entirely, deliberately kept apart from the
-- properties table.
-- ═══════════════════════════════════════════════════════════════

-- 1. Sanity check — run this line by itself first.
select count(*) as schema_already_set_up from profiles;
-- If this errors, run 01_schema.sql first — this file depends on the
-- profiles table (and its is_admin() function) already existing.

-- ═══════════════════════════════════════════════════════════════
-- 2. VENDORS TABLE
-- ═══════════════════════════════════════════════════════════════
create table if not exists marketplace_vendors (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  business_name text not null,
  category text not null check (category in ('interior_design','furniture','bedding_textiles','home_equipment','building_materials')),
  cac_number text,                       -- Corporate Affairs Commission registration — this is the vendor's own
                                          -- verification path, distinct from a real-estate owner's NIN/liveness check
  description text,
  phone text,
  location_state text,
  location_lga text,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  verification_notes text,
  created_at timestamptz default now()
);

alter table marketplace_vendors enable row level security;

-- Anyone can see a verified vendor's public profile
create policy "marketplace_vendors_public_read_verified"
  on marketplace_vendors for select
  using (verification_status = 'verified');

-- A vendor can see and manage their own profile regardless of status
create policy "marketplace_vendors_owner_all"
  on marketplace_vendors for all
  using (user_id = auth.uid());

-- Admin sees and manages everything, same as the properties table
create policy "marketplace_vendors_admin_all"
  on marketplace_vendors for all
  using (is_admin());

-- ═══════════════════════════════════════════════════════════════
-- 3. PRODUCTS TABLE
-- ═══════════════════════════════════════════════════════════════
create table if not exists marketplace_products (
  id uuid primary key default uuid_generate_v4(),
  vendor_id uuid not null references marketplace_vendors(id) on delete cascade,
  name text not null,
  category text not null check (category in ('interior_design','furniture','bedding_textiles','home_equipment','building_materials')),
  price numeric not null,
  price_unit text,                       -- e.g. "per unit", "per bag", "per sqm", "per project" — building
                                          -- materials and design services are priced very differently
  description text,
  photos text[] default '{}',
  status text not null default 'active' check (status in ('active','sold_out','delisted')),
  created_at timestamptz default now()
);

alter table marketplace_products enable row level security;

-- Anyone can browse products from a verified vendor
create policy "marketplace_products_public_read"
  on marketplace_products for select
  using (
    status = 'active'
    and exists (select 1 from marketplace_vendors where marketplace_vendors.id = marketplace_products.vendor_id and marketplace_vendors.verification_status = 'verified')
  );

-- A vendor manages their own products
create policy "marketplace_products_vendor_all"
  on marketplace_products for all
  using (
    exists (select 1 from marketplace_vendors where marketplace_vendors.id = marketplace_products.vendor_id and marketplace_vendors.user_id = auth.uid())
  );

-- Admin sees and manages everything
create policy "marketplace_products_admin_all"
  on marketplace_products for all
  using (is_admin());

-- ═══════════════════════════════════════════════════════════════
-- 4. STORAGE BUCKET FOR PRODUCT PHOTOS
-- ═══════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace-media', 'marketplace-media', true, 20971520, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "marketplace_media_public_read"
  on storage.objects for select
  using (bucket_id = 'marketplace-media');

-- Files must be uploaded as: {user_id}/{vendor_id}/filename.jpg — same
-- folder-ownership pattern as property-media, so a vendor can only ever
-- write into their own folder.
create policy "marketplace_media_vendor_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'marketplace-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "marketplace_media_vendor_delete"
  on storage.objects for delete
  using (
    bucket_id = 'marketplace-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "marketplace_media_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'marketplace-media' and is_admin());

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
-- Check both tables exist:
select table_name from information_schema.tables where table_name in ('marketplace_vendors','marketplace_products');
-- Should return both table names.

-- Check the storage bucket:
-- Go to Storage in the left sidebar — you should see "marketplace-media" listed.
