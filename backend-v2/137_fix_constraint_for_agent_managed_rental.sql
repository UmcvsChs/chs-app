alter table transaction_commissions drop constraint if exists transaction_commissions_check;
alter table transaction_commissions add constraint transaction_commissions_check
  check (
    (transaction_type = 'sale' and offer_id is not null and tenancy_id is null and shortlet_booking_id is null and rent_to_own_payment_id is null and payer_role = ANY(ARRAY['buyer','seller']))
    or (transaction_type = 'rental' and tenancy_id is not null and offer_id is null and shortlet_booking_id is null and rent_to_own_payment_id is null and payer_role = ANY(ARRAY['tenant','landlord']))
    or (transaction_type = 'shortlet_hire' and shortlet_booking_id is not null and offer_id is null and tenancy_id is null and rent_to_own_payment_id is null and payer_role = ANY(ARRAY['guest','host']))
    or (transaction_type = 'rent_to_own' and rent_to_own_payment_id is not null and offer_id is null and tenancy_id is null and shortlet_booking_id is null and payer_role = ANY(ARRAY['buyer','seller']))
    or (transaction_type = 'agent_managed_sale' and offer_id is not null and tenancy_id is null and shortlet_booking_id is null and rent_to_own_payment_id is null and payer_role = 'agent')
    or (transaction_type = 'agent_managed_rental' and tenancy_id is not null and offer_id is null and shortlet_booking_id is null and rent_to_own_payment_id is null and payer_role = 'tenant')
  );
