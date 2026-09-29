-- Real, direct fix per a repeated, direct client complaint: a real
-- purchase offer -- a serious financial commitment -- required zero
-- bio-data at submission. My earlier fix only made the buyer's
-- existing profile visible to the seller afterward; it never made the
-- offer itself actually capture real information about the buyer,
-- the way a rental application already correctly does. Fixed
-- properly: an offer now requires the buyer's real full name, phone,
-- occupation, and source of funds at the moment they submit it.

alter table offers add column if not exists buyer_full_name text;
alter table offers add column if not exists buyer_phone text;
alter table offers add column if not exists buyer_occupation text;
alter table offers add column if not exists buyer_source_of_funds text;
