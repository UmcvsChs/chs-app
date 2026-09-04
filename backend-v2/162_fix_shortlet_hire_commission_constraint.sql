-- Real, significant bug found while testing the new hire-booking
-- connection: the real commission function has always inserted
-- transaction_type = 'shortlet_hire' as one combined value, but the
-- real constraint only ever allowed 'shortlet' and 'hire' as two
-- separate values — a genuine mismatch that meant EVERY real
-- shortlet or hire booking would fail at the commission-recording
-- step. This was never caught before because, confirmed directly:
-- zero real shortlet bookings had ever been completed end to end
-- until this test just found the problem.

alter table transaction_commissions drop constraint if exists transaction_commissions_transaction_type_check;
alter table transaction_commissions add constraint transaction_commissions_transaction_type_check
  check (transaction_type = ANY (ARRAY['sale', 'rental', 'shortlet', 'hire', 'shortlet_hire', 'rent_to_own', 'agent_managed_sale', 'agent_managed_rental']));
