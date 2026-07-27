# CHS v2 — The Properly Structured Rebuild

This is the beginning of CHS's migration to a production-grade codebase, built on [Next.js](https://nextjs.org) with [React](https://react.dev) and [TypeScript](https://www.typescriptlang.org).

## How this relates to the original app

The original, working version of CHS lives in this same GitHub project, in the root folder (`index.html` and everything alongside it). That version keeps running exactly as it is — nothing about it changes because of this folder. This `chs-v2` folder is a completely separate, new build, developed piece by piece and checked against the original at every step, until it's ready to fully replace it.

## What's here so far

- The project foundation, confirmed to build successfully with CHS's real brand colours and typography wired in
- **The real public homepage** — fetches genuine, live property data directly from the actual Supabase database, with purpose filtering, and correctly shows the "Under Verification — Not Yet Bookable" badge on properties still awaiting CHS's review
- **Real property detail pages** — a genuine page for each real property, with a proper "Not found" page for an invalid or deleted one
- **Real registration and login, for every role** — Buyer, Tenant, Owner, Agent, and Property Manager all register through the one same, unified form (never a separate form embedded in a dashboard — the same principle already fixed in the original app). Agent and Manager correctly show their own extra fields (association membership, valid ID with a real file upload, professional certificates) only when that role is selected, and everything genuinely saves to the real database, including real document uploads to the same storage bucket the original app uses. Login requires selecting which role you're logging in as, and genuinely checks that against the real account — including correctly supporting an account with more than one linked role
- A proper session system (React Context) tracking who's logged in and as which role, available anywhere in the app
- Both data-driven pages always fetch fresh data on every visit — never a frozen snapshot from whenever the site was last built

## Getting started (for a developer running this locally)

```bash
npm install
cp .env.example .env.local
# then fill in your real Supabase URL and anon key in .env.local
npm run dev
```

Then open http://localhost:3000

## Tech stack

- **Next.js** (App Router) — the application framework
- **React** — the UI library
- **TypeScript** — for type safety, catching a whole category of bugs before the code ever runs
- **Tailwind CSS** — utility-based styling
- **Supabase** — the real, same database and backend the original app uses

## Status

🚧 Homepage, property detail pages, and registration/login for every role (Buyer, Tenant, Owner, Agent, Property Manager) built and verified. Next: the real booking/offer actions on the property detail page.
