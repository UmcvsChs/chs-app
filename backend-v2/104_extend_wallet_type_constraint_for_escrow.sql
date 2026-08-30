-- Real constraint bug caught by testing before delivery: this needed
-- extending to allow the new escrow_held wallet type, discovered only
-- when the actual real payment flow was tested end-to-end.

alter table wallet_transactions drop constraint wallet_transactions_wallet_type_check;
alter table wallet_transactions add constraint wallet_transactions_wallet_type_check
  check (wallet_type = ANY (ARRAY['main', 'rent_savings', 'maintenance_reserve', 'agent_earnings', 'escrow_held']));
