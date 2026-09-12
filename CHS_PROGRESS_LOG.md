# CHS — Progress Log

**Compiled:** August 25, 2026 — retroactively, covering the full engagement to date. Ordered by real migration sequence (`backend-v2/46` through `68`), which reflects the true order work was done in. Going forward, add a new dated entry at the top each time a real batch of work completes — don't rewrite history above it.

**Companion document:** `CHS_HANDOVER_NOTES.md` — read that one first for orientation.

---

## September 10, 2026 (later same day) — Reconciliation after two parallel work sessions collided

An earlier session this same day had independently pushed a consolidated fix package for the same client-supplied 15-item testing list (migrations numbered 246–248 in that session's own count). That work happened in parallel with, and without visibility into, the "Migrations 223–274" session documented immediately below — both sessions solved several of the same real problems independently, with different code and different migration numbers reused at the same numbers. This entry reconciles the two rather than silently picking one.

Studied the full current state directly against the live database before touching anything, rather than trusting either session's own account. Found:

- **Real bug, confirmed and fixed:** the newer session's upload form correctly switched to a `toilets` column (replacing `bathrooms`) for new listings, and the property detail page was correctly updated to show both — but `components/PropertyCard.tsx` (the compact search/browse card) was never updated, so every new listing's search card was silently showing no bathroom/toilet count at all. Fixed: card now checks both fields.
- **Duplicated effort, not a bug:** the earlier session's Virtual Inspection System (a guided photo-tour viewer, `app/virtual-inspection/[id]`) was superseded entirely by this session's real room-video system (`property_videos`, `video_requests`) — a different, reasonable approach to the same goal. The photo-tour code no longer exists in this codebase. The "free alternative exists, are you sure you want a paid physical visit?" consent gate that sat on top of the old photo-tour system did not carry over to the new video system — not currently re-built, flagged here as a known gap rather than re-implemented blind.
- **Merged rather than duplicated:** the earlier session's `InfoTooltip` component and its `lib/featureGlossary.ts` (196 entries, generated directly from CHS's own real feature catalog) were superseded by this session's own `InfoTip.tsx`, built independently and wired to 16 terms by hand. Rather than leave ~180 terms unauthored a second time, `InfoTip.tsx` was extended to optionally accept a `term` key that looks up `lib/featureGlossary.ts` (re-added), fully backward-compatible with all 18 existing hand-written call sites, which are untouched.
- `room_dimensions` (jsonb) from the earlier session's migration is live in the database but referenced nowhere in current code — confirmed dead weight, not harmful, left as-is pending a decision on whether the photo-tour dimension feature is worth rebuilding against the new video system.
- **Rebuilt, not left as a gap:** the "free alternative exists, are you sure?" consent gate, now pointed at the real room-video system instead of the retired photo tour. `PropertyActions.tsx` checks `property_videos` for a real row count per property; when any exist, `InspectionBookingForm.tsx` shows a banner and requires an explicit checkbox acknowledgment before a paid physical inspection can be booked — same enforcement pattern as before (submit button disabled AND a server-side-equivalent check in the submit handler itself, not just a UI suggestion).

---

## September 10, 2026 — Migrations 223–274: extensive real client testing round, admin mediation completed, Audit Trail and Feature Explainer started, real room-video system built

The largest single batch of the engagement, driven by an extensive, real client testing session that surfaced genuine bugs across nearly every part of the app. Full detail in `CHS_HANDOVER_NOTES.md` under "New Since Last Handover Update (migrations 223–274)" — summarized here in the order it actually happened:

1. Notification click-through fixed for real, after two earlier attempts each solved one problem and caused another (`Link`-wrapping a div was fragile; `window.location.href` fixed the click but caused a full, disruptive reload). Final, correct fix: `router.push()` with explicit `stopPropagation`/`preventDefault`.
2. Admin mediation gap closed for rental applications and offers, both directions — a buyer's offer and an owner's decision on it both used to bypass CHS review entirely. Real `awaiting_admin_review` / `owner_decided_pending_relay` statuses now gate both.
3. Buyer bio-data (name, phone, occupation, source of funds) made required at offer submission, visible to admin, deliberately kept off the owner's screen — contact stays mediated through the message thread.
4. The single most serious gap found this round: admin could approve a new listing with zero visibility into its uploaded legal documents. Fixed with real document review directly on the approval card, and a genuine hard block (not just a warning) for Sale properties until every document — and the owner's own ID — is verified.
5. Land and other non-residential categories fixed to never show a bedroom count, regardless of bad underlying data; 36 real listings cleaned.
6. Real room/bedroom/toilet dropdowns and a genuinely repeatable "Others" facility field, replacing plain number inputs.
7. "Processed History" admin tab built — the real backend function for this existed from an earlier round but was never connected to any actual screen; extended to cover property listings and registrations too.
8. Audit Trail started (`audit_log` table, `log_audit_event()`), wired into every high-stakes real action found so far — property decisions, dispute rulings, fund release, account suspension, all admin relay functions, referral payouts, marketplace moderation, agent management. Genuinely ongoing, not finished.
9. Feature Explainer started (`InfoTip` component), live on 16+ real terms across buyer, owner, and tenant screens. Genuinely ongoing.
10. Property manager listing access fixed — managers genuinely could not list a property; agents already could. Matched to the identical pattern.
11. Real room-video system built (`property_videos`, `video_requests`) as a cost-free alternative to a paid virtual-tour service, on both new and existing listings, with a real "request a specific video" flow for an unsatisfied buyer/tenant. Found and fixed three further real gaps purely by exercising the feature end to end after building it — a request tracking page, a direct action link for the owner, and a wrong notification link.
12. Document Site built (`/admin/document-site`) — every current reference document bundled directly into the app.
13. Round 2 demo accounts created (`0812...`, PIN `123456`), then a real login bug found and fixed: raw `auth.users` SQL insertion had left several fields `NULL` where Supabase's real auth service expects an empty string — a documented pitfall of bypassing the Admin API.
14. Per-role zone colors upgraded to match the saturation of the client's own reference palette.

Several real mistakes were made and caught this round — a JSX edit that deleted a needed line, a wrong TypeScript type for a Postgres array-returning join, a garbled shell heredoc that skipped a zip entirely — every one of them found by actually testing (full build, real database queries, re-opening a packaged zip to check its real contents) rather than by writing careful code the first time. See the "note on process" at the end of the corresponding Handover Notes section.

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

---

## Agent & Manager Business Tools — A Real Mini-Office Inside CHS
Built at the client's direct request so an agent or manager can run their own practice through the platform rather than alongside it:
- **Real team/staff system** — an agent or manager can invite genuine, separate staff accounts, assign a role label, and see real daily activity reports submitted by each one.
- **Real tenant register and property/owner register** — per-agent, searchable, with real ID documents attached, not a shared spreadsheet.
- **Real expense/income tracking**, a **real remittance flow** paying collected rent on to the actual owner, and **real, auto-generated digital receipts** for completed transactions.
- **Independent agent commission model** — a real, adjustable per-owner commission rate and a custom fee builder, replacing a single fixed platform rate.
- **Multiple bank accounts** for agents/managers, with a real "active withdrawal account" selector.

## Host and Guest as Real, Separate Roles — and the Complete Shortlet Rebuild
Direct, serious client feedback revealed the entire prior shortlet payment mechanism was fundamentally broken — instant booking with no host review, commission calculated but never collected, and no way for a host to ever get paid. Rebuilt from the ground up:
- **Host** and **Guest** split out as real, separate roles from Owner and Buyer, each with their own dedicated dashboard, built the same proven way as every other role — real data, not a placeholder.
- **Real request-to-book flow**: a guest sees the true, full cost (rent plus their own commission share) before committing; a host must genuinely accept or decline; a decline triggers a real, automatic, full refund.
- **Real host payout**, net of the host's own commission, released deliberately by admin — not automatically — the same CHS-mediated pattern used everywhere else in the app.
- **Real two-way ratings** after a confirmed stay — the single biggest trust signal previously missing from this category.
- **Real, stated cancellation policy**, enforced server-side: full refund 48+ hours before check-in, 50% within 48 hours, none after.
- **A real, flexible security deposit**, per direct client specification: free for the host to switch on or off per listing, applied only to a genuinely first-time guest, and automatically waived once a guest has 3+ real ratings on file. Tested directly on both real outcomes — release back to the guest, and claim for the host with a required reason.
- **Real house-rules attestation** — a guest must now actually see and check a box agreeing to a property's real house rules before a booking request can be submitted, closing a gap where the feature existed for hosts but was invisible to guests.
- **Real dispute-filing**, extended to Guest and Host — a working form already existed for Tenant and Owner but had never been connected to these two newer roles.

## Developer as a Real, Separate Role
Confirmed and fixed a genuine gap: an account could register as a Commercial Developer but had no way to log back in under that role, and no dedicated dashboard existed at all. Built the same way as Host/Guest — real application status, real portfolio, real listings.

## KYC & Registration — Three Real, Confirmed Bugs Found and Fixed
- **Non-NIN ID types had nowhere to enter their own real number** — the system was silently saving a person's NIN as the "ID number" regardless of which document was actually chosen (Driver's Licence, Passport, Voter's Card). Fixed with a real, conditional number field per ID type.
- **The admin KYC review screen only checked a person's primary role** to decide where to look for their documents — completely missing real credentials attached to a secondary role. Found and fixed against a real, in-house test case (an account that added Manager as a second role).
- **Document links relying on a URL signed once and stored permanently** — a real, structural fragility (any future signing-key change silently breaks every stored link with no warning). Rebuilt so every document link now generates a fresh, live signed URL at the moment someone actually clicks to view it.

## Property Traceability — A Real, Structural Fix
Confirmed a serious, scale-relevant gap directly from a client-reported case: two real properties shared the exact same title with no way to tell them apart, and an application sitting with an owner for a decision was completely invisible to admin. Fixed both:
- Every property now has a real, permanent reference number (`PROP-000001` style), backfilled for every property that already existed.
- A real admin search tool — by reference number, title, or the real owner's name/phone — always shows the owner's identity directly.
- Admin's application view now shows every real status, including "awaiting owner decision," instead of silently excluding it.

## Account & Support Features
- **Real PIN reset** — phone + NIN verification, since the platform has no email/SMS infrastructure; previously didn't exist at all, and even the platform owner didn't know the process.
- **Real FAQ page**, written from CHS's own actual Terms & Conditions and features rather than copied from another platform.
- **Add-a-role without logging out**, plus a real, one-tap role switcher on the Profile page — an already-authenticated session now skips straight to picking the new role.

## Design
- **Desktop splash screen fix** — reproduced directly with a real screenshot at desktop resolution before touching code. The real cause: a background image built for a phone's tall aspect ratio was being cropped into an unrecognizable dark sliver on a wide screen. Fixed with a real, deliberate desktop-specific treatment; mobile confirmed untouched.
- **Distinct per-role color themes** — found that a real, deliberate 7-zone color system already existed, but four newer roles (Host, Guest, Developer, Staff) were quietly borrowing another role's colors instead of having their own. Added four new, genuinely distinct colors and verified all eleven side-by-side before shipping.

## Revenue Model — Team/Staff Subscription
Per direct client decision: free for up to 2 real staff, a real subscription required from the 3rd onward, tiered by staff count, with exact discount math — 6 months paid returns 8 real months of access, 12 months paid returns 18. Tested directly: blocked a real 3rd-staff addition pre-subscription, purchased a real 6-month plan and confirmed the exact charge and access period, then confirmed the 3rd addition succeeded afterward.

## Research Delivered
- Nigeria property legal-document requirements for a sale, confirming CHS's own T&C already matches real, standard practice, plus a recommendation on verification charging (flat fee, charged upfront).
- Multi-platform deployment — confirmed the app is already genuinely installable on PC, Android, and iPhone today via each browser's native install feature, with no app-store submission required for this level of access.

- Made Building Plan Approval a genuinely conditional requirement rather than either always-required (wrong for raw land) or optional everywhere (wrong for a house) — caught and fixed a real array-syntax bug in this logic through testing before it reached the client, then proved both real cases (a land listing correctly requiring 6 documents, a house correctly requiring 7) with real data.
- Updated the seller's own button to read "Offer Accepted — Proceed to Payment," and the buyer's notification to point them directly back to the real payment screen, per direct client request.

---

## Receipt & Payment Voucher — A Real, Branded Redesign
Direct client feedback that the original receipt "looks too simple" was taken seriously rather than dismissed. Rebuilt from scratch: a real dark gradient header band with a genuine orange accent stripe, a real circular "CHS Verified" watermark seal, corner marks, a proper serif display font for the amount, and a boxed description panel — reads like an actual bank or fintech document now, not a plain data table. Delivered as real, matching PDF samples using genuine transaction data before the new design was ever applied to the live app itself, so the client could judge the real thing, not a promise of one.

## Artisan Commission — Corrected to the Real, Tiered Rate
Direct client instruction, confirmed and fixed: commission on labor only, never materials — a real, tiered rate of 6% for labor under ₦100,000 and 8.5% at or above, replacing an earlier flat 10%. Tested directly against both real tiers before shipping.

## The Marketplace — Rebuilt Completely, Per Explicit Client Instruction
A direct, serious client concern — that a vendor could self-report a deal and CHS had no way to verify it ever happened — led to a full rebuild, not a patch:
- **Real, admin-mediated messaging**, reusing the same proven contact-blocking system already built for property-offer negotiation: every quote request and every vendor response is held for real CHS review before the other party ever sees it. A phone number or email in either direction is caught and rejected automatically.
- **Real, escrow-backed payment** replacing the old self-reported flat fee entirely: accepting an approved quote charges the buyer the real price plus a real 6% commission, held in escrow; the vendor receives the price net of a real 4% commission only once CHS confirms delivery. A full refund is available if a deal falls through. Proven end to end with real money: an ₦1,660,000 quote correctly charged ₦1,759,600, and correctly paid the vendor ₦1,593,600 net on release.
- **A real "skip the conversation" direct-buy option** — sort listings by price and buy the cheapest one directly at its own real, fixed price, no negotiation at all. Same real 6%/4% split and escrow protection. Proven with real data: an ₦8,500 product correctly charged ₦9,010 and correctly paid the vendor ₦8,160 net.
- Closed a real, confirmed gap where 6 of the 10 real vendor categories — including Building Materials, the exact category the client asked about — had no referral fee configured at all, and the database itself was hard-blocked from ever accepting one for a product category.
- Terms & Conditions updated with a full new term covering moderation, blind identity, and the real escrow commission.

## A Real Link to CHS's Sister Marketplace
Per direct client request, a real, admin-editable link to Unify Market Central — reusing the exact same proven pattern already built for editable contact details, so admin can update the real URL themselves without needing a code change. Placed in the three real places the client specifically described: the Marketplace page, the Construction Roadmap page, and the Owner dashboard's Maintenance section.

## The Rental Application Form — Found Genuinely Porous, Rebuilt Properly
Direct, serious client testing feedback, confirmed by reading the real code before touching it: the owner's review screen only ever showed the guarantor's name, phone, and move-in date — every other real, already-captured applicant detail (occupation, address, income, ID type and number) was sitting completely unused in the database, never fetched or shown. Fixed completely: added a real applicant full-name field and real employer/business fields, and rebuilt the owner's entire review card to show the tenant's real name, a genuine ID-verified status, occupation, income, employer details, current address, and the full guarantor section, all in one place.

**A second, separate, more serious gap raised directly by the client afterward:** a guarantor's own address, occupation, relationship, and consent were all being entered by the applicant on the guarantor's behalf, with a single checkbox standing in for real consent — no way to know the guarantor was ever real, informed, or willing. Rebuilt to match real, global tenant-referencing practice: the applicant now provides only the guarantor's name and phone; the guarantor completes every other real field about themselves — independently, via their own secure, single-use link, requiring no CHS account — before the application can ever reach the owner. Tested completely end to end: confirmed the owner genuinely cannot see any guarantor detail until the guarantor has completed their own real, separate step, and confirmed the same link is correctly rejected on a second attempted use.

## Owner Dashboard — Missing Prices, Found and Fixed
A direct, confirmed gap: the owner's own property cards never showed a listing's real price at all, in any category — checked directly, zero matches for `property.price` anywhere in the file. Every listing now shows its real price prominently, right under the title.

## Event Centre Bookings — Real Capacity Tiers and Priced Facilities
A previous agent's claim that a much richer event-booking system existed in an earlier prototype was verified directly against the real, 12,973-line legacy file before acting on it — confirmed genuine. Rebuilt into the live app: real, host-configurable capacity tiers, each with its own price, and a real priced facilities list (lighting, sound, catering per guest, live band, DJ, decoration, generator, security, parking attendants) — plus "Ushers / event staff," the one real gap the previous agent had correctly flagged, added as its own line item. A real, live-calculated quotation shows the guest a running total as they select. Proven with real data: a 100-guest wedding with catering, a live band, and ushers correctly totalled ₦432,000 base plus 6% commission, for an exact ₦457,920 charged to the guest. A real event add-on request system (music band, caterer, ushers, free-text notes) was also added directly to the standard booking flow for genuine event-type venues, flowing straight through to the host's own dashboard.

## A Real, Serious Payment Regression — Found, Fixed, and Traced to Its Root Cause
A direct client report (a real tenant, Franka Oluma, Ikeja office) that a completed rental payment had "vanished" led to a full trace, not a guess. Two separate, real, confirmed bugs were found:
1. **The owner's approval had genuinely never been recorded** — traced directly through the real database, not assumed — meaning the tenant's payment attempt correctly, if confusingly, showed the application as still awaiting a decision the owner believed they'd already made.
2. **`pay_rent` only ever charged the tenant the raw annual rent**, silently ignoring their own real commission invoice generated at approval — the exact reason no breakdown was ever shown before payment. Fixed to charge and correctly settle both together, with the real total now shown to the tenant before they pay.

The client's own real, stuck application was walked through the corrected flow personally and left completed — real approval, real relay, a real ₦530,000 payment (₦500,000 rent + ₦30,000 commission), and a real, verified receipt — deliberately left in place as the working example the client had originally been trying to produce.

**Following this, the client directly asked whether the same bug existed elsewhere.** Every other real payment category was checked, not assumed: Sale was already correct (commission computed inline, not invoiced separately). Agent-managed rental was already covered by the same `pay_rent` fix. Rent-to-Own had the exact same real bug — found and fixed before being reported, proven with real numbers (a ₦100,000 installment correctly charging the buyer ₦105,000 and paying the seller ₦94,500 net).

**A real, concrete safeguard was also built against this exact pattern recurring**, per the client's direct question about prevention: an admin-visible alert for any real commission invoiced but genuinely uncollected for more than two hours — an early warning that would have caught this the same day it happened.

## Notifications — Made Genuinely Clickable, and Genuinely Real-Time
Detailed, direct client testing feedback covering several real, related gaps, addressed together:
- **Confirmed the actual root cause of "no owner notification"**: submitting a rental application never notified the owner at all — a genuinely missing notification, not a broken link. Fixed, with a real, working link straight to the relevant page threaded through the entire application decision chain (owner decision → CHS relay → tenant outcome).
- **Confirmed the actual root cause of "no admin pop-up," raised twice by the client**: the notifications table had never been added to Supabase's real-time publication at all — the infrastructure for a live alert genuinely didn't exist yet. Enabled it, and built a real, visible toast that appears the instant a new notification arrives, clickable straight through to what needs attention.
- Tested the real "Saved" property button directly against the live database, end to end — genuinely works correctly; most likely a discoverability issue rather than a bug.

## Real, Dedicated Tabs — Completing the Buyer, Tenant, Owner, and Admin Experience
A full round of real, permanent homes for information the client had been "dragging up and down" to find:
- **My Applications** (buyer/tenant) — every real rental application and purchase offer, queued permanently the moment it's submitted.
- **Recent Applications** (owner) — every real application received across every property, in one place, most recent first, regardless of how far down the property list it sits.
- **Transaction History** (owner, buyer, tenant) — reused an already-correct, general transaction page rather than rebuild one, and gave it real, visible navigation from every relevant dashboard.
- **Platform Earnings** (admin) — a real, dedicated view of every collected commission, with the real payer's name, amount, and timestamp.
- **Rent Savings relocated**, not duplicated — confirmed the tenant dashboard already showed this correctly, then removed the redundant copy from the general homepage.
- Two further real constraint bugs caught during this same testing pass: a wallet transaction type that didn't yet allow the new escrow balance, and a repeated transaction-rollback pattern where combining a real update with a subsequent failing call in the same batch silently undid the update — both found and fixed by verifying actual database state after each step, not by trusting a query had succeeded.

