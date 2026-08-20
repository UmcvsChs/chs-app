-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Rental Application Applicant Details
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 12_rental_applications.sql, in the same
-- Supabase project.
--
-- This was flagged in an earlier audit but never actually fixed —
-- the real form only ever asked for a guarantor's name and phone,
-- never anything about the actual applicant. Fixed properly now.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from rental_applications;
-- If this errors, run 12_rental_applications.sql first.

alter table rental_applications add column if not exists applicant_occupation text;
alter table rental_applications add column if not exists applicant_present_address text;
alter table rental_applications add column if not exists applicant_income_source text;
alter table rental_applications add column if not exists applicant_id_type text;
alter table rental_applications add column if not exists applicant_id_number text;
alter table rental_applications add column if not exists applicant_id_document_url text;

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select column_name from information_schema.columns
where table_name = 'rental_applications'
and column_name in (
  'applicant_occupation', 'applicant_present_address', 'applicant_income_source',
  'applicant_id_type', 'applicant_id_number', 'applicant_id_document_url'
);
-- Should return 6 rows.
