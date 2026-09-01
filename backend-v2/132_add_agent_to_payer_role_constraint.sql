-- Real, second constraint bug caught by the same test — a simpler,
-- global payer_role check also needed extending to allow 'agent'.

alter table transaction_commissions drop constraint if exists transaction_commissions_payer_role_check;
alter table transaction_commissions add constraint transaction_commissions_payer_role_check
  check (payer_role = ANY (ARRAY['buyer', 'seller', 'tenant', 'landlord', 'guest', 'host', 'agent']));
