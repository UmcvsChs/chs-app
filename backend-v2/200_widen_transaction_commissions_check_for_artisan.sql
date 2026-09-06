alter table transaction_commissions drop constraint transaction_commissions_check;
alter table transaction_commissions add constraint transaction_commissions_check
  check (
    ((transaction_type = 'sale') and (offer_id is not null) and (tenancy_id is null) and (shortlet_booking_id is null) and (rent_to_own_payment_id is null) and (payer_role = any (array['buyer','seller'])))
    or ((transaction_type = 'rental') and (tenancy_id is not null) and (offer_id is null) and (shortlet_booking_id is null) and (rent_to_own_payment_id is null) and (payer_role = any (array['tenant','landlord'])))
    or ((transaction_type = 'shortlet_hire') and (shortlet_booking_id is not null) and (offer_id is null) and (tenancy_id is null) and (rent_to_own_payment_id is null) and (payer_role = any (array['guest','host'])))
    or ((transaction_type = 'rent_to_own') and (rent_to_own_payment_id is not null) and (offer_id is null) and (tenancy_id is null) and (shortlet_booking_id is null) and (payer_role = any (array['buyer','seller'])))
    or ((transaction_type = 'agent_managed_sale') and (offer_id is not null) and (tenancy_id is null) and (shortlet_booking_id is null) and (rent_to_own_payment_id is null) and (payer_role = 'agent'))
    or ((transaction_type = 'agent_managed_rental') and (tenancy_id is not null) and (offer_id is null) and (shortlet_booking_id is null) and (rent_to_own_payment_id is null) and (payer_role = 'tenant'))
    or ((transaction_type = 'maintenance_job') and (property_id is not null) and (offer_id is null) and (tenancy_id is null) and (shortlet_booking_id is null) and (rent_to_own_payment_id is null) and (payer_role = 'artisan'))
  );
