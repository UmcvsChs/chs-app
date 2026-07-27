# CHS — Complete Housing Solutions

A property platform connecting property owners, tenants, buyers, agents, and property managers across Nigeria, starting in Kaduna State.

## Current status

This repository currently holds the **working, tested version** of the app exactly as it exists today — a single-file build that has been developed and thoroughly tested feature by feature. This is the safe, known-good starting point for an ongoing migration to a properly structured, production-grade codebase (React, with automated testing and a proper deployment pipeline).

**Nothing in this initial upload should be modified directly.** It exists as the reference point every future rebuilt piece gets checked against, to make sure the rebuild genuinely matches what already works before anything replaces it.

## What's in here

- `index.html` — the main application (all roles: Buyer, Tenant, Owner, Agent, Property Manager, Admin)
- `landing.html` — the splash/loading screen shown on first launch
- `manifest.json`, `icon-192.png`, `icon-512.png`, `sw.js` — the files that let this work as an installable app on a phone
- `backend/` — every SQL migration file needed to set up the Supabase database, numbered in the order they should be run

## Backend

This app is powered by [Supabase](https://supabase.com) (PostgreSQL database, authentication, file storage, and serverless functions). The SQL files in `backend/` set up the database structure; a small number of serverless "Edge Functions" (not included in this repo, since they're managed directly in the Supabase dashboard) handle the pieces that need extra security, like registration and identity verification.

## Deployment

The current version is deployed via [Netlify](https://netlify.com), connecting directly to this repository.
