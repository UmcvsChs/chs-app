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
- **Migrations:** `backend/` (01–10, original schema) and `backend-v2/` (11–68, everything since) — sequential, numbered, meant to be read and applied in order
- **Documentation:** `CHS_USERS_GUIDE.docx` (+ in-app `/guide`), `CHS_COMPLETE_FEATURE_CATALOG.pdf` (+ in-app `/admin/feature-catalog`, + segmented `CHS_FEATURE_CATALOG_SEGMENTED.xlsx`), this handover note, and the progress log

## 3. Real Architectural Patterns Established

A new agent should follow these, not reinvent them:

- **RLS via `staff_can_access(domain)`** — every admin-facing table checks a real staff domain (`finance`, `customer_care`, `registration_setup`, `owner_buyer_tenant`, `agent_relations`, `artisan_dev_pm_vendor`), not a blanket "is admin" check. `finance` is deliberately not assignable to any sub-admin — Super Admin only, by design.
- **High-stakes actions go through a real approval queue**, not a direct write. See `request_admin_action()` / `apply_admin_action()` / `resolve_admin_action()` in `backend-v2/51_subadmin_roles_and_approval_queue.sql` onward. Anything financial or verification-related must route through this, not a raw table update.
- **Test data is always explicitly marked**, never silently mixed with real data. Pattern: `is_test_grant boolean` columns, `TEST-` prefixed references, and description text starting with `⚠️ TEST FUNDING`. Follow this pattern for any future test data.
- **Real, not simulated, verification.** Bank accounts are checked against Paystack's real account resolution API before they can be linked (`resolve-bank-account` Edge Function) — never trust a self-typed account name again.
- **Money-moving Edge Functions never trust client-supplied amounts.** Real fees are read server-side from `platform_settings`, not passed from the browser.
- **Apply every migration directly to the live database as it's built**, and test with real data (using `set role authenticated` + `set_config('request.jwt.claims', ...)` to simulate a real user's RLS context) before considering it done. Supabase is always current; GitHub/Netlify only reflect the latest zip once actually pushed — these are two separate things on two separate schedules.

## 4. Known Gaps — Read Before Assuming Something Works

- **No real recurring billing exists for any promotion package** (Classic/Premium/Elite/Signature), including Signature specifically. The database rows and pricing exist; the actual Paystack subscription charge was never built. Anyone assigned one of these packages today is effectively getting it free.
- **Pre-launch admin test mode** (Admin → Overview → "Switch role for testing") and the **Construction Roadmap test-unlock button** are both explicitly temporary. Remove both — and the underlying `grant_roadmap_access_test()` function — before real launch.
- **Test accounts and test data exist in the live database** — most notably `CHS Test Account` (phone `08000000001`) with a ₦200,000 test-funded wallet and a test property, created specifically for promotion-feature testing. Clean up or keep, but know it's there and clearly marked.
- **True server-side pagination was never built.** The homepage and admin queues are capped (e.g. `.limit(300)`), not genuinely paginated — fine for now, will need real work as the catalog grows.
- **Paystack is still on a test key.** Real payments do not move real money yet.
- **No custom domain configured.** Still on the default Netlify subdomain.
- **Database backups / point-in-time recovery on Supabase — never confirmed.**
- **No uptime or error monitoring** — an outage today would be discovered from a user complaint, not an alert.
- **13 of the original 16 app views were never systematically compared against the original design spec** (a note from the very first handover, still open).

## 5. Where to Find Things

- **Every real feature, cross-referenced to its admin location:** `CHS_COMPLETE_FEATURE_CATALOG.pdf`, the segmented `.xlsx`, or in-app at `/admin/feature-catalog` (always current, same source data as the PDF).
- **How to use the app, by role:** `CHS_USERS_GUIDE.docx` or in-app `/guide`.
- **Resolving a specific user's support issue:** Admin → 🔎 Trace an Account — search by phone/email/name, see their full wallet, promotion, roadmap, and Engage CHS history in one place.
- **What a sub-admin did and when:** Admin → Overview → "View sub-admin action history."

## 6. Standing Discipline Going Forward

Every future batch of work should:
1. Apply real migrations directly to the live Supabase database, and test with real data before considering it done.
2. Update `CHS_PROGRESS_LOG.md` with what was actually done.
3. Update this handover note if a new architectural pattern, gap, or critical fact emerges.
4. Update the Users Guide and Feature Catalog (both formats) if user-facing or admin-facing functionality changed.
5. Rebuild and verify (lint + full production build) before packaging anything for GitHub/Netlify.
