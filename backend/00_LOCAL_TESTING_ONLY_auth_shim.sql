-- Minimal shim to emulate Supabase's auth schema for local RLS testing
create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- In real Supabase these are session-aware; here we make them configurable
-- per-session via settings so we can simulate "logged in as X" in tests.
create or replace function auth.uid() returns uuid as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ language sql stable;

create or replace function auth.role() returns text as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
$$ language sql stable;
