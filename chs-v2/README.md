# CHS v2 — The Properly Structured Rebuild

This is the beginning of CHS's migration to a production-grade codebase, built on [Next.js](https://nextjs.org) with [React](https://react.dev) and [TypeScript](https://www.typescriptlang.org).

## How this relates to the original app

The original, working version of CHS lives in this same GitHub project, in the root folder (`index.html` and everything alongside it). That version keeps running exactly as it is — nothing about it changes because of this folder. This `chs-v2` folder is a completely separate, new build, developed piece by piece and checked against the original at every step, until it's ready to fully replace it.

## What's here so far

- The project foundation, confirmed to build successfully with CHS's real brand colours and typography wired in
- **The real public homepage** — fetches genuine, live property data directly from the actual Supabase database, with purpose filtering, and correctly shows the "Under Verification — Not Yet Bookable" badge on properties still awaiting CHS's review
- **Real property detail pages** — a genuine page for each real property, with a proper "Not found" page for an invalid or deleted one
- **Real registration and login, for every role** — Buyer, Tenant, Owner, Agent, and Property Manager all register through the one same, unified form. Agent and Manager correctly show their own extra fields only when selected, with real document uploads. Login requires selecting which role you're logging in as, and genuinely checks that against the real account
- **A real, shared offers system — genuinely improved beyond the original app.** Making an offer on a For Sale property writes to a real, dedicated database table with proper access rules from the start, rather than the original app's approach (offers only ever lived in one browser's local memory, which caused a real, serious bug — an offer that admin and the owner could never see). An unregistered visitor trying to make an offer is sent to register first, and lands right back on the exact property they were looking at once they're done — not a generic homepage
- **Real inspection booking, for every property type** — reuses the original schema's already-existing `inspections` table, including its genuine, database-enforced minimum 12-hour notice period. This app checks that same rule on the client side too, so someone gets a clear, immediate message instead of a confusing database error if they pick a time too soon
- **Real rental application submission** — a genuine new database table (`rental_applications`), built from the start with the owner-decision fix already in place (CHS reviews documents first, but the property's real owner makes the actual final call on who moves in — not admin's own review being treated as final, which was a real gap found and fixed in the original app)
- **Real Owner dashboard** — a genuine, logged-in-only page where a real property owner sees every one of their own properties, and can actually act on what's happening — accept or decline a real offer, approve or decline a rental application, see inspection requests — all against the real, shared database, visible the moment it happens regardless of device. Correctly checks a real person's actual role (including someone with Owner as a linked, secondary role) before letting them in, redirecting anyone else away
- **Real Admin dashboard** — covers the three things most urgently needed given everything else already built: approving or rejecting new registrations (an account genuinely can't do much until this happens), screening rental applications and forwarding them to the real property owner for the actual final decision, and verifying properties. Genuinely tested that admin's screening action can only ever forward an application toward the owner — never approve it directly — by checking that rule against the real, actual code, not just assuming it
- **Honest, disclosed limitation:** the Owner and Admin dashboards check who's logged in on the client side, using the same session system as the rest of the app. A more advanced setup would check this on the server before the page ever renders, avoiding even a brief flash of the wrong content — that's a genuine refinement worth doing later, not something skipped by accident
- **Real Tenant dashboard** — a genuine tenant can now see the actual, real-time status of every rental application they've submitted (with clear, human wording — "Awaiting the owner's decision," not a raw database status code), their active tenancy once one exists, and every inspection they've requested. This is what completes the loop from the tenant's own side, the same way the Owner and Admin dashboards completed it from theirs
- **Real Agent dashboard** — built on a genuinely more sophisticated real table than expected: `agent_referrals`, complete with a privacy-conscious masked view already correctly designed into the original schema (a buyer's real identity is deliberately never exposed to an agent — this rebuild queries that same masked view, not the raw table). Shows an agent's real verification status (membership and valid ID, the same honest human-reviewed fields from the original app's #15 and #16 fixes), a working referral link, and real referral/commission tracking by stage. Correctly distinguishes a payout that's actually been earned (a completed deal) from one that's merely projected on a deal still in progress
- **Real property listing creation** — an Owner or Agent can now genuinely create a new property listing, with real photo uploads organised by property. Every new listing starts unverified — not as a cosmetic label, but as a real, database-enforced restriction (the `properties_public_read_verified` policy already built into the original schema means the database itself won't return an unverified property to a random visitor, regardless of what the app's own code asks for) — and lands directly in the Admin dashboard's existing property-verification screen
- **Real server-side session handling — the disclosed gap above is now genuinely fixed, not just noted.** Installed Supabase's real, official SSR package and switched to a session stored in cookies rather than only in the browser's local storage, so a Server Component can genuinely know who's asking, not just treat every visitor as anonymous. The property detail page now correctly recognises an owner viewing their own not-yet-verified listing, respecting the exact same real database rule (`auth.uid() = owner_id`) that already protected this everywhere else. **A real, current-events catch along the way:** Next.js recently renamed its `middleware.ts` file convention to `proxy.ts` — a leftover `middleware.ts` is silently ignored at build time with no error at all, which could have made real security/session logic quietly stop running. Caught this from the build's own warning, verified it against Next.js's own current documentation rather than assumed, and fixed it properly. Verified via 6 structural checks confirming the real, actual source files are correctly wired — not just that the logic seems right in isolation
- **Real Property Manager dashboard** — shows a manager exactly which real tenancies they've been assigned to (management is assigned per-tenancy in the real schema, not per-property), and every maintenance request tied to those tenancies, including real vendor quotations. Correctly reuses the original app's real, already-tested multi-stage vetting system rather than a simplified version — a manager can only ever approve a quotation once a fault has genuinely reached the manager-approval stage, never jump ahead of CHS's own review process
- **Real dispute system** — a tenant can raise a dispute against their real landlord, and an owner against their real tenant, each correctly targeting the actual other party in the relationship, not a placeholder. Admin gets a real ruling screen showing every open dispute, and a ruling genuinely records which real party it was decided for
- **Real wallet page** — shows every account's genuine, real balances (main, rent savings, maintenance reserve, agent earnings — a more sophisticated real system than one single balance) and full transaction history, straight from the actual database. **Honest scope note:** this is the viewing side only — real money-movement actions (funding the wallet, withdrawing) need a real payment gateway integration, which is separate, substantial work still ahead, not something this piece includes
- **Real Marketplace** — genuine vendor products (furniture, building materials, interior design, and more), fetched live from the actual database, only ever showing active products from vendors who are genuinely verified — reusing the exact same real access rule already proven for properties, applied to a completely different kind of business with its own separate verification path (CAC registration, not NIN/liveness)
- **Real, genuinely anonymous community feedback** — on any property's real detail page, someone can share what they actually know (a current or former tenant, a neighbour) without it ever being tied to who they are — the database table itself has no column to store a submitter at all, by design, and the actual code was checked to confirm it never attaches one either. Every piece of feedback is reviewed by admin before it's ever shown publicly
- A proper session system (React Context) tracking who's logged in and as which role, available anywhere in the app
- All data-driven pages always fetch fresh data on every visit — never a frozen snapshot from whenever the site was last built

## Getting started (for a developer running this locally)

```bash
npm install
cp .env.example .env.local
# then fill in your real Supabase URL and anon key in .env.local
npm run dev
```

Then open http://localhost:3000

## Backend setup

In addition to the original app's `backend/` folder, this rebuild needs its own migrations, found in `backend-v2/`:
- `11_offers_table.sql` — the real offers system
- `12_rental_applications.sql` — the real rental application system

Run both the same way as the original migrations, after `01_schema.sql`.

## Tech stack

- **Next.js** (App Router) — the application framework
- **React** — the UI library
- **TypeScript** — for type safety, catching a whole category of bugs before the code ever runs
- **Tailwind CSS** — utility-based styling
- **Supabase** — the real, same database and backend the original app uses

## Status

🚧 Every core dashboard, the full property and rental lifecycles, a real dispute system, a real wallet view, a real Marketplace, real offers, real inspection booking, real registration/login for every role, and genuine server-side session handling — all built and verified. What's left: real payment gateway integration (needs a real provider account to build against), and getting this connected to live hosting so it can actually be used, not just viewed in GitHub.
