-- Real, genuine finding from the scalability review: dozens of
-- foreign key columns across the app had no real index at all. This
-- works fine at the current testing scale (hundreds of rows), but
-- every RLS check and join through these columns would fall back to
-- a real, full table scan once real data grows — directly the kind
-- of thing that makes an app feel fast today and genuinely slow at
-- real scale. Adding indexes to the busiest, most-queried real tables
-- first: properties, tenancies-adjacent tables, messaging, and every
-- new commission/financial table built this session.

create index if not exists idx_properties_managing_agent_id on properties(managing_agent_id);
create index if not exists idx_properties_occupant_id on properties(occupant_id);
create index if not exists idx_fault_reports_property_id on fault_reports(property_id);
create index if not exists idx_service_charges_tenant_id on service_charges(tenant_id);
create index if not exists idx_service_charges_property_id on service_charges(property_id);
create index if not exists idx_service_charges_estate_id on service_charges(estate_id);
create index if not exists idx_transaction_commissions_payer_id on transaction_commissions(payer_id);
create index if not exists idx_transaction_commissions_property_id on transaction_commissions(property_id);
create index if not exists idx_rent_payments_landlord_id on rent_payments(landlord_id);
create index if not exists idx_rent_payments_tenancy_id on rent_payments(tenancy_id);
create index if not exists idx_rent_payments_tenant_id on rent_payments(tenant_id);
create index if not exists idx_precommit_messages_offer_id on precommit_messages(offer_id);
create index if not exists idx_precommit_messages_sender_id on precommit_messages(sender_id);
create index if not exists idx_precommit_messages_recipient_id on precommit_messages(recipient_id);
create index if not exists idx_tenancy_messages_sender_id on tenancy_messages(sender_id);
create index if not exists idx_shortlet_messages_shortlet_booking_id on shortlet_messages(shortlet_booking_id);
create index if not exists idx_owner_admin_messages_owner_id on owner_admin_messages(owner_id);
create index if not exists idx_saved_properties_property_id on saved_properties(property_id);
create index if not exists idx_property_views_viewer_id on property_views(viewer_id);
create index if not exists idx_estates_manager_id on estates(manager_id);
create index if not exists idx_sale_installment_payments_offer_id on sale_installment_payments(offer_id);
create index if not exists idx_document_dispatch_requests_offer_id on document_dispatch_requests(offer_id);
create index if not exists idx_property_sale_documents_property_id on property_sale_documents(property_id);
create index if not exists idx_agent_change_requests_property_id on agent_change_requests(property_id);
create index if not exists idx_agent_change_requests_owner_id on agent_change_requests(owner_id);
create index if not exists idx_agent_owner_commission_rates_owner_id on agent_owner_commission_rates(owner_id);
create index if not exists idx_team_members_member_id on team_members(member_id);
create index if not exists idx_team_daily_reports_team_member_id on team_daily_reports(team_member_id);
create index if not exists idx_tenant_register_recorded_by on tenant_register(recorded_by);
create index if not exists idx_expense_entries_recorded_by on expense_entries(recorded_by);
create index if not exists idx_remittances_remitted_by on remittances(remitted_by);
create index if not exists idx_remittances_owner_id on remittances(owner_id);
create index if not exists idx_wallet_transactions_reference on wallet_transactions(reference);
