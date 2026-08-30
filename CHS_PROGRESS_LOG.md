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

## Migrations 69–76 — Reminder Engine, Estate Management, Extended Commission Model
- Built the Reminder Engine — one real, generic escalation system instead of a narrow "rent reminder" feature: real escalating rent-due cadence, real maintenance follow-up escalation (artisan → manager), multi-channel delivery (in-app confirmed working immediately; SMS via Termii and email via Resend added once real provider accounts and sender-ID approval were in place).
- Built the Estate Management System foundation — Estates as a real, first-class entity distinct from individual property delegation: real unit linkage, real service charges (genuinely separate from rent), bulk CSV unit onboarding, a real manager dashboard aggregating occupancy/disputes/maintenance/collections in one place.
- **Corrected a real, invented commission figure:** an initial 5%-seller-only sale commission was built from a guess rather than checked documentation. The client's real, previously-confirmed reference document was found and used instead — Sale: 6.5% Buyer / 6% Seller; Rental: 5% Tenant / 5.5% Landlord — replacing the incorrect version entirely.
- **Found and fixed a real, deeper gap while correcting the commission:** approving a rental application never actually created a real tenancy anywhere in the app — it only flipped a status label. Now genuinely creates the tenancy and generates the correct two-sided commission in one atomic step.
- Extended the commission model to Warehouse, Factory, Land, and Farmland (confirmed these need zero new code, since existing functions never filtered by property type), and built the genuinely new Hire/Booking tier for Event Centre, Hotel & Lodge, and casual Car Park (flat rate), plus a real length-of-stay sliding scale specifically for Shortlet — both sourced from a real extended commission reference document and refined through direct client confirmation on the exact rates and pay-direction (guest pays the higher share throughout).
- Built real Estate Management subscription tiers with genuine monthly billing, refined upward through direct client feedback on real-world SaaS pricing psychology.

## A Comprehensive, Three-Phase Audit — 23 Real Issues Found and Fixed
Prompted by a direct client request for a full, systematic audit after several real wiring gaps surfaced during normal feature work. Conducted in three phases, all with real test data, not assumptions:

**Phase 1 — Wiring audit:** every RPC call, table reference, and Edge Function call across the entire frontend cross-referenced against what genuinely exists in the live database. Came back completely clean. Found and fixed 5 real TypeScript type-file drift issues (Property, Wallet, ShortletBooking, FaultReport types missing real database columns, including some added within this same engagement and never typed).

**Phase 2 — RLS coverage audit:** every table checked for real, correctly-scoped access control. Found and fixed 4 real domain-scoping gaps (`agent_referrals`, `property_documents`, `reminder_rules`, `scheduled_reminders` all using a blanket admin check instead of the correct restriction).

**Phase 3 — Real end-to-end journey testing, the most consequential phase.** Revealed a genuine, repeated pattern: an admin-facing "approve/confirm/mark paid" action that updated a status and stopped, with no real financial consequence ever following through. Found and fixed **7 real instances of this exact pattern**:
- Shortlet host payment never actually released from escrow after check-in confirmation
- No mechanism anywhere for a tenant to actually pay real rent to a landlord
- No mechanism for an artisan to actually get paid for approved maintenance work, and no way to ever mark a job "resolved"
- A dispute ruling only ever sent a notification saying who "won" — the real disputed amount never moved
- Marking a vendor referral fee "paid" never actually charged the vendor
- Agent-to-agent referral commission had no real payout mechanism at all — not even a broken one, just entirely unbuilt
- Approving a developer application never elevated the applicant's real account role, and had no way to even reach its own real success state

Also found and fixed in Phase 3: management delegation could only ever be turned on, never off (built the real, missing 30-day-notice termination flow); Urgent Sale price reductions never reverted when the deadline passed, permanently discounting a property (fixed, plus a second bug where the expiry notification only fired for listings expiring exactly one day prior, silently missing any backlog); a frozen wallet's withdrawal attempt showed a misleading "insufficient balance" message instead of the real reason. Confirmed genuinely correct and untouched: inspections → readiness score, Construction Roadmap unlock, promotion credit daily billing, and the WebAuthn cryptographic implementation itself (though its domain configuration could not be verified directly, since secret values are never readable once set).

## Rent to Own / Mortgage — A Genuinely New Category
- Distinguished clearly for the client: "Hire" (the short-term booking commission tier) and "Mortgage" (progressive ownership) are not the same thing, and Mortgage never existed as a real feature — only unused, unwired schema fields.
- Built as "Rent to Own / Mortgage," a real, selectable listing category: real monthly installment payments, real ownership-percentage tracking, automatic conversion to a completed sale at 100% ownership, and the same real commission mechanism as every other category.
- Found and fixed a real gap during frontend wiring: the central label function used everywhere to display "For Sale"/"For Rent" had no entry for this new category, meaning every real listing of this type would have shown a broken, blank label to actual site visitors — caught before it reached anyone.
- Corrected the real transaction model from "owner directly starts an agreement for a buyer they specify" to a genuine buyer-request → owner-approval flow, matching the same pattern already proven for rental applications.

## Shortlet/Hotel Guest-Host Messaging
- Built the real, previously entirely-missing in-app communication system for Shortlet and Hotel bookings, with genuine host anonymity toward the guest specifically (never toward CHS), and a real 12-hour escalation to admin when a host doesn't respond, reusing the exact Reminder Engine infrastructure already proven.
- Caught and fixed a real column/value misalignment bug in the escalation function's own insert statement before it was ever tested — would have silently written wrong data types into the wrong columns.

## Maintenance Reserve — Made Genuinely Functional
- Confirmed, on direct client question, a real three-part gap: the Maintenance Reserve could never be externally funded, was never actually the real source of artisan maintenance payments despite existing for that purpose, and could never be withdrawn on its own.
- Fixed all three: real fund-from-main-wallet transfer, real artisan payment logic that draws from the reserve first and only falls back to the main wallet for a genuine shortfall, and real, unrestricted withdrawal of unused reserve funds back to the main wallet.

## Real, Login-Able Demo Accounts
- Built 10 genuine, fully-verified user accounts (not simulated) across five categories — Land, House, Office, Hotel, Shortlet — each a real seller/buyer or host/guest pair, with real listings live and real wallet balances funded, so the client could manually click through negotiation, payment, and commission deduction themselves rather than have it demonstrated by the agent.

## A Real Gap in the Documentation Process Itself, Found and Fixed
- Discovered that every migration from 77 through 95 — covering the entire audit and everything built afterward — had been applied directly to the live database and thoroughly tested there, but never actually saved as a file in the exportable project repository. The packaged zip and the live database had quietly drifted apart for several rounds of work.
- Reconstructed and saved all 17 real migration files with their exact, already-tested content, and verified their presence directly inside the final zip rather than assuming the fix worked.

## Documentation Refresh — Progress Log, Handover Notes, Users Guide, T&C, Feature Catalog
- Updated the Terms & Conditions with the real, complete commission structure across every category, plus new clauses for Rent to Own, Estate Management subscriptions, Shortlet messaging, and the Maintenance Reserve.
- Updated the Users Guide (in-app and `.docx`) with two new real sections — Rent to Own/Mortgage and Estate Management — and extended the Wallet and Shortlet sections.
- Updated the Feature Catalog (PDF, segmented `.xlsx`, and in-app data) with a new 10th chapter covering every system built since the last update.
- **A real mistake caught and fixed in the same breath:** after correctly updating this Progress Log and the Handover Notes, a careless `cp` command overwrote both freshly-updated files with their own stale originals from a different folder, silently destroying the update. Caught by verifying the actual file content after packaging, rather than assuming the edit had survived — redone correctly immediately after.

## Real Client Testing — Round One (Land Category)
The client began genuine, manual testing using the real demo accounts, and reported several findings directly from real use — every one investigated and either fixed or confirmed correct with real data, not assumed either way:
- **Identity verification self-certified instead of ever reaching admin** — a buyer's real ID submission immediately marked itself "verified" the moment the form was filled in, with no real admin review step and no record for admin to ever see. Rebuilt as a genuine pending → admin-review → approved flow, matching the proven liveness-verification pattern. Two real, separate constraint bugs (a missing domain mapping and a missing allowed action type) caught and fixed by testing the full flow end-to-end, not just the new function in isolation.
- **No logout reachable from anywhere except the homepage on mobile** — confirmed directly in the code: the real `signOut` function was only ever wired into the homepage's own header. Added a real, working logout to the persistent bottom navigation's "More" menu.
- **House Rules appearing on a land sale listing** — confirmed exactly as reported: the component rendered unconditionally for every property regardless of purpose. Fixed to only appear for Rent, Lease, Shortlet, and Rent to Own — the categories where an ongoing occupancy relationship genuinely exists.
- **The real mobile page-width bug, investigated twice.** First found and fixed: no viewport meta tag existed anywhere in the app, causing every mobile browser to assume a desktop-width canvas — this very likely explained both the sideways-scrolling homepage and the off-center splash screen (both governed by the same real viewport calculation) in one fix. When the client reported the issue was reduced but not fully gone, applied the standard second half of this class of fix — constraining horizontal overflow at the root `html`/`body` level — since the viewport tag alone doesn't protect against a single element elsewhere on the page being slightly wider than the screen. Awaiting the client's next real-device confirmation.
- **The in-house "similar properties" advertising system already existed** — a pleasant surprise, not a gap — but real testing surfaced a genuine bug: the "near you" section's label promised area-level proximity while the actual query only ever matched the whole state, and never filtered by property type, once surfacing an unrelated multi-million-naira duplex under a land listing. Rebuilt with genuine progressive widening (exact area → LGA → state), verified tier-by-tier against real data to confirm the cascade behaves correctly.
- **No communication box for a seller responding to an offer** — the buyer already had one; the seller only had accept/decline. Added a real, optional message box whose contents are what the buyer actually receives in their notification.
- **The rent countdown and 90-day non-renewal notice, discussed earlier in the project, had never actually been built** — confirmed the real database column (`notice_given_at`) existed but nothing anywhere read or wrote it. Built a real, live day-count on the tenant dashboard and a genuine notice mechanism that honestly tells the landlord whether notice came within or after the requested 90-day window, tested against the client's own example numbers.
- **Demo login credentials delivered as a real, downloadable Word document** rather than requiring the client to keep scrolling through chat — caught and fixed a real rendering defect (an invisible header row) before delivering it.

## The Real Sale Payment Mechanism — The Most Significant Finding of the Engagement
Direct client testing surfaced something that had gone unnoticed through the entire prior audit: **every commission test this whole engagement had run was correct, but sitting on top of a transaction that never had a real way for a buyer to actually pay a seller the purchase price.** Only commission had ever been tested; the core transaction itself had no payment button anywhere.
- Built a single, transparent checkout: the buyer's real total automatically includes their own commission (shown as both a percentage and a real Naira value, never one without the other); the seller's real net (price minus their own commission) is calculated and paid automatically.
- Tested with the client's own real numbers: a ₦34,500,000 offer produced a real total due of ₦36,742,500 for the buyer and a real net of ₦32,430,000 for the seller — funding the buyer to exactly ₦35,000,000 (the client's own instruction) correctly failed, with the system honestly stating the real amount still needed, rather than an ambiguous error.
- A real bug caught before delivery: the commission-breakdown function initially referenced the wrong `platform_settings` key names and silently returned blank percentages — found by testing the actual output, not by reading the code.

## Real, Sourced Legal Document Requirements and an Escrow Hold on Sale Proceeds
Following directly from the payment mechanism above, the client asked for real protection: a seller should not be able to touch sale proceeds until the actual legal transfer of a property is confirmed complete.
- Researched the real, current legal requirements for a Nigerian property sale from genuine, cited sources (Lexology, PropertyPro, Diya Fatimilehin & Co, and others) rather than inventing a list: Certificate of Occupancy, Deed of Assignment, Survey Plan, Governor's Consent, Tax Clearance Certificate, Sale Agreement, and — conditionally, only for a property with a real structure on it — Building Plan Approval.
- Built a real requirement: an owner must upload soft copies of every required document when listing under Sale; CHS genuinely verifies each one; a buyer's payment is blocked entirely until every required document for that specific property is confirmed verified — tested by deliberately verifying 5 of 6 required documents and confirming payment still correctly failed, then verifying the 6th and confirming it succeeded.
- Built a genuine escrow hold: a seller's real proceeds land in a wallet balance that is visible but not withdrawable, confirmed directly by testing that the real withdrawal function could not touch it. Funds only move to the seller's spendable balance once CHS explicitly confirms the real, physical legal documents have been transferred to the buyer — tested with a real, separate account genuinely lacking admin rights, confirming it could not release the funds itself.
- Made Building Plan Approval a genuinely conditional requirement rather than either always-required (wrong for raw land) or optional everywhere (wrong for a house) — caught and fixed a real array-syntax bug in this logic through testing before it reached the client, then proved both real cases (a land listing correctly requiring 6 documents, a house correctly requiring 7) with real data.
- Updated the seller's own button to read "Offer Accepted — Proceed to Payment," and the buyer's notification to point them directly back to the real payment screen, per direct client request.
- Two further real constraint bugs caught during this same testing pass: a wallet transaction type that didn't yet allow the new escrow balance, and a repeated transaction-rollback pattern where combining a real update with a subsequent failing call in the same batch silently undid the update — both found and fixed by verifying actual database state after each step, not by trusting a query had succeeded.

