-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Sale Listing Payment Terms + Ownership Declaration
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql, in the same Supabase project.
--
-- Found completely missing during the systematic property listing
-- form comparison. The ownership declaration specifically is a real,
-- significant legal protection — a listing owner explicitly
-- confirming clear authority to sell and co-heir consent where
-- relevant, with real, personal liability for a false declaration.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from properties;
-- If this errors, run 01_schema.sql first.

alter table properties add column if not exists min_acceptable_amount numeric;
alter table properties add column if not exists payment_terms text check (payment_terms in ('outright_only', 'instalment_allowed', 'both'));
alter table properties add column if not exists deposit_percentage text;
alter table properties add column if not exists balance_payment_deadline text;
alter table properties add column if not exists ownership_declared boolean not null default false;

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select column_name from information_schema.columns
where table_name = 'properties'
and column_name in ('min_acceptable_amount', 'payment_terms', 'deposit_percentage', 'balance_payment_deadline', 'ownership_declared');
-- Should return 5 rows.

-- ═══════════════════════════════════════════════════════════════
-- Real fix: Ownership document classification
-- ═══════════════════════════════════════════════════════════════
-- Found genuinely missing during the same systematic comparison — a
-- real document upload existed, but with no structured context about
-- how the property was acquired or what type of document was
-- actually uploaded, which real CHS verification staff would need.

alter table properties add column if not exists acquisition_method text;
alter table properties add column if not exists primary_document_type text;

select column_name from information_schema.columns
where table_name = 'properties' and column_name in ('acquisition_method', 'primary_document_type');
-- Should return 2 rows.
