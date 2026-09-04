-- Real, necessary follow-up to the critical PII fix: removing the
-- broad public-read policy was correct, but it also silently breaks
-- real, legitimate features built earlier — an agent seeing the name
-- of an owner whose property they manage, for the commission-rate
-- feature.
--
-- NOTE: this migration's row-level policies were found, by direct
-- testing, to over-share (granting the full row, including NIN and
-- phone, for any real business relationship) and were replaced by
-- migration 153 with a real, field-limited function instead. Kept
-- here for a truthful history of what was tried; migration 153 is
-- the actual, correct fix in effect.

create policy "profiles_managed_owner_visible_to_agent" on profiles for select using (
  exists (select 1 from properties p where p.owner_id = profiles.id and p.managing_agent_id = auth.uid())
);

create policy "profiles_agent_visible_to_owner" on profiles for select using (
  exists (select 1 from properties p where p.managing_agent_id = profiles.id and p.owner_id = auth.uid())
);

create policy "profiles_tenancy_parties_visible" on profiles for select using (
  exists (select 1 from tenancies t where (t.tenant_id = auth.uid() and (t.landlord_id = profiles.id or t.manager_id = profiles.id)))
  or exists (select 1 from tenancies t where ((t.landlord_id = auth.uid() or t.manager_id = auth.uid()) and t.tenant_id = profiles.id))
);

create policy "profiles_offer_parties_visible" on profiles for select using (
  exists (select 1 from offers o join properties p on p.id = o.property_id where o.buyer_id = auth.uid() and p.owner_id = profiles.id)
  or exists (select 1 from offers o join properties p on p.id = o.property_id where p.owner_id = auth.uid() and o.buyer_id = profiles.id)
);
