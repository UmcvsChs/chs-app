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

In addition to the original app's `backend/` folder, this rebuild needs one more migration: `backend-v2/11_offers_table.sql`, which creates the real offers table described above. Run it the same way as the others, after `01_schema.sql`.

## Tech stack

- **Next.js** (App Router) — the application framework
- **React** — the UI library
- **TypeScript** — for type safety, catching a whole category of bugs before the code ever runs
- **Tailwind CSS** — utility-based styling
- **Supabase** — the real, same database and backend the original app uses

## Status

🚧 Homepage, property detail pages, registration/login for every role, a real Sale offer system, and real inspection booking (every property type) built and verified. Next: the full rental application process for Rent/Lease/Hire properties (guarantor details, move-in date, document review) — this needs its own new database table, since the original app never had a proper one for this specific step.
