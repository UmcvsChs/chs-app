# 535 — Logged-out visitors can no longer call money, admin or internal functions (applied 18 Oct 2026)

Before: ~300 SECURITY DEFINER functions (pay_*, release_*, refund_*, admin_*, internal helpers such as _pay_booking_core) were executable by the
logged-out "anon" role. Most checked auth.uid() inside, but the internal helpers did not all.
Now: execute is revoked from PUBLIC and anon on all of them, granted to authenticated and service_role. Signed-in users are unchanged.
Kept for anon (public pages and links): is_admin, staff_can_access, buyer_has_offer_on_property, rto_buyer_can_read_file (used in storage/RLS policies),
claim_rider_get/submit, get_public_hotel_page, get_listing_trust, get_property_availability, get_available_room_types, properties_free_for_dates,
get_viewing_slots, verify_chs_agent, verify_chs_tag, ical_feed, tenant-invite and guarantor links, get_split_by_code, get_property_sold_status,
get_property_rating_summary, get_price_history, get_chs_counts, venue profiles, get_offered_services, delivery preview/hints, get_move_in_cost,
get_agent_badge, fee pct helpers, has_roadmap_access, reset_pin_with_nin_verification, receipts, suggest_free_dates, get_related_party_name.
Result: 39 functions remain anon-callable (was ~300). If a logged-out page ever fails with "permission denied for function X", add X back with
`grant execute on function X to anon;`.
Left alone on purpose: views owner_rental_applications / owner_offers (deliberate masked owner views, not readable by anon);
leaked-password protection (do NOT switch on: logins use 6-digit PINs as passwords and it would reject common PINs).

## Addendum — PIN reset hardening (18 Oct 2026)
reset_pin_with_nin_verification was open to anyone with a phone number + NIN, with no limit on guesses, different error messages that revealed
which phone numbers have accounts, and it could reset admin PINs. Now: 5 wrong tries per phone per hour then locked (table pin_reset_attempts),
one generic error message, admin/staff accounts refused (super admin handles them), every reset is audited and the owner is notified.
It now RETURNS {success, message} instead of raising (so failed tries are really recorded); app/forgot-pin/page.tsx reads that.
get_checkout_receipt, get_receipt_data and get_split_by_code also removed from anon (they already required sign-in).
