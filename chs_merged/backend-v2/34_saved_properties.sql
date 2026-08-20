-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Saved Properties
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql, in the same Supabase project.
--
-- A real, confirmed-missing homepage feature — the original app's
-- real bottom navigation had a genuine "Save" tab, letting someone
-- heart a property to find again later. Found completely absent
-- during a direct, thorough re-audit of the homepage.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from properties;
-- If this errors, run 01_schema.sql first.

create table if not exists saved_properties (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, property_id)
);

alter table saved_properties enable row level security;

create policy "saved_properties_own_all"
  on saved_properties for all
  using (user_id = auth.uid());

create index if not exists saved_properties_user_id_idx on saved_properties(user_id);

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select table_name from information_schema.tables where table_name = 'saved_properties';
-- Should return one row.

