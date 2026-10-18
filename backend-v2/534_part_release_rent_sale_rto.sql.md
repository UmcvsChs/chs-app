# 534 — Release a percentage: rent, property sales, rent-to-own (applied 18 Oct 2026)

Settings: part_release_max_pct_rent / _sale / _rto (default 60 = most CHS can release early, in total, per record).
Columns: rent_payments.part_released, offers.part_released, rent_to_own_payments.part_released, rent_to_own_agreements.final_part_released.
Table: part_release_log (kind, record_id, pct, amount, party_id, by_user, note) — RLS on, RPC access only.
Functions: _part_state, get_part_release_state(kind,id), admin_release_part(kind,id,pct,note) — kinds: rent, sale, rto_payment, rto_final.
Money moves escrow_held -> main_balance with two ledger rows (ref PART-xxxx), the owner is notified, audit event written.
Patched: release_rent_to_landlord_impl, release_sale_proceeds, admin_release_rto_payment, release_rto_final pay only the remainder;
admin_revert_rto_final_release restores the part; request_rent_refund and request_sale_refund refuse once a part was released
(finance must recover it first). Rent is also refused while the tenant has raised an issue (hold_flagged_at).
Tested (rolled back): rent 40% then cap refusal at +30%, refund refused, final release -> landlord total = full rent exactly;
sale 50% + final = full net; RTO payment 25% + final = full net.
