# CHS — Handover Notes

**Compiled:** August 25, 2026 — retroactively, covering the full engagement to date. This document did not exist before this point; going forward it should be kept current alongside every batch of work, the same discipline already applied to the Users Guide, Terms & Conditions, and Feature Catalog.

**Companion document:** `CHS_PROGRESS_LOG.md` — a chronological record of what was built, in order. Read this file first for orientation, then the log for the detailed sequence.

---

## 1. What CHS Is

Complete Housing Solutions (CHS) — a Nigerian real estate PWA covering the full property journey: buying, renting, leasing, shortlet booking, and property sales, currently focused on Kaduna State. CHS is a genuine facilitator, not a passive listings board — it verifies documents and identities, holds funds in real escrow, and runs its own dispute-resolution process.

## 2. Stack & Repository

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS — repo folder `chs-v2/`
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions), project ref `havwhdgjqgtxtqklkqfm`
- **Payments:** Paystack — currently on a **test key** (`pk_test_...`), not yet switched to live
- **Hosting:** Netlify, connected to GitHub for auto-deploy (confirm this is still true before assuming a push auto-deploys — it was manual drag-and-drop earlier in the project's history)
- **Migrations:** `backend/` (01–10, original schema) and `backend-v2/` (11–95, everything since) — sequential, numbered, meant to be read and applied in order
- **Documentation:** `CHS_USERS_GUIDE.docx` (+ in-app `/guide`), `CHS_COMPLETE_FEATURE_CATALOG.pdf` (+ in-app `/admin/feature-catalog`, + segmented `CHS_FEATURE_CATALOG_SEGMENTED.xlsx`), this handover note, and the progress log

## 3. Real Architectural Patterns Established

A new agent should follow these, not reinvent them:

- **RLS via `staff_can_access(domain)`** — every admin-facing table checks a real staff domain (`finance`, `customer_care`, `registration_setup`, `owner_buyer_tenant`, `agent_relations`, `artisan_dev_pm_vendor`), not a blanket "is admin" check. `finance` is deliberately not assignable to any sub-admin — Super Admin only, by design.
- **High-stakes actions go through a real approval queue**, not a direct write. See `request_admin_action()` / `apply_admin_action()` / `resolve_admin_action()` in `backend-v2/51_subadmin_roles_and_approval_queue.sql` onward. Anything financial or verification-related must route through this, not a raw table update.
- **Test data is always explicitly marked**, never silently mixed with real data. Pattern: `is_test_grant boolean` columns, `TEST-` prefixed references, and description text starting with `⚠️ TEST FUNDING`. Follow this pattern for any future test data.
- **Real, not simulated, verification.** Bank accounts are checked against Paystack's real account resolution API before they can be linked (`resolve-bank-account` Edge Function) — never trust a self-typed account name again.
- **Money-moving Edge Functions never trust client-supplied amounts.** Real fees are read server-side from `platform_settings`, not passed from the browser.
- **Apply every migration directly to the live database as it's built**, and test with real data (using `set role authenticated` + `set_config('request.jwt.claims', ...)` to simulate a real user's RLS context) before considering it done. Supabase is always current; GitHub/Netlify only reflect the latest zip once actually pushed — these are two separate things on two separate schedules.
- **Always save every migration as a real local file in `backend-v2/`, the same moment it's applied to the live database — never apply-only.** A real, serious gap was found and fixed: migrations 77 through 95 were applied and tested live but never saved as files, meaning the exportable project and the live database quietly drifted apart for several rounds of work. Verify the file count directly inside a packaged zip before calling a package complete — don't assume the fix worked.
- **An "approve/confirm/mark paid" action must trigger its real consequence, not just update a status.** A comprehensive audit found 7 separate real instances of the same bug: a status changed and a notification fired, but no money, role, or state actually moved. Whenever building or reviewing any approval-style action, explicitly ask "what real thing is supposed to happen now, and does this code actually do it" — then prove it with a real before/after balance or state check, not just a read of the code.
- **When copying a "finished" documentation file between folders, always copy FROM the just-edited version TO the other location — never the reverse.** A real mistake happened doing exactly this backwards: freshly-updated Progress Log and Handover Notes were overwritten by their own stale originals from a different folder. Verify file content after any cross-folder copy, not just that the copy command succeeded.

## 4. Known Gaps — Read Before Assuming Something Works

**Fixed since the last version of this document** (kept here briefly so a new agent doesn't waste time re-discovering these): shortlet host payout never released from escrow; no way for a tenant to pay real rent; artisan maintenance payments and job resolution never worked; dispute rulings had no real financial consequence; vendor referral fees and agent referral payouts were never actually charged/paid; developer application approval never elevated a real account role; management delegation could never be turned off; Urgent Sale pricing never reverted after expiry. All 23 are detailed in `CHS_PROGRESS_LOG.md`.

**Still genuinely open:**

- **No real recurring billing exists for any promotion package** (Classic/Premium/Elite/Signature), including Signature specifically. The database rows and pricing exist; the actual Paystack subscription charge was never built. Anyone assigned one of these packages today is effectively getting it free.
- **Pre-launch admin test mode** (Admin → Overview → "Switch role for testing") and the **Construction Roadmap test-unlock button** are both explicitly temporary. Remove both — and the underlying `grant_roadmap_access_test()` function — before real launch.
- **A real, substantial set of demo accounts exist in the live database**, built specifically so the client could manually test negotiation → payment → commission across categories: phone numbers `08050000001` through `08050000010`, PIN `123456` for all, covering Land/House/Office/Hotel/Shortlet buyer-seller and host-guest pairs, with real funded wallets and real live listings. These are clearly marked by name (`Demo Land Seller`, etc.) but are real, fully-verified, functioning accounts — clean up or keep, but know they exist before launch.
- **True server-side pagination was never built.** The homepage and admin queues are capped (e.g. `.limit(300)`), not genuinely paginated — fine for now, will need real work as the catalog grows.
- **Paystack is still on a test key.** Real payments do not move real money yet.
- **No custom domain configured.** Still on the default Netlify subdomain (`extraordinary-conkies-312c3d.netlify.app`) — note that WebAuthn's `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` secrets will need updating to match whenever a real domain is set up, since WebAuthn ties strictly to the exact origin.
- **WebAuthn's domain configuration could not be directly verified.** The cryptographic implementation itself is genuinely solid, but secret values can never be read back once set — only overwritten. If biometric login ever seems to fail for every real user, this is the first place to check.
- **Real architectural design generation does not exist**, and was explicitly confirmed not to be a realistic near-term build — it would require either specialized generative-design/CAD software or real, licensed architects, not standard web development. Engage CHS's document delivery is a real human-upload tracker, not a generator.
- **Database backups / point-in-time recovery on Supabase — never confirmed.**
- **No uptime or error monitoring** — an outage today would be discovered from a user complaint, not an alert.
- **13 of the original 16 app views were never systematically compared against the original design spec** (a note from the very first handover, still open).

## 5. Major Systems Built Since the Last Version of This Document

- **Reminder Engine** (`backend-v2/69`) — one real, generic escalation system: rent-due cadence, maintenance follow-up escalation, and shortlet guest-message escalation, all sharing the same infrastructure. Multi-channel (in-app always works; SMS via Termii and email via Resend depend on real provider secrets being configured).
- **Estate Management** (`backend-v2/70`, `77`, `78`) — Estates as a real entity distinct from individual property delegation, with real service charges, bulk CSV unit onboarding, and a real subscription model (₦20k/50k/110k monthly by unit-count tier, confirmed with the client).
- **The real, complete commission model** (`backend-v2/75`, `76`, `91`) — Sale (6.5%/6%), Rental (5%/5.5%), Shortlet (real sliding scale by length of stay), Hire/Booking flat tier (Hotel/Event Centre/Car park), and Rent to Own/Mortgage (5%/5.5% per installment) — see the actual Terms & Conditions text (`components/TermsContent.tsx`) for the definitive, current numbers, since this is the one place they must never drift out of sync.
- **Rent to Own / Mortgage** (`backend-v2/91`, `94`) — a genuinely new listing category, not the same thing as "Hire." Real installment payments, real ownership-percentage tracking, automatic conversion to a completed sale at 100%.
- **Shortlet/Hotel guest-host messaging** (`backend-v2/92`) — real in-app communication with genuine host anonymity toward the guest, never toward CHS itself.
- **Maintenance Reserve, now genuinely functional** (`backend-v2/95`) — real external funding, real artisan-payment draw order (reserve first, main wallet for any shortfall), real unrestricted withdrawal.

## 6. Where to Find Things

- **Every real feature, cross-referenced to its admin location:** `CHS_COMPLETE_FEATURE_CATALOG.pdf`, the segmented `.xlsx`, or in-app at `/admin/feature-catalog` (always current, same source data as the PDF).
- **How to use the app, by role:** `CHS_USERS_GUIDE.docx` or in-app `/guide`.
- **Resolving a specific user's support issue:** Admin → 🔎 Trace an Account — search by phone/email/name, see their full wallet, promotion, roadmap, and Engage CHS history in one place.
- **What a sub-admin did and when:** Admin → Overview → "View sub-admin action history."

## 7. Standing Discipline Going Forward

Every future batch of work should:
1. Apply real migrations directly to the live Supabase database, and test with real data before considering it done.
2. Update `CHS_PROGRESS_LOG.md` with what was actually done.
3. Update this handover note if a new architectural pattern, gap, or critical fact emerges.
4. Update the Users Guide and Feature Catalog (both formats) if user-facing or admin-facing functionality changed.
5. Rebuild and verify (lint + full production build) before packaging anything for GitHub/Netlify.
