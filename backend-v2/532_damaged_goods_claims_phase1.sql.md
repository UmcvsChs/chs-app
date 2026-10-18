# 532 — Damaged / faulty goods claims, Phase 1 (applied live 18 Oct 2026)

Applied as migrations `claims_phase1_a_tables`, `b1_helpers_execute`, `b2_party_rpcs`, `b3_admin_getters_rider`, `b4_open_status`.

## Tables (RLS on, no policies: all access through SECURITY DEFINER functions)
marketplace_claims, claim_evidence, claim_events, claim_rider_links, seller_recoveries.
New columns: marketplace_direct_orders.original_amount / original_quantity / refunded_amount;
marketplace_shipments.packing_photos (text[]) / claim_delivery_refunded.
Storage: policy `claim_files_read` on storage.objects (private-documents) via `_can_view_claim_file(name)`: buyer, seller of the claim, admin; also packing photos of a shipment for its buyer/seller.
Uploads go under `<uid>/claims/...` and `<uid>/packing/...` (existing own-folder upload policy).

## Settings (platform_settings, defaults)
claim_fund_cap 200000 · claim_window_visible_hours 48 · claim_window_fault_days 7 · claim_seller_reply_hours 48 · claim_door_reply_hours 24 · claim_buyer_reply_hours 48 · claim_chs_working_days 3 · claim_second_approver_amount 500000 · claim_early_release_max_rate 3 · claim_warn_rate 3 · claim_review_rate 5 · claim_min_photos 2 · claim_rate_min_orders 5

## Functions
Buyer: buyer_open_claim, claim_add_evidence, buyer_withdraw_claim, buyer_answer_offer, buyer_confirm_replacement.
Seller: seller_respond_claim (accept / offer / dispute), seller_mark_replacement_sent, claim_create_rider_link, vendor_mark_packed(uuid,text[]) (fragile goods need 2+ photos; 1-arg version kept).
Admin: admin_get_marketplace_claims, admin_claim_preview, admin_decide_marketplace_claim, admin_second_approve_claim, admin_confirm_claim_return, admin_return_to_review.
Shared: get_claim, get_my_marketplace_claims, get_vendor_marketplace_claims.
Public (no login): claim_rider_get, claim_rider_submit (one-time token, 7 days).
Internal: _claim_calc (the one money calculation used by preview and execution), _claim_execute, _claim_finalise, _claim_release_guard, _vendor_claim_rate, _order_claim_open, _sweep_claims (pg_cron `sweep-claims`, hourly at :07).
(The older get_my_claims() belongs to another feature and was left untouched.)

## Money rules implemented
- Fault seller: the line is reduced in place (amount, quantity, both commissions; original_* kept), buyer gets goods + buyer-commission share (+ delivery share only if the whole shipment fails); seller wallet debited (also for amounts already released); any shortfall is recorded in seller_recoveries.
- Fault chs_transit / unclear: the seller keeps the payment; the buyer is refunded by CHS (Delivery Protection Fund, recorded as fund_paid; above the cap needs a second approver).
- Fault buyer: bank processing fee withheld from the commission share.
- Refunds above the second-approver amount need a different admin.
- While a claim is open: admin_release_order_percentage, release_direct_order_to_vendor and refund_direct_order_to_buyer refuse. Part-release is also refused until the 7-day fault window has ended and when the seller's 90-day claim rate is above 3%.
- Sweep: seller silent 48h (door 24h) → CHS decides; buyer silent on an offer 48h → CHS decides; CHS decision overdue after 3 working days → flagged and admins notified.

## Tested (rolled-back blocks)
photo minimum, duplicate guard, seller sees buyer first name only, release/refund blocks, preview, reason required, partial refund numbers (₦96,000 line, 3 of 30 units: buyer +₦10,176, line → ₦86,400), released-order clawback with short wallet (debt ₦42,160), door claim + second approval (₦798,110 incl. ₦17,950 delivery), rider link one-time, sweep, replacement path.
