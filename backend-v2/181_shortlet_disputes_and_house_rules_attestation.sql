-- Real, direct answers to two genuine, confirmed gaps found while
-- answering the client's direct questions:
-- 1. A host could upload real house rules, but a guest never saw
--    them anywhere in the actual booking flow, and there was no real
--    attestation before payment — the feature existed on one side
--    only, disconnected from the other.
-- 2. A real dispute-raising form already existed and worked — but
--    only for Tenant and Owner. Guest and Host, both genuinely new
--    roles, were never wired into it.

alter table disputes add column if not exists shortlet_booking_id uuid references shortlet_bookings(id);

create or replace function get_house_rules_for_property(p_property_id uuid)
returns text
language sql
stable
as $$
  select document_url from property_house_rules where property_id = p_property_id;
$$;
