# CHS — Progress Log

**Compiled:** August 25, 2026 — retroactively, covering the full engagement to date. Ordered by real migration sequence (`backend-v2/46` through `68`), which reflects the true order work was done in. Going forward, add a new dated entry at the top each time a real batch of work completes — don't rewrite history above it.

**Companion document:** `CHS_HANDOVER_NOTES.md` — read that one first for orientation.

---

## Migrations 46–49 — Promotion, Concierge, Urgent Sale, Performance
- Built the credit-based geo-tiered listing promotion system (real per-location, per-size daily cost; toggle on/off; relative ranking against the same real local market).
- Built Concierge ("Talk to an Agent") — free-text or voice property requests routed to admin.
- Built Urgent & Emergency Sale — real discounted, time-boxed listings with a genuine deadline.
- Real performance pass: missing indexes, pagination caps on unbounded queries, fixed a real N+1 query pattern on the owner dashboard.

## Migration 50 — Wallet Fixes & Admin Login Approval
- **Found and fixed a real, exploitable security hole:** wallets could previously be updated directly by their own owner via a raw API call — a user could set their own balance to anything. Locked down to read-only; all writes now go through audited functions.
- Built real wallet auto-creation on profile creation (previously, new users had no wallet at all).
- Built real user-to-user wallet transfer.
- Built code-based admin login approval — a sub-admin's password alone no longer reaches the dashboard; a real approval code goes to the Super Admin.

## Migrations 51–52 — Sub-Admin Roles & RLS Scoping
- Built the five real sub-admin domains (Customer Care, Registration & Setup, Owner/Buyer/Tenant, Agent Relations, Artisan/Developer/PM/Vendor) and the high-stakes approval queue.
- Extended real RLS scoping across most admin-facing tables to respect these domains, replacing the old blanket "is admin" check.

## Migrations 53–55 — Notification & Data Correctness Fixes
- Fixed a real bug: property-verification and artisan-verification notifications used the wrong column name and would have silently failed.
- Fixed interested-party notifications to fire at the correct point in the new approval-queue flow.
- Built `assign_staff_role()` for promoting an existing account to a sub-admin role.

## Migration 56 — Buyer/Tenant Readiness Score
- Built a real, non-punitive "readiness" signal for owners reviewing inspection requests — verification status, a real questionnaire, and genuine inspection attendance history. Explicitly not a fee or a gate, per direct instruction.

## Migration 57 — Construction Roadmap
- Built real quantities (blocks, roof area, floor area) for 7 real building configurations, a real permits checklist, a real payment milestone plan, and a sourced cost-range estimate, gated behind a one-time unlock fee credited toward the real project if the client proceeds.

## Migration 58 — Standard Package Pricing
- Assigned real, defensible pricing to the Classic/Premium/Elite promotion tiers (Essential and Signature already had real pricing). **Note: pricing exists, but no purchase/subscription flow was ever built for these — see Handover Notes, Known Gaps.**

## Migration 59 — Terms Gate & Guide Tracking
- Built the real scroll-to-accept Terms & Conditions gate (checkbox only unlocks after genuinely reaching the bottom).
- Built the role-specific first-dashboard guide popup.

## Migration 60 — Literal Top 10/Top 20 Ranking
- Extended the relative A–D ranking system with a literal position (e.g. "#3 of Top 10"), scaled to how many real competitors actually exist in that specific local market.

## Migration 61 — Comprehensive Bank List
- Replaced a ~13-bank hardcoded dropdown with a live, searchable list of 200+ real Nigerian banks pulled from Paystack's own directory.
- Fixed a real bug: a changed bank account was never actually applied after its real 48-hour security window — it only ever blocked withdrawals during the window.

## Migrations 62–63 — Testing Infrastructure
- Installed the `http` Postgres extension to enable direct testing of Edge Functions from within the database.
- Built the Construction Roadmap test-unlock mechanism (`is_test_grant`), Super Admin only, explicitly temporary.

## Migration 64–65 — Engage CHS Overhaul
- Built real material/finish specification fields, a genuine summary-before-submission review screen, a real two-way message thread (fixing a real gap where admin could ask for more detail with no way for the client to reply), voice-to-text replies, a dedicated unread badge, and a real document delivery system (checklist, upload, status tracking).
- **Found and fixed a real permission bug in the same batch:** the document-upload function was originally built admin-only, which would have silently blocked every client from using the new document checklist at all.

## Migration 66 — Editable Profile & Re-Verification
- Built real profile editing (name, phone, address, state) — previously impossible entirely.
- A genuine name change now automatically resets ID/liveness verification, since the original verification was for the old name.
- Fixed bank-account name matching from an exact-string requirement to a real word-subset match, so a missing middle name no longer incorrectly blocks a legitimate account link.

## App-Wide Fixes (Not Tied to a Single Migration)
- **Root-caused and fixed a real, structural dark-mode bug:** form fields had no explicit text color, so they silently inherited the page's theme color — in dark mode, near-white text on a white field background, genuinely invisible. Fixed globally, once, for every field on every page, present and future.
- Redesigned the splash screen and app icon — the original had too much padding, making Android's auto-generated launch splash look small and empty.
- Built a real bank-account-number verification step (`resolve-bank-account` Edge Function) — an account number is now checked against the real bank network before it can ever be linked; a wrong digit is rejected immediately.

## Migrations 67–68 — Trace an Account & Final RLS Hardening
- **Found and fixed a real, second RLS gap while building the Trace tool:** several genuinely financial tables (wallet transactions, promo credits, construction roadmap payments, linked bank accounts) were still using the old blanket admin check, meaning any sub-admin — not just Super Admin — could read that data directly. Tightened to `finance`-domain only.
- Built "Trace an Account" — search any real user by phone/email/name and see their full activity across every system in one place, directly answering the real support scenario of "this happened, but nobody can find the record of it."
- Built a real, permanent audit-history view for the sub-admin approval queue — previously, once a request was resolved, it simply vanished with no trace.

## Documentation Batch
- Built the Users Guide (in-app `/guide` and downloadable `.docx`) — genuinely didn't exist before this engagement.
- Built the Complete Feature Catalog — PDF, segmented `.xlsx` (one real chapter per role), and in-app `/admin/feature-catalog` — all reusing the same source data, kept consistent by construction rather than by manual syncing.
- Built this Progress Log and the companion Handover Notes.
