# CHS v2 — The Properly Structured Rebuild

This is the beginning of CHS's migration to a production-grade codebase, built on [Next.js](https://nextjs.org) with [React](https://react.dev) and [TypeScript](https://www.typescriptlang.org).

## How this relates to the original app

The original, working version of CHS lives in this same GitHub project, in the root folder (`index.html` and everything alongside it). That version keeps running exactly as it is — nothing about it changes because of this folder. This `chs-v2` folder is a completely separate, new build, developed piece by piece and checked against the original at every step, until it's ready to fully replace it.

## What's here so far

- The project foundation, confirmed to build successfully with CHS's real brand colours and typography wired in
- **The real public homepage** — fetches genuine, live property data directly from the actual Supabase database, with purpose filtering (All / For Sale / For Rent / For Lease / For Hire), and correctly shows the "Under Verification — Not Yet Bookable" badge on properties still awaiting CHS's review
- **Real property detail pages** — clicking any property card now takes you to a genuine detail page for that exact property, fetched fresh from the database by its real ID. A property that doesn't exist (deleted, or an invalid link) shows a proper, honest "Not found" page rather than a blank screen or a crash
- Both pages always fetch fresh data on every visit — never a frozen snapshot from whenever the site was last built

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

🚧 Homepage and property detail pages built and verified. Next: the real booking/offer actions on the detail page, then registration and login.
