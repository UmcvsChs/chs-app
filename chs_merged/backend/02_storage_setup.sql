-- ═══════════════════════════════════════════════════════════════
-- CHS — Storage Setup for Property Photos & Videos
-- For Supabase (Storage + Row-Level Security)
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE in your Supabase project's SQL Editor, the same way
-- 01_schema.sql was run. This is the one piece the original schema
-- didn't cover — everywhere a property's `photos` and `video_url`
-- columns are meant to point to, this is where those files actually
-- live.
-- ═══════════════════════════════════════════════════════════════

-- 1. FIRST — a quick sanity check. Run this line by itself first.
-- If it returns a row, your schema is already live and you can
-- continue below. If it errors with "relation properties does not
-- exist," stop here and run 01_schema.sql first — this file depends
-- on the properties table already existing.
select count(*) as properties_table_exists from properties;

-- ═══════════════════════════════════════════════════════════════
-- 2. CREATE THE BUCKET
-- ═══════════════════════════════════════════════════════════════
-- One bucket holds every property's photos and videos, organised by
-- folder so ownership can be checked cleanly: {owner_id}/{property_id}/filename
-- Marked public because property photos are meant to be seen by
-- anyone browsing the homepage — there is nothing private in them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-media',
  'property-media',
  true,
  52428800, -- 50MB per file — generous enough for a short walkthrough video
  array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']
)
on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════════
-- 3. WHO CAN READ FILES — everyone, since these are public listing photos
-- ═══════════════════════════════════════════════════════════════
create policy "property_media_public_read"
  on storage.objects for select
  using (bucket_id = 'property-media');

-- ═══════════════════════════════════════════════════════════════
-- 4. WHO CAN UPLOAD — only a logged-in owner, only into their own folder
-- ═══════════════════════════════════════════════════════════════
-- Files must be uploaded as: {your_user_id}/{property_id}/filename.jpg
-- This policy checks that the first folder in the file path matches
-- whoever is currently logged in — so Owner A can never upload into
-- Owner B's folder, even by guessing a property ID.
create policy "property_media_owner_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'property-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ═══════════════════════════════════════════════════════════════
-- 5. WHO CAN DELETE/REPLACE — same rule, only your own folder
-- ═══════════════════════════════════════════════════════════════
create policy "property_media_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'property-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "property_media_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'property-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ═══════════════════════════════════════════════════════════════
-- 6b. VERIFICATION DOCUMENTS TABLE
-- ═══════════════════════════════════════════════════════════════
-- The original schema stores photos and a video URL directly on the
-- properties table, but has nowhere for the specific verification
-- documents (ownership document, KADGIS, KASUPDA, owner's ID) to
-- live. This adds that.
create table if not exists property_documents (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  doc_type text not null check (doc_type in ('ownership_document','kadgis','kasupda','owner_id','inheritance_consent','other')),
  file_url text not null,
  uploaded_at timestamptz default now()
);

alter table property_documents enable row level security;

-- Owner can see and manage documents for their own properties
create policy "property_documents_owner_all"
  on property_documents for all
  using (
    exists (select 1 from properties where properties.id = property_documents.property_id and properties.owner_id = auth.uid())
  );

-- Admin can see every document, for verification purposes
create policy "property_documents_admin_read"
  on property_documents for select
  using (is_admin());

-- ═══════════════════════════════════════════════════════════════
-- 6. ADMIN CAN ALSO REMOVE ANYTHING (e.g. a rejected/fraudulent listing)
-- ═══════════════════════════════════════════════════════════════
create policy "property_media_admin_delete"
  on storage.objects for delete
  using (
    bucket_id = 'property-media'
    and is_admin()  -- this function already exists from 01_schema.sql
  );

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
-- Go to Storage in the left sidebar of your Supabase dashboard —
-- you should now see a bucket called "property-media".
-- Then run this to confirm the policies are attached:
select policyname, cmd from pg_policies where tablename = 'objects' and policyname like 'property_media%';
-- You should see 5 rows: public_read (select), owner_upload (insert),
-- owner_delete (delete), owner_update (update), admin_delete (delete).
