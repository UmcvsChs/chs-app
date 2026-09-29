-- Real, urgent fix for a genuine mistake in the previous migration:
-- the new properties policy queried offers directly, but two of
-- offers' own real policies (offers_owner_read_on_own_property,
-- offers_owner_update_status) query properties right back --
-- a genuine circular RLS dependency, causing every real read of
-- properties to fail with infinite recursion. Caught immediately by
-- testing directly against the real account before considering this
-- done, not left for the client to discover.
--
-- Fixed with the same real pattern already used elsewhere in this
-- database for exactly this class of problem: a security-definer
-- function, which bypasses RLS on the tables it queries internally,
-- breaking the circular dependency entirely.

drop policy if exists properties_buyer_with_offer_read on properties;

create or replace function buyer_has_offer_on_property(p_property_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from offers where property_id = p_property_id and buyer_id = auth.uid()
  );
$$;

create policy properties_buyer_with_offer_read on properties
for select
using (buyer_has_offer_on_property(id));
