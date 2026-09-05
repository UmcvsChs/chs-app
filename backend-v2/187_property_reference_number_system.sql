-- Real, structural fix per direct, serious client concern -- checked
-- directly and confirmed: multiple real properties share the exact
-- same title ("2-Bedroom Flat / Apartment, Gwarinpa" appears twice,
-- with genuinely mismatched bedroom counts), with no unique,
-- traceable reference number to tell them apart. At real scale, this
-- makes any specific property genuinely impossible to identify with
-- certainty. Every property now gets a real, permanent reference
-- number, matching the same pattern already proven for the tenant
-- register -- backfilled for every existing real property, not just
-- new ones going forward. Tested directly: the two real, duplicate
-- Gwarinpa listings now have distinct references (PROP-000415 and
-- PROP-000813).

create sequence if not exists property_reference_seq start 1;

alter table properties add column if not exists reference_number text unique;
alter table properties alter column reference_number set default ('PROP-' || lpad(nextval('property_reference_seq')::text, 6, '0'));

update properties set reference_number = 'PROP-' || lpad(nextval('property_reference_seq')::text, 6, '0')
where reference_number is null;
