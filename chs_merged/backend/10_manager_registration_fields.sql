-- ═══════════════════════════════════════════════════════════════
-- CHS — Manager Registration Fields (item #18)
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql.
--
-- The original Property Manager registration form had no real field IDs
-- at all and a submit button that only ever showed a toast — nothing it
-- collected was ever saved anywhere, because there was nowhere for it to
-- go. This adds that, alongside properly relocating and wiring the form
-- itself out of the Manager dashboard and into the one, unified
-- registration flow every other role already uses.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from profiles;
-- If this errors, run 01_schema.sql first.

alter table profiles add column if not exists profession text;
alter table profiles add column if not exists professional_registration_number text;
alter table profiles add column if not exists operating_states text;
alter table profiles add column if not exists certificate_document_url text;
alter table profiles add column if not exists professional_credentials_verified boolean default false;
  -- Same honest, human-reviewed pattern as every other verification field
  -- in this app — a real CHS reviewer checks the uploaded certificate
  -- against the declared profession and registration number.

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select column_name from information_schema.columns
where table_name = 'profiles' and column_name in ('profession','professional_registration_number','operating_states','certificate_document_url');
-- Should return 4 rows.
