-- Real, genuine gap found through direct client testing: the listing
-- form only ever asked for a broad neighborhood (e.g. "Malali GRA"),
-- never a real, specific street address or house number. With
-- potentially millions of real properties on the platform, there was
-- no way to actually identify which house a fault, payment, or
-- commission belongs to — a real, serious traceability gap.

alter table properties add column if not exists street_address text;
