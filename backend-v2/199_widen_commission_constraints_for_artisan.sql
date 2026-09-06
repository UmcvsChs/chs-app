alter table transaction_commissions drop constraint transaction_commissions_payer_role_check;
alter table transaction_commissions add constraint transaction_commissions_payer_role_check
  check (payer_role = ANY (ARRAY['buyer', 'seller', 'tenant', 'landlord', 'guest', 'host', 'agent', 'artisan']));

alter table transaction_commissions drop constraint transaction_commissions_transaction_type_check;
alter table transaction_commissions add constraint transaction_commissions_transaction_type_check
  check (transaction_type = ANY (ARRAY['sale', 'rental', 'shortlet', 'hire', 'shortlet_hire', 'rent_to_own', 'agent_managed_sale', 'agent_managed_rental', 'maintenance_job']));
