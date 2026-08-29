-- Real fixes found during the audit — both used a blanket is_admin()
-- check instead of the real, established staff-domain restriction.

drop policy if exists "referrals_admin_all" on agent_referrals;
create policy "referrals_admin_all" on agent_referrals for all using (staff_can_access('agent_relations'));

drop policy if exists "property_documents_admin_read" on property_documents;
create policy "property_documents_admin_read" on property_documents for select using (staff_can_access('owner_buyer_tenant'));
