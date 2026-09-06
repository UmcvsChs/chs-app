# CHS (Complete Housing Solutions) — Complete Handover Package

**Prepared:** 2026-09-06, for a full agent/conversation transition. Everything below is verified against the real, live codebase and the real, live Supabase project at the time of writing — not reconstructed from memory.

---

## 1. Project Overview

**What it is:** CHS (Complete Housing Solutions) is a real estate super-app for Nigeria (built and tested around Kaduna State, with Ikeja/Lagos and other cities used in later testing). It covers the full property lifecycle: buying, selling, renting, leasing, rent-to-own, short-let/hotel/event-venue bookings, property management, a materials/services marketplace, and artisan/maintenance job matching — all under one platform, with CHS itself acting as an escrow-holding, commission-earning intermediary on every real transaction.

**Core business model:** CHS never lets money move directly between two users without passing through CHS's own wallet system first. Every category (sale, rental, shortlet, rent-to-own, marketplace, artisan labor) carries its own real, specific commission percentage, charged to one or both sides. This is the single most important architectural fact about the whole system — see §5.

**Intended users (roles):** Buyer, Tenant, Owner, Agent, Property Manager, Commercial Developer, Vendor (marketplace seller), Artisan, Host, Guest, Staff/Employee, and Admin (with sub-admin "domains": owner_buyer_tenant, agent_manager, vendor_artisan, etc., plus a super-admin). A single person can hold multiple roles on one account (e.g., Owner + Tenant) via "Link Account," not a second registration.

**Real, current deployment:** Netlify (frontend), Supabase (backend/database/auth/storage), GitHub (source control, client updates it manually after receiving zip batches from each work session).

---

## 2. Current Status

**Overall: a real, working, extensively-tested product — not a prototype.** Every core money-moving flow (sale, rental, shortlet, rent-to-own, marketplace, artisan payment) has been built, then independently re-tested with real data and real wallet balances, multiple times, across many rounds of client testing.

**Fully working and proven (tested with real transactions, not just code review):**
- Registration, login (phone+PIN and biometric/WebAuthn), multi-role linking, PIN reset
- Property listing, browsing, search, saved properties
- Sale flow: offer → accept → pay (price + commission in one real transaction) → escrow hold → document confirmation → release, with real refund-on-timeout
- Rental flow: application → **independent guarantor verification** (see §5) → owner decision → CHS relay → tenancy creation → rent payment (rent + tenant commission charged together)
- Shortlet/Hire/Event Centre: request-to-book → host accept/decline → escrow → check-in confirmation → payout release → ratings; real capacity-tier + priced-facilities booking for Event Centres
- Rent-to-Own: request → approval → per-installment payment (installment + buyer commission charged together, seller net of their commission)
- Marketplace: admin-moderated quote requests AND a real, direct "Buy Now" path; real escrow-backed payment (6%/4% split); contact-info blocking reused from the property-offer negotiation system
- Artisan job payment: real, tiered commission (6%/8.5% by labor amount), labor-only
- Wallet system: main balance, rent savings, escrow_held, maintenance_reserve — all real, separately tracked
- Receipts/payment vouchers: a real, branded, auto-labeled document (receipt if you paid, voucher if you were paid) for any real transaction reference
- Admin: registrations review, property verification, dispute resolution, sale approvals, marketplace moderation, finance/wallet lookup, analytics, Platform Earnings, a stale-commission early-warning alert
- Notifications: real, clickable (deep-linked), and now genuinely real-time (Supabase Realtime, not polling)

**Known to be genuinely incomplete or untested (see §6 and §7 for detail):**
- Rent-to-Own has **no real frontend payment screen at all** — the backend function is correct and tested directly via SQL, but no button/page exists yet for a buyer to actually use it.
- The sister marketplace link (Unify Market Central) is live in three places but still holds a **placeholder URL** — must be updated by admin before it means anything to a real user.
- SMS (Termii) and email (Resend) notification delivery are built but **not fully live** — sender-ID/provider approval was still pending as of the last check. Guarantor-verification links currently have to be manually shared (WhatsApp/text) by the applicant rather than auto-texted.
- Paystack is still on **test keys** — real payment processing (topping up a wallet with real money) is not live yet; this is a business/compliance step (submitting real documents to Paystack), not a code fix.
- One real, unresolved Supabase security advisory: a `SECURITY DEFINER` view (`public.public_profiles`) flagged ERROR-level — worth a follow-up look, not yet actioned.
- Two now-dead-but-harmless leftover data points: an old flat-fee `platform_settings.artisan_commission_pct` value, and old `referral_fee_settings`/`referral_fees_owed` rows from the pre-rebuild marketplace model. Nothing in the current code reads from either; safe to ignore or clean up later.

**No completion percentage is given deliberately** — the app has been through many rounds of "this looks done" followed by real client testing turning up a genuine, previously-invisible bug (see §6, especially the rent-payment regression). Treat any single number as false confidence. The real, honest status is: **every core flow has been built and independently proven at least once with real data; recurring testing keeps finding new edge cases, most recently in payment-amount calculation, notification delivery, and consent/verification integrity.**

---

## 3. Architecture & Tech Stack

**Frontend:** Next.js 16.2.12 (App Router), React 19.2.4, TypeScript 5, Tailwind CSS 4. Deployed to Netlify. A Cloudflare Workers build path also exists (`@opennextjs/cloudflare`, `wrangler`) but Netlify is the real, current deployment target.

**Backend:** Supabase (PostgreSQL + Auth + Storage + Realtime). Almost all business logic lives in **PostgreSQL functions** (`SECURITY DEFINER` functions called via `supabase.rpc(...)` from the frontend), not in Next.js API routes — **this app has no real Next.js API routes at all.** This is a deliberate, consistent pattern: every real money-moving or state-changing operation is one atomic Postgres function, called directly from client-side code.

**Auth pattern:** Real users register with a phone number; internally this becomes a synthetic email (`chsuser{phone}@chsplatform.app`) for Supabase Auth, with the phone number as the real, human-facing identifier everywhere in the UI. PIN-based login uses this synthetic email + a 6-digit PIN as the password. Biometric login uses WebAuthn (`@simplewebauthn/browser` + `@simplewebauthn/server`), backed by four real Supabase Edge Functions (see `edge-functions-v2/`).

**Real, key libraries:**
- `@supabase/supabase-js` + `@supabase/ssr` — all data access
- `@paystack/inline-js` — wallet funding (currently test-mode)
- `@simplewebauthn/*` — biometric login
- `jspdf` — client-side PDF generation where used
- No state-management library (Redux, Zustand, etc.) — plain React state + Supabase queries throughout
- No component library — all UI is hand-built Tailwind, using a small set of real, shared CSS custom properties for per-role color theming (`--zone-bg`, `--zone-card`, `--zone-accent`, applied via a `zone-{role}` class on each dashboard's root element)

**How the pieces fit together (real, current pattern for any given feature):**
1. A real Postgres function in `backend-v2/` — takes real parameters, validates the caller via `auth.uid()`, moves real money via `wallets`/`wallet_transactions` if applicable, inserts/updates the relevant tables, and calls `notify_user(...)` for anyone who needs to know.
2. A real Next.js page or component calls this function via `supabase.rpc("function_name", { p_param: value })`.
3. Real-time or on-load queries read the resulting state directly from the relevant tables (often via a Supabase join, e.g. `properties(title, ...)`).

---

## 4. Complete File & Directory Structure

### 4.1 Top level (`/`)
| Path | What it is |
|---|---|
| `chs-v2/` | **The real, current, live application.** Everything else at this level is either legacy or supporting material. |
| `backend-v2/` | Every real SQL migration (159 files, `1_...sql` through `222_...sql`, some numbers skipped where a migration was abandoned before being applied) — the complete, real history of the database schema and every business-logic function. |
| `edge-functions-v2/` | 4 real Supabase Edge Functions for WebAuthn (biometric login). |
| `backend/` | **Legacy** — an earlier, pre-`v2` backend attempt. Not the real, current one. Kept for reference only. |
| `website/` | A separate, static marketing site (`website/index.html`) — **not yet deployed**, per earlier notes. |
| `index.html`, `landing.html` | **Legacy** — the original, pre-Next.js static prototype of the entire app (12,973 lines in `index.html`). Superseded by `chs-v2/`, but genuinely useful as a design reference — the real Event Centre capacity-tier and facilities-pricing system was rebuilt directly from this file after a documented disagreement about whether it existed (it did; see the Progress Log entry on this). |
| `icon-192.png`, `icon-512.png`, `manifest.json`, `sw.js`, `netlify.toml` | Legacy/root-level PWA and deploy config — the real, current versions of these live inside `chs-v2/public/` and `chs-v2/netlify.toml`. |
| `CHS_PROGRESS_LOG.md` | The real, continuously-updated narrative log of every round of work, in client-facing language. **Read this for the "why" behind almost everything.** |
| `CHS_HANDOVER_NOTES.md` | The real, continuously-updated technical reference — migration status, where to find things, architecture notes. **Read this alongside the present document.** |
| `CHS_ENGAGE_TRACKER.md` | A tracker for the "Engage CHS" professional-services feature specifically. |

### 4.2 `chs-v2/app/` — every real route (64 files)
Every file is `page.tsx` unless noted; folder path is the real URL route.

| Route | Purpose |
|---|---|
| `/` (`page.tsx`) | Homepage — property browsing, search, filters. Server component wrapping `HomePageClient`. |
| `/about` | Real About Us content. |
| `/accept-terms` | Real, legally-gated T&C acceptance (checkbox only enables after genuine scroll-to-bottom). |
| `/admin` | **The single largest file in the app** — the complete admin dashboard, all tabs (overview, analytics, finance, trace, sale approvals, liveness, registrations, applications, properties, disputes, feedback, engage, vendors, referrals, faults, artisans, inspections, developers, tenant register oversight, shortlet/hire deposits, marketplace moderation, platform earnings). |
| `/admin/concierge` | Admin side of the "Talk to an Agent" concierge request feature. |
| `/admin/feature-catalog` | Real, in-app, always-current rendering of the same feature catalog data used to build the PDF/XLSX. |
| `/admin-approval-pending` | Waiting screen for a sub-admin after a correct password, before super-admin grants real access. |
| `/agent` | Agent dashboard — listings, team management, commission settings. |
| `/agent/property-register`, `/agent/tenant-register` | Real, dedicated registers for an agent's own managed properties/tenants. |
| `/analytics/[id]` | Real per-property analytics (views, inquiries, etc.) for an owner/agent. |
| `/artisan` | Artisan dashboard — job quotations, assigned jobs, payments received. |
| `/become-artisan`, `/become-vendor` | Real registration flows for these two categories. |
| `/blog` | Real blog/content listing. |
| `/choose-category` | Entry point for picking which role/category to register or act under. |
| `/concierge` | User-facing "Talk to an Agent" request form. |
| `/condition-report/[tenancyId]` | Real move-in/move-out condition report for a tenancy. |
| `/construction-roadmap` | Real construction cost/permit roadmap tool, with the sister-marketplace link. |
| `/contact` | Real, admin-editable contact details page. |
| `/developer` | Commercial Developer dashboard. |
| `/edit-listing/[id]` | Real property edit form. |
| `/engage-chs` | The "Engage CHS" professional services (Property Management, Sale Negotiation, etc.) request and messaging flow. |
| `/event-pricing/[propertyId]` | **New.** Host-side real capacity-tier and facilities-pricing management for Event Centre listings. |
| `/expenses` | Agent/Manager expense tracking. |
| `/faq` | Real FAQ content, written from CHS's actual T&C. |
| `/forgot-pin` | Real PIN reset via phone + NIN verification. |
| `/guarantor-confirm/[token]` | **New.** The real, independent, no-login-required page a rental guarantor uses to confirm their own details and consent. |
| `/guest` | Guest (shortlet/hotel) dashboard. |
| `/guide` | In-app Users Guide. |
| `/host` | Host (shortlet/hire/event venue owner) dashboard — booking requests, event-day add-on requests, payouts. |
| `/invite/[token]` | Real invitation-link handling (e.g., team member invites). |
| `/link-account` | Adding a second role to an existing account without re-registering. |
| `/list-property` | The real property listing form, branching by category. |
| `/login` | Real phone+PIN and biometric login, with real per-role redirect (see `roleToPath` maps — buyer now correctly goes to `/my-offers`, not `/`). |
| `/manager`, `/manager/estates`, `/manager/estates/[id]` | Property Manager dashboard and Estate Management tools. |
| `/market-demand` | Real "demand registry" — buyers/tenants register what they're looking for. |
| `/marketplace` | The real, rebuilt marketplace — browse, sort by price, request a quote, or Buy Now. |
| `/my-applications` | **New.** Buyer/tenant's permanent queue of every real rental application and purchase offer. |
| `/my-bookings` | Guest's shortlet/hire booking history. |
| `/my-offers` | Buyer's real purchase offers — also the real post-login landing page for the Buyer role. |
| `/my-quote-requests` | Buyer's real marketplace quote requests and direct orders, with Accept & Pay. |
| `/my-receipts` | **General, real transaction history** for any user — every real `wallet_transactions` row, linking to the real receipt/voucher page. |
| `/owner` | Owner dashboard — the second-largest file in the app; properties, rental applications (with full real applicant detail), offers, maintenance, everything an owner manages. |
| `/owner-applications` | **New.** Owner's dedicated, permanent view of every real application/offer received across every property. |
| `/profile` | Real profile management, role switching. |
| `/promote/[id]` | Real listing-promotion purchase flow (credits, fixed tiers, subscriptions). |
| `/property/[id]` | Real property detail page — the main "apply/offer/book" entry point. |
| `/receipt/[reference]` | **The real, branded receipt/payment-voucher document**, auto-labeled by viewer role. |
| `/register` | Real account registration. |
| `/saved` | Real saved-properties list (confirmed working directly against the database). |
| `/staff` | Staff/employee dashboard (for agent/manager team members). |
| `/tenant` | Tenant dashboard — tenancies, rent payment (with real commission breakdown shown before paying), notices. |
| `/terms` | The real, full Terms & Conditions content. |
| `/urgent-sale/[id]` | Real Urgent & Emergency Sale listing detail. |
| `/vendor` | Marketplace vendor dashboard — products, quote requests, direct orders. |
| `/wallet` | Real wallet management — fund, withdraw, view all balances. |
| `layout.tsx`, `not-found.tsx`, `manifest.ts`, `robots.ts`, `sitemap.ts` | Real Next.js framework files — root layout (loads fonts, NotificationBell, etc.), 404 page, PWA manifest, SEO files. |

### 4.3 `chs-v2/components/` — every real shared component (58 files)
Grouped by real purpose (every filename listed, none omitted):

- **Auth/security:** `AccountStatusGate`, `BiometricLogin`, `BiometricSetup`, `IdentityVerificationGate`, `LivenessCheck`, `BankAccountSecurity`
- **Navigation/layout:** `BottomNav`, `ChsLogo`, `RoleBadge`, `SplashScreen`, `ThemeToggle`, `NotificationBell` (real-time, clickable, toast-enabled), `GuidePrompt`, `TestModeBanner`
- **Property browsing/actions:** `PropertyCard`, `PropertySearch`, `PropertyActions` (the real hub of buy/rent/book buttons on a property page), `SaveButton`, `ShareButton`, `InterestButton`, `CurrencyInput`, `CurrencyReference`
- **Booking forms:** `ShortletBookingForm`, `HireBookingForm` (now includes the real Event Centre tier/facilities UI and event-day add-on requests), `InspectionBookingForm`, `HostBookingDecision`, `ShortletCheckInOut`, `ShortletRating`, `CancelBookingButton`, `HouseRulesAcknowledgment`, `HouseRulesUpload`
- **Applications/forms:** `RentalApplicationForm` (real, split guarantor flow), `IssueNoticeForm`, `RequestTermination`, `RaiseDisputeForm`, `RateArtisanForm`, `PostQuotationJob`, `DemandRegistryForm`
- **Messaging (all real, several with admin-moderated contact-info blocking):** `MessageThread`, `OfferMessageThread`, `ShortletMessageThread`, `OwnerAdminMessageThread`, `EngageChatThread`
- **Marketplace:** `MarketplaceClient` (the real, rebuilt marketplace UI)
- **Documents/content:** `DocumentViewLink` (fresh signed URLs, not stored ones), `TermsContent`, `FaqContent`, `GuideContent`, `EngageDocuments`, `MediaRequests`
- **Misc real, working features:** `CommunityFeedback`, `ComprehensionCheck`, `DiasporaMode`, `TransactionCommissions`, `WalletQuickView`, `ServiceTncGate`, `ServiceWorkerRegistration`, `HomePageClient`

### 4.4 `chs-v2/lib/` — shared utilities (11 files)
`currencyReference.ts`, `format.ts` (Naira formatting, purpose labels), `geoData.ts` (Nigerian states/LGAs), `idValidation.ts` (real ID-type placeholders/validation), `imageCompression.ts` (client-side photo compression before upload), `inspectionFee.ts`, `paystack.ts` (wallet funding init), `storage.ts` (`uploadDocument`, `getFreshDocumentUrl` — private, signed-URL document storage), `supabase.ts` (the main real client), `supabase/client.ts`, `supabase/server.ts` (SSR variants).

### 4.5 `chs-v2/types/` — TypeScript interfaces (34 files)
One file per real domain concept — every filename real and current, matching the actual tables/RPC shapes they represent: `agentReferral`, `artisan`, `bankAccount`, `blogArticles`, `buildingMaterials`, `communityFeedback`, `conditionReport`, `demandRegistry`, `dispute`, `engageCategoryFields`, `engageRequest`, `faultReport`, `featureCatalogData` (the real source of the Feature Catalog), `formalNotice`, `guideContent`, `inspection`, `managementTermination`, `marketplace`, `marketplaceBundle`, `mediaRequest`, `notification`, `offer`, `paystack-inline-js.d.ts`, `profile`, `property`, `propertyTypes`, `referral`, `referralFee`, `rentalApplication` (recently extended with the new guarantor-verification and applicant-detail fields), `serviceQuoteRequest` (recently extended with moderation/escrow fields), `serviceTnc`, `shortletBooking`, `tenancyMessage`, `wallet`.

### 4.6 `backend-v2/` — all 159 real SQL migrations
Applied in numeric order; every one of these is live in the real, production Supabase project (confirmed directly against Supabase's migration history as of `222_enable_realtime_notifications.sql`, the most recent). Rather than list all 159 individually here (the real filenames are all in `backend-v2/` itself, self-numbered and self-titled in plain English), they group into these real, honest phases:

- **1–50ish:** Core schema — profiles, properties, wallets, offers, tenancies, the original registration/KYC system, basic commission logic.
- **50s–90s:** Real bug-fix rounds following early client testing — dispute rulings with no real consequence, agent referral payouts that never fired, management termination that never worked, developer approval with no real consequence, maintenance reserve never wired up. Each filename literally starts with `fix_` and names the real bug.
- **90–150:** Feature rounds — Rent-to-Own, shortlet messaging/escalation, sale legal-document + escrow flow, agent full-authority management, precommit message moderation (the pattern later reused for the marketplace), estate management, team subscriptions, KYC fixes (Sharon Luke secondary-role bug, ID-type field, document-link fragility), property reference numbers, PIN reset, FAQ, add-role-without-logout, per-role color themes.
- **150–195:** Team/business tools for agents and managers, Host/Guest/Developer as real separate roles, the complete shortlet/hire rebuild (real request-to-book, ratings, cancellation policy, security deposits), receipt/voucher system and its later redesign, real artisan commission (flat, later corrected to tiered).
- **196–222 (most recent):** The complete marketplace rebuild (admin-mediated messaging, real escrow payment, direct-buy), the sister marketplace link, the rental-application rework (full applicant detail shown to owner, then the independent guarantor-verification redesign), Event Centre real capacity tiers and facilities, the real payment-regression fixes (`pay_rent`, `pay_rent_to_own_installment` both silently omitting commission), the stale-commission early-warning alert, and the notification/real-time overhaul (`notify_admins_by_domain` link support, enabling Supabase Realtime on the `notifications` table).

**If continuing work on this project, read migration filenames in order — they are self-documenting.** Each one's own top comment explains, in the same honest, direct language as this document, exactly what real problem it fixes or what real feature it adds.

### 4.7 `edge-functions-v2/` (4 files)
`webauthn-register-options.ts`, `webauthn-register-verify.ts`, `webauthn-auth-options.ts`, `webauthn-auth-verify.ts` — the real, complete WebAuthn ceremony for biometric login, deployed as Supabase Edge Functions.

---

## 5. Key Decisions & Rationale (things a new developer might otherwise "fix" incorrectly)

1. **Every real payment computes and charges its own commission in the same atomic function call — never as a separate "invoice" a different function is trusted to remember later.** This was violated twice (`pay_rent`, `pay_rent_to_own_installment`) and caused a real, serious client-facing bug (money "vanishing," no breakdown shown) before being caught and fixed. `pay_for_property` (Sale) was always correct and is the real reference pattern to copy.

2. **Guarantor details on a rental application must never be entered by anyone but the guarantor.** The applicant provides only a name and phone number. Do not "simplify" this back to a single form — it was deliberately split apart after a direct, serious client concern about consent and fraud risk, matching real, global tenant-referencing practice.

3. **The marketplace has two real, separate purchase paths on purpose**: a moderated quote-request negotiation (for anything needing a custom price/discussion) and a direct "Buy Now" (for a fixed-price item with no negotiation needed). Both use the same real 6%/4% commission split and the same real escrow mechanism — do not merge them or treat one as legacy.

4. **`transaction_commissions.status` defaults to `'pending'` and must be explicitly set to `'paid'` the moment real money actually moves.** The stale-commission alert (Admin → Finance) exists specifically to catch any future function that inserts a commission row and forgets this step.

5. **Contact-info blocking (`detect_offplatform_contact`) is a shared, reusable function** — reused identically across property-offer negotiation and the marketplace. Any new real-time messaging feature between two parties who shouldn't exchange direct contact info should reuse this function, not reinvent detection logic.

6. **Notification links matter as much as the notification itself.** `notify_user(p_user_id, p_title, p_body, p_link)` — the 4th parameter is easy to forget and was, repeatedly. A notification without a real, working link to the relevant page is treated as a real, reportable bug by this client, not a nice-to-have.

7. **Every real dashboard's root element carries a `zone-{role}` class**, and each role's header uses `bg-[var(--zone-accent)]` (not a hardcoded color) for its top bar. This is what makes each role's dashboard visually distinct — do not hardcode `bg-chs-charcoal` on a new dashboard header, or it will silently look identical to every other role again (this happened once already and was a real, reported bug).

8. **Never trust a stored, pre-signed document URL long-term.** `getFreshDocumentUrl()` in `lib/storage.ts` generates a fresh signed URL at the moment someone actually views a document, because a signing-key rotation silently breaks every previously-stored URL with no visible error. Any new document-viewing feature should call this, not read a stored URL directly.

9. **The synthetic-email auth pattern (`chsuser{phone}@chsplatform.app`) is intentional, not a hack to clean up.** Supabase Auth requires an email; CHS's real identity system is phone-based. Do not "simplify" this to real emails without understanding every downstream place phone-based lookup is relied on.

---

## 6. Known Issues & Bugs

### Confirmed, fixed, and proven this session (listed so the new agent doesn't re-discover and re-fix the same thing)
- `pay_rent` and `pay_rent_to_own_installment` silently omitted the payer's own commission from the amount actually charged. **Fixed and tested with real numbers.** See migrations `215`–`218`.
- A specific rental application (owner: 08050000005, tenant: 08050000006, "Franka Oluma" in client testing) was genuinely stuck because the owner's "Approve" click had never actually been recorded — traced directly, not assumed, and walked through to a real, completed, receipted payment as proof.
- `submit_rental_application` never notified the property owner of a new application at all. **Fixed** — see migration `220`.
- The `notifications` table was never added to Supabase's real-time publication, meaning no live pop-up could ever have worked, regardless of frontend code. **Fixed** — see migration `222`.
- `notify_admins_by_domain` never accepted a link parameter at all. **Fixed** to match `notify_user`'s signature.
- 6 of 10 real marketplace vendor categories (all product categories, including Building Materials) had no referral fee configured, and the database schema itself blocked one from ever being added — meaning no product-category vendor could ever complete a sale under the old model. **Fixed**, then the whole model was replaced anyway (see §2).

### Confirmed but NOT yet fixed — genuine, open items
- **No real frontend screen exists for a Rent-to-Own buyer to actually make an installment payment.** The backend function (`pay_rent_to_own_installment`) is correct and was tested directly via SQL with real numbers, but nothing in `app/` currently calls it. This needs a real page/component built, likely under `/tenant` or a new `/rent-to-own` route.
- **The Saved/Favorite feature was reported by the client as "not working."** Tested directly against the live database — it genuinely works (insert/query both succeed correctly, `SaveButton` is correctly wired into both `PropertyCard` and the property detail page). This is very likely a **discoverability** issue (the heart-icon button isn't obviously labeled as "save"), not a functional bug. Worth confirming directly with the client via screen share before doing any further work here — don't rebuild a feature that already works.
- **One real Supabase security advisory remains open**: `public.public_profiles`, a `SECURITY DEFINER` view, flagged ERROR-level by Supabase's own advisor. Not yet investigated or resolved.

### Structural gaps, not bugs, worth knowing about
- No automated test suite exists anywhere in this project. All verification described throughout the Progress Log and this document was done by directly calling real Postgres functions with real (test) data via the Supabase SQL tool, checking real before/after wallet balances, and — for frontend changes — running `npm run lint` and `npm run build` to confirm a clean compile. There is no Jest/Playwright/Cypress setup.
- No CI/CD pipeline. Deployment is manual: the working agent zips the repo, the client downloads it, and the client pushes to GitHub themselves (in batches — historically 3 zips per GitHub push), which triggers a Netlify build.

---

## 7. Pending Work / TODOs (prioritized)

1. **Build the real Rent-to-Own payment screen.** The backend is done and proven; this is pure frontend work, likely 1–2 hours: a page showing the buyer's active agreement(s), real ownership percentage so far, and a "Pay this month's installment" button calling `pay_rent_to_own_installment`, following the same real-breakdown-before-paying pattern just built for `pay_rent` on `/tenant`.

2. **Update the sister marketplace URL from its placeholder** (`https://unifymarketcentral.com` is fake) to the real Unify Market Central address, via Admin → Overview → Edit Real Contact Details. This is an admin action, not a code change — but flag it to whoever has admin access if the new agent doesn't.

3. **Confirm the Saved/Favorite discoverability question directly with the client** before touching that code further — it may need nothing beyond a clearer label or icon.

4. **Complete SMS (Termii) and email (Resend) provider approval**, then wire the already-designed-for-it guarantor-confirmation link (and other notifications) to actually send automatically, rather than requiring manual sharing.

5. **Move Paystack off test keys** once the client completes real business verification with Paystack directly — this unblocks real money ever actually entering the system.

6. **Investigate and resolve the one open Supabase security advisory** (`public_profiles` view).

7. **Consider cleaning up (or at minimum, clearly marking as dead) the two known-inert legacy data points** noted in §2 — the old flat artisan commission setting and the pre-rebuild marketplace referral-fee tables — so no future agent mistakes them for something still active.

8. **General:** keep the pattern established throughout this project — whenever a payment flow of any kind is touched, however unrelated the actual change seems, walk it end-to-end with real data and a real resulting receipt before considering it done. This exact discipline is what caught the two most serious bugs found this session.

---

## 8. Testing Status & User Feedback

**Testing method throughout this project:** primarily direct, manual client testing (the client and, at times, a small team testing together in person) against the live Netlify deployment, with detailed, specific feedback relayed in long-form messages — often including exact account names/phone numbers used, exact screens, and exact wording of what went wrong. Every fix in the Progress Log traces back to a real, specific piece of client feedback like this, not a general audit.

**What's been most thoroughly tested (multiple real rounds each):** the Sale flow, the Rental application → tenancy → payment flow, the Shortlet/Hire booking flow, the Marketplace (both old and new models), and Admin's registration/KYC review screens.

**What's been tested least (build-verified and unit-tested via direct SQL, but not yet exercised by a real client user through the actual UI):** Rent-to-Own (no real payment UI to test with yet — see §7), the new Event Centre capacity-tier/facilities system (proven via direct SQL calls with real numbers, not yet clicked through in the live UI by the client), the new independent guarantor-verification flow (proven via direct SQL/backend testing, not yet walked through live by a real applicant and a real guarantor).

**Real, specific, named user feedback this document's author directly acted on** (a representative sample — full detail is in `CHS_PROGRESS_LOG.md`):
- "Franka Oluma," Ikeja office — reported a completed payment that appeared to vanish; traced to a real, confirmed regression (see §6).
- A direct report that the rental application form was "porous," missing a name field, and that an owner's review screen showed almost nothing about a real applicant.
- A direct, detailed concern that a guarantor's consent was not real or independently verifiable.
- A direct report that admin's real-time pop-up "has not worked," raised twice.
- A detailed, itemized list of missing "My Applications" / "Recent Applications" / "Transaction History" / "Platform Earnings" tabs, all built in direct response.

---

## 9. Environment & Setup Instructions

**To run `chs-v2` locally:**

```bash
cd chs-v2
npm install
```

Create `chs-v2/.env.local` with (real values known only to the client/account owner — **never commit this file**):
```
NEXT_PUBLIC_SUPABASE_URL=<the real Supabase project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the real Supabase anon/public key>
```

Then:
```bash
npm run dev      # local development server
npm run build    # production build — ALWAYS run this before considering any change done
npm run lint     # ESLint — should show 0 errors (warnings on pre-existing files are expected and known)
```

**Real Supabase project ID:** `havwhdgjqgtxtqklkqfm` — this is not a secret (it's the public project ref used in the URL) but is included here so the next agent can find the right project immediately.

**To apply a new database migration:** add a new, sequentially-numbered `.sql` file to `backend-v2/` (matching the real, existing numbering — check the highest existing number first) and apply it directly to the live Supabase project. Never renumber or delete an existing migration file.

**Real demo/test accounts** (all use PIN `123456` unless the new agent needs to reset one): a full, current, verified list was produced as a real, standalone PDF (`CHS_DEMO_ACCOUNTS_LIST.pdf`, referenced in earlier project history) — regenerate this from the live database if it isn't included in this handover package, since balances shift as testing continues.

---

## 10. External Services & Accounts

| Service | Used for | Real, current status |
|---|---|---|
| **Supabase** | Entire backend — database, auth, storage, real-time, Edge Functions | Live, active, project `havwhdgjqgtxtqklkqfm` |
| **Netlify** | Frontend hosting/deployment | Live, active |
| **GitHub** | Source control | Live, active — client manually pushes zip updates |
| **Paystack** | Real money in/out of user wallets | **Test keys only** — real payments not yet live |
| **Termii** | SMS (OTPs, rent reminders, etc.) | Built, **sender-ID approval pending** as of last check |
| **Resend** | Transactional email | Built, **provider approval pending** as of last check |
| **Cloudflare** (`wrangler`, `@opennextjs/cloudflare`) | An alternative deploy target | Configured but **not the real, current deployment** — Netlify is |

No other third-party APIs are in use — confirmed directly by searching the codebase (no Google Maps, no third-party NIN verification API, no third-party face-liveness AI service; NIN uniqueness is checked only within CHS's own database, and ID verification is a real photo reviewed manually by CHS staff).

---

## 11. Recent Changes Log (most recent work, in order)

1. Receipt/payment voucher redesign (real branded document).
2. Artisan commission corrected to real, tiered 6%/8.5%.
3. Complete marketplace rebuild — admin-mediated messaging, real escrow payment, direct-buy path.
4. Sister marketplace link (placeholder URL, needs real one).
5. Rental application rework — full real applicant detail shown to owner.
6. Owner dashboard price-display fix.
7. Event Centre real capacity tiers and priced facilities (verified against the legacy prototype file first).
8. Independent guarantor verification — the applicant's guarantor now completes their own real, separate step.
9. Real payment regression found and fixed — `pay_rent` and `pay_rent_to_own_installment` both silently omitted commission.
10. Stale-commission early-warning alert for admin.
11. Notifications made genuinely clickable and genuinely real-time (both root causes found and fixed, not just patched around).
12. New real, dedicated tabs: My Applications, Recent Applications (owner), Platform Earnings (admin); Rent Savings widget removed from the homepage (confirmed duplicate, not missing).
13. **This document** — full handover package requested ahead of a conversation/plan-tier transition.

Every one of the above has a real, matching, more detailed entry in `CHS_PROGRESS_LOG.md`, and every backend change has a real, numbered migration file in `backend-v2/` with its own explanatory comment.

---

## 12. Immediate Next Steps for the New Agent

1. **Read `CHS_PROGRESS_LOG.md` and `CHS_HANDOVER_NOTES.md` in full** — this document is a snapshot; those two files are the real, continuously-updated record and should be treated as more authoritative for anything that seems to conflict.
2. **Confirm the real, live Supabase migration count still matches `222`** before making any schema change — run a quick check against the project's migration history first.
3. **Do not assume anything is broken just because it's listed as "not yet tested through the real UI"** in §8 — the backend logic for those items has been directly, numerically verified. Build the missing frontend pieces; don't re-litigate the backend math.
4. **Start with item #1 in §7** (Rent-to-Own payment screen) if looking for the highest-value, best-scoped next task — everything needed to build it correctly already exists and is proven.
5. **When in doubt about why something is built a certain way, check §5 first** — several of these decisions look like they could be "cleaned up" by someone unfamiliar with the real history, and doing so would reintroduce a real, already-fixed bug.

---

## 13. Honest Gaps in This Document

- **I do not have access to any real API keys, passwords, or secrets**, and have not attempted to output any — the `.env.local` values, Paystack keys, Termii/Resend credentials, and Supabase service-role key (if used anywhere) all remain known only to the client/account owner.
- **`backend/` (the legacy, non-`v2` backend folder) was not audited file-by-file for this document** — it is explicitly superseded and, based on every real reference throughout this entire project's history, unused by the live app. If the new agent finds any live dependency on it, that would be a genuine surprise worth flagging back to the client.
- **The real, live Netlify/GitHub state was not independently re-verified at the exact moment of writing this document** — it's described here based on the real, established pattern (client manually pushes zips in batches) documented throughout this project's history, not a fresh check of GitHub's current commit.
- **No automated test coverage exists**, as stated in §6 — everything described as "tested" in this document and throughout the Progress Log was real, manual, direct testing (either by the client through the live UI, or by the working agent directly against the live Supabase database), not automated tests that can be re-run to confirm nothing has regressed.
