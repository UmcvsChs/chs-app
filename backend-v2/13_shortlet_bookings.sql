-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Shortlet Bookings
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql, in the same Supabase project.
--
-- This is deliberately built with real, database-enforced protection
-- against double-booking, not just an application-side check. A pure
-- "check for overlapping dates, then insert" approach in JavaScript has
-- a genuine race condition: two people could both pass the check at
-- nearly the same moment, before either insert completes, and both get
-- confirmed for the same nights. The exclusion constraint below makes
-- that structurally impossible — the database itself will reject the
-- second booking outright, no matter how close in time the two
-- attempts are.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from properties;
-- If this errors, run 01_schema.sql first.

-- Required for the exclusion constraint below to work with date ranges.
create extension if not exists btree_gist;

-- Shortlet-specific pricing lives on the property itself — reusing the
-- same properties table rather than a parallel one, with "shortlet"
-- added as a genuine new purpose value alongside the existing four.
alter table properties drop constraint if exists properties_purpose_check;
alter table properties add constraint properties_purpose_check
  check (purpose in ('rent', 'sale', 'lease', 'hire', 'shortlet'));

alter table properties add column if not exists price_per_night numeric(12,2);

create table if not exists shortlet_bookings (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  guest_id uuid not null references profiles(id) on delete cascade,
  check_in date not null,
  check_out date not null,
  total_price numeric(14,2) not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz default now(),

  constraint valid_date_range check (check_out > check_in),

  -- The actual real protection: PostgreSQL itself refuses any new
  -- confirmed booking whose date range overlaps an existing confirmed
  -- booking for the same property. '[)' means check-in is inclusive,
  -- check-out is exclusive — so a guest checking out on the 10th and
  -- another checking in on the 10th is correctly allowed, not treated
  -- as an overlap.
  exclude using gist (
    property_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status = 'confirmed')
);

alter table shortlet_bookings enable row level security;

create policy "shortlet_bookings_guest_read_own"
  on shortlet_bookings for select
  using (guest_id = auth.uid());

create policy "shortlet_bookings_owner_read_on_own_property"
  on shortlet_bookings for select
  using (
    exists (select 1 from properties where properties.id = shortlet_bookings.property_id and properties.owner_id = auth.uid())
  );

create policy "shortlet_bookings_admin_all"
  on shortlet_bookings for all
  using (is_admin());

create policy "shortlet_bookings_guest_insert"
  on shortlet_bookings for insert
  with check (guest_id = auth.uid());

-- A guest can cancel their own booking (never a confirmed booking that
-- isn't theirs), freeing up those dates for someone else.
create policy "shortlet_bookings_guest_cancel_own"
  on shortlet_bookings for update
  using (guest_id = auth.uid());

create index if not exists shortlet_bookings_property_id_idx on shortlet_bookings(property_id);
create index if not exists shortlet_bookings_guest_id_idx on shortlet_bookings(guest_id);

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select table_name from information_schema.tables where table_name = 'shortlet_bookings';
-- Should return one row.

select policyname from pg_policies where tablename = 'shortlet_bookings';
-- Should return 5 rows.

select conname from pg_constraint where conname like '%shortlet_bookings%excl%' or conname = 'shortlet_bookings_property_id_daterange_excl';
-- Confirms the real exclusion constraint exists (name may vary slightly
-- by Postgres version — if this returns nothing, check the table's
-- constraints directly in the Supabase table editor instead).
