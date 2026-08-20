-- ═══════════════════════════════════════════════════════════════
-- CHS — Agent Application Fields (item #15, new tracker)
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql.
--
-- Two things prompted this migration:
-- 1. The client's specific request: a real membership ID field for an
--    agent's claimed professional association (e.g. NIESV), with a
--    genuine review step, rather than an unverifiable free-text claim.
-- 2. A related gap found while building that fix: several other agent
--    application fields (areas of operation, years of experience,
--    motivation, references) were being collected on the form and then
--    silently discarded — never actually saved anywhere, because the
--    profiles table had no columns for them and the submission code
--    never tried to write them. Fixing the one without the other would
--    have left a second, adjacent version of the exact same problem.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from profiles;
-- If this errors, run 01_schema.sql first.

alter table profiles add column if not exists association_name text;
alter table profiles add column if not exists membership_id text;
alter table profiles add column if not exists membership_verified boolean default false;
  -- Starts false and stays false until a real CHS reviewer actually checks
  -- it — no public NIESV/REDAN lookup API exists to verify this
  -- automatically, so this is a genuine human-reviewed field, the same
  -- honest pattern already used for identity verification (#3).
alter table profiles add column if not exists operating_lgas text;
alter table profiles add column if not exists years_experience text;
alter table profiles add column if not exists application_motivation text;
alter table profiles add column if not exists reference_1 text;
alter table profiles add column if not exists reference_2 text;

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select column_name from information_schema.columns
where table_name = 'profiles' and column_name in ('membership_id','membership_verified','association_name');
-- Should return 3 rows.
