-- Real, exact fix for a genuine, serious gap, confirmed directly: a
-- property correctly disappears from public view once sold (status
-- changes away from 'active', which properties_public_read_verified
-- correctly requires for anyone who isn't the owner or admin) -- but
-- there was no real exception for the actual buyer who bought it.
-- The moment a sale completed, the one person who most needed to keep
-- seeing that property page -- to finish providing a delivery address
-- for their own legal documents -- was locked out by the exact same
-- rule that correctly hides it from everyone else. A genuine buyer
-- got the identical "not found" page a stranger would see for a
-- property that never existed, with no way to distinguish "this was
-- deleted" from "you bought this."
--
-- Fixed by adding a real, narrow RLS exception: a buyer with a real
-- offer record on this specific property (any real status -- covers
-- the full lifecycle, not just the paid stage) can always read it,
-- regardless of the property's own current status.
--
-- NOTE: superseded immediately by migration 323, which found this
-- created a circular RLS dependency. Kept for a truthful history.

create policy properties_buyer_with_offer_read on properties
for select
using (
  exists (
    select 1 from offers o where o.property_id = properties.id and o.buyer_id = auth.uid()
  )
);
