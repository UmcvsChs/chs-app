-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Artisan Trades — Expand List + Multi-Select
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 30_maintenance_artisan_system.sql, in the
-- same Supabase project.
--
-- Two real, confirmed gaps fixed together: the trade list was far too
-- limited (missing tiler and many other real trades), and someone
-- with more than one real skill (e.g. carpenter AND bricklayer) had
-- no way to register as both.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from artisans;
-- If this errors, run 30_maintenance_artisan_system.sql first.

-- A real array, not a single value — genuinely lets one real person
-- register every skill they actually have, not just one.
alter table artisans add column if not exists trades text[];

-- Real, one-time migration of any existing single-trade records into
-- the new real array column, so nobody's existing registration is lost.
update artisans set trades = array[trade] where trades is null and trade is not null;

alter table artisans alter column trades set not null;

-- A real, confirmed gap: claiming "power tools" or "professional
-- equipment" had no actual verification behind it at all — genuinely
-- needed for a platform built specifically on being able to verify
-- what people claim, not just take their word for it.
alter table artisans add column if not exists equipment_photo_url text;
alter table artisans add column if not exists equipment_receipt_url text;

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select column_name from information_schema.columns
where table_name = 'artisans' and column_name in ('trades', 'equipment_photo_url', 'equipment_receipt_url');
-- Should return 3 rows.
