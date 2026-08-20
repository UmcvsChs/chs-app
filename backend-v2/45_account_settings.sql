-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Complete My Account (notification preferences)
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql, in the same Supabase project.
--
-- Found genuinely missing during a direct comparison: real
-- notification preferences per user, letting someone genuinely
-- control what they're notified about, not an all-or-nothing system.

select count(*) as schema_already_set_up from profiles;
-- If this errors, run 01_schema.sql first.

alter table profiles add column if not exists notify_offers boolean not null default true;
alter table profiles add column if not exists notify_messages boolean not null default true;
alter table profiles add column if not exists notify_marketing boolean not null default true;
alter table profiles add column if not exists diaspora_mode boolean not null default false;

select column_name from information_schema.columns
where table_name = 'profiles' and column_name in ('notify_offers', 'notify_messages', 'notify_marketing');
-- Should return 3 rows.
