-- ═══════════════════════════════════════════════════════════════
-- CHS — Valid ID Type & Verification (item #16, new tracker)
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql.
--
-- Closes a real, confirmed gap: "Upload valid government ID" previously
-- accepted literally any image with no type declared and no number
-- captured — confirmed directly by the client uploading a plain company
-- ID card and having it accepted without question. This adds the missing
-- structure: a declared ID type, its number, and where the uploaded
-- document actually lives, plus a genuine human-reviewed verification
-- flag rather than a fake automated pass.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from profiles;
-- If this errors, run 01_schema.sql first.

alter table profiles add column if not exists valid_id_type text
  check (valid_id_type in ('National ID (NIN slip)','Voter''s Card','International Passport','Driver''s Licence') or valid_id_type is null);
alter table profiles add column if not exists valid_id_number text;
alter table profiles add column if not exists valid_id_document_url text;
alter table profiles add column if not exists valid_id_verified boolean default false;
  -- Starts false and stays false until a real CHS reviewer actually looks
  -- at the uploaded document and confirms it matches the declared type and
  -- number — no automated document-verification provider is connected
  -- (the same category of gap already disclosed for #3's liveness check),
  -- so this is a genuine, honest human-reviewed field, not a pretend check.

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select column_name from information_schema.columns
where table_name = 'profiles' and column_name in ('valid_id_type','valid_id_number','valid_id_document_url','valid_id_verified');
-- Should return 4 rows.
