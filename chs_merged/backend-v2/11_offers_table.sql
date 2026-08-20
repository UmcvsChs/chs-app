-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Offers Table
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql, in the same Supabase project.
--
-- This is a genuine improvement being made as part of the v2 rebuild:
-- in the original app, an offer only ever lived in that browser tab's
-- own memory — which is exactly what caused a real, serious bug found
-- during testing (a genuine ₦42.5M offer that admin and the owner could
-- never see, because nothing was ever actually saved anywhere shared).
-- That was fixed within the original app's constraints at the time, but
-- the right fix — a real, shared database table — is what's being built
-- here from the very start, so that category of bug can't happen again.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from properties;
-- If this errors, run 01_schema.sql first.

create table if not exists offers (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  amount numeric(14,2) not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz default now()
);

alter table offers enable row level security;

-- The buyer who made the offer can always see their own offer.
create policy "offers_buyer_read_own"
  on offers for select
  using (buyer_id = auth.uid());

-- The property's owner can see every offer made on their own property —
-- this is the exact real gap that caused the original bug: an owner
-- genuinely had no reliable way to see an offer that had come in.
create policy "offers_owner_read_on_own_property"
  on offers for select
  using (
    exists (select 1 from properties where properties.id = offers.property_id and properties.owner_id = auth.uid())
  );

-- Admin sees every offer, for real oversight — the other half of the
-- original gap, where admin had no visibility into pending offers at all.
create policy "offers_admin_all"
  on offers for all
  using (is_admin());

-- Any logged-in buyer can make a real offer.
create policy "offers_buyer_insert"
  on offers for insert
  with check (buyer_id = auth.uid());

-- Only the property's owner can update an offer's status (accept/reject)
-- — a buyer can never silently "accept" their own offer.
create policy "offers_owner_update_status"
  on offers for update
  using (
    exists (select 1 from properties where properties.id = offers.property_id and properties.owner_id = auth.uid())
  );

create index if not exists offers_property_id_idx on offers(property_id);
create index if not exists offers_buyer_id_idx on offers(buyer_id);

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select table_name from information_schema.tables where table_name = 'offers';
-- Should return one row.

select policyname from pg_policies where tablename = 'offers';
-- Should return 5 rows.
