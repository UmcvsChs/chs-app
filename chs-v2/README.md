# CHS v2 — The Properly Structured Rebuild

This is the beginning of CHS's migration to a production-grade codebase, built on [Next.js](https://nextjs.org) with [React](https://react.dev) and [TypeScript](https://www.typescriptlang.org).

## How this relates to the original app

The original, working version of CHS lives in this same GitHub project, in the root folder (`index.html` and everything alongside it). That version keeps running exactly as it is — nothing about it changes because of this folder. This `chs-v2` folder is a completely separate, new build, developed piece by piece and checked against the original at every step, until it's ready to fully replace it.

## What's here so far

Just the foundation — a real, working Next.js project, confirmed to build successfully with no errors, with CHS's actual brand colours and typography (Playfair Display + Inter, the steel-blue/charcoal/amber palette) already wired in from the start. No actual app features yet — those come next, one piece at a time.

## Getting started (for a developer running this locally)

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Tech stack

- **Next.js** (App Router) — the application framework
- **React** — the UI library
- **TypeScript** — for type safety, catching a whole category of bugs before the code ever runs
- **Tailwind CSS** — utility-based styling

## Status

🚧 Early foundation stage. Building out one real feature at a time, starting with the public homepage.
