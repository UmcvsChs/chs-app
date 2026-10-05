-- ============================================================================
-- 455 — everything between guest and host goes through CHS (applied as 455a, 455b)
-- ============================================================================
-- STANDING RULE: CHS relays every request and message between the parties, in every category.
-- Step 3 had broken it in three ways, all now corrected:
--  1. Urgent ("soon" and "express") booking requests were relayed to the host instantly.
--     NOW every lane waits for CHS. A short fallback auto-relay remains only as a safety net so a
--     guest is not stranded if nobody is on duty: standard 4h, soon 30 min, express 10 min
--     (platform_settings booking_relay_minutes_<lane>; booking_manual_relay_all = 'true').
--     Admin gets a distinct, loud alert per lane, and another when a fallback fires.
--  2. Guest and host could chat freely (send_shortlet_message delivered instantly, no filter, and
--     the notification carried the full text). NOW: phone numbers / emails are refused for everyone;
--     until the booking is paid every message waits for CHS review, and row security stops the
--     other side from reading it; after payment messages are delivered at once but still filtered;
--     platform_settings shortlet_message_moderation = 'always' keeps CHS review for paid bookings
--     too. Direct inserts into shortlet_messages are no longer possible (RPC only). Admin functions:
--     get_pending_shortlet_messages / approve_shortlet_message / reject_shortlet_message (reason
--     required; sender is told). Same pattern as pre-commit offer messages (migration 113).
--  3. Hosts were shown the guest's phone number on three screens. NOW they see the guest's name and
--     a CHS reference (REQ-xxxxxxxx) only; get_my_booking_requests no longer returns the phone.
--
-- SHARED FILTER FIXED: detect_offplatform_contact() counted EVERY digit in a message, so ordinary
-- booking chatter ("arriving 14/10/2026 at 18:30 with 4 guests, 2 rooms") was blocked as a phone
-- number. It now ignores dates and clock times and looks for a phone-shaped run; disguised numbers
-- (spaced, dashed, +234, digit by digit, hidden in dashes) and emails are still caught. Tested on
-- 13 phrasings. It is shared with offers and the marketplace, so they benefit too.
--
-- Function bodies are in the database (see pg_get_functiondef). Patches to request_shortlet_booking,
-- request_event_booking, relay_booking_to_host and get_my_booking_requests were made as CHECKED TEXT
-- REPLACEMENTS of their stored definitions (the migration aborts if one does not apply).
--
-- ----------------------------------------------------------------------------
-- PHASE 2 — APPLIED (as 455c, 5 October 2026), after the new version of the app went live.
-- Hides the guest's phone number and ID document from hosts at the DATABASE level. Signed-in
-- users can read every column of shortlet_bookings EXCEPT guest_phone and guest_id_document_url;
-- a signed-out visitor can read none. Admin sees the phone through the admin server functions
-- (they run with owner rights). Row security is unchanged.
-- Verified before applying (rolled-back trial) and after, through the real web API: the host's
-- dashboard query works (HTTP 200); asking for guest_phone or select * is refused (403); the
-- guest's own My Bookings query works; a signed-out visitor is refused (401); request, relay,
-- host-confirm, pay and the admin queue all still work.
-- NOTE: any NEW column added to shortlet_bookings must be granted explicitly:
--   grant select (new_column) on public.shortlet_bookings to authenticated;
-- To undo:  grant select on public.shortlet_bookings to authenticated, anon;
-- ----------------------------------------------------------------------------
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ') into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'shortlet_bookings'
    and column_name not in ('guest_phone', 'guest_id_document_url');
  execute 'revoke select on public.shortlet_bookings from authenticated, anon';
  execute format('grant select (%s) on public.shortlet_bookings to authenticated', cols);
end $$;
