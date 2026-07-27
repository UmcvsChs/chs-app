-- ═══════════════════════════════════════════════════════════════
-- CHS — NIN Uniqueness Enforcement (item #8, new tracker)
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql. This is a genuine gap fix, not
-- a routine addition — the original profiles table had no NIN column
-- at all, meaning "one person, one account" was never actually
-- enforceable at the database level, however carefully the
-- registration form validated the NIN's *format*. A unique constraint
-- on a format-valid field only works if the field actually exists.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from profiles;
-- If this errors, run 01_schema.sql first.

-- Add the column. Nullable, because existing rows (if any real users
-- already registered before this fix) won't have one on file yet —
-- forcing it not-null retroactively would break those rows rather
-- than just leave them unenforced until they re-verify.
alter table profiles add column if not exists nin text;

-- The actual enforcement — this is what makes "one person, one
-- account" a real, database-level guarantee rather than a client-side
-- suggestion someone could bypass by calling the API directly.
create unique index if not exists profiles_nin_unique_idx
  on profiles (nin)
  where nin is not null; -- partial index: doesn't block multiple NULLs
                          -- (rows that haven't submitted a NIN yet),
                          -- only blocks two DIFFERENT people submitting
                          -- the SAME real NIN.

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select column_name, data_type from information_schema.columns
where table_name = 'profiles' and column_name = 'nin';
-- Should return one row.

select indexname from pg_indexes
where tablename = 'profiles' and indexname = 'profiles_nin_unique_idx';
-- Should return one row.

-- ═══════════════════════════════════════════════════════════════
-- ⚠️ IMPORTANT — THIS PART CANNOT BE DONE FROM THIS SANDBOX
-- ═══════════════════════════════════════════════════════════════
-- Adding the column and constraint here only closes half the gap.
-- The `register-user` Supabase Edge Function (the serverless function
-- the registration form actually calls) needs a matching update:
--
-- 1. It must write the submitted `nin` value into this new column
--    when creating a profile (the registration form already sends
--    `nin` in its payload — confirmed directly in this project's own
--    testing — so no client-side change is needed for this part).
--
-- 2. It must catch the unique-constraint violation this index will
--    now throw when a second registration reuses an existing NIN,
--    and return a clear, specific error — something like
--    { error: "This NIN is already registered to another account" }
--    — rather than a generic failure message.
--
-- This Edge Function's source lives in Supabase's own Functions
-- dashboard, not in this app's codebase, so it needs to be opened
-- and edited directly there. The exact function name to look for is
-- `register-user` (the same one confirmed handling registration
-- throughout the rest of this project).
