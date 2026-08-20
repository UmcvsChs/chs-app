-- ═══════════════════════════════════════════════════════════════
-- CHS — Multi-Role Account Linking (item #17, phase 3)
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql.
--
-- The original schema gives each person exactly one role, full stop —
-- there was no way to represent "this same person is genuinely both a
-- registered Buyer and a registered Owner" at the database level at all.
-- This adds that, deliberately as an ADDITION alongside the existing
-- single `role` column (which continues to mean "primary/default role")
-- rather than replacing it, so nothing already built against `role`
-- breaks.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from profiles;
-- If this errors, run 01_schema.sql first.

alter table profiles add column if not exists secondary_roles text[] default '{}';
  -- Every additional role this same real person has genuinely registered
  -- for, beyond their original/primary `role`. Each one still goes through
  -- its own real registration submission and any role-specific review —
  -- linking recognises who they already are, it doesn't skip vetting.

-- A person's full set of accessible roles, primary plus secondary, in one
-- place — used by the login screen to offer "log in as: X or Y" when
-- someone has more than one.
create or replace function get_all_roles(p_user_id uuid)
returns text[] as $$
  select array_prepend(role, coalesce(secondary_roles, '{}'))
  from profiles where id = p_user_id;
$$ language sql stable;

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select column_name from information_schema.columns
where table_name = 'profiles' and column_name = 'secondary_roles';
-- Should return one row.
