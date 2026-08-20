-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Save Search + Notify Me
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql, in the same Supabase project.
--
-- Found genuinely missing during a direct comparison against the
-- real original search modal — a real, saved search with real
-- criteria, to be checked against new listings.

select count(*) as schema_already_set_up from properties;
-- If this errors, run 01_schema.sql first.

create table if not exists saved_searches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  purpose text,
  state text,
  lga text,
  area text,
  min_price numeric,
  max_price numeric,
  property_type text,
  min_bedrooms text,
  created_at timestamptz default now()
);

alter table saved_searches enable row level security;

create policy "saved_searches_own_all"
  on saved_searches for all
  using (user_id = auth.uid());

select table_name from information_schema.tables where table_name = 'saved_searches';
-- Should return one row.
