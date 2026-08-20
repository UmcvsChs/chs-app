-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Concierge Search Requests
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 44_saved_searches.sql, in the same Supabase project.
--
-- Phase 1: a real admin-worked lead queue. A user describes what they
-- want in their own words (text, or voice transcribed client-side by
-- the browser's own speech recognition — no new paid service needed
-- for this phase). It lands in concierge_requests for the CHS team to
-- work manually, same loop described: search, advertise, connect.
--
-- This does NOT duplicate saved_searches — it extends it. A concierge
-- request IS a saved_search (same table, same downstream vacancy-alert
-- matching this migration doesn't need to reinvent), just one that
-- started as a free-form message instead of a structured form, and
-- that a real admin is actively working rather than only the
-- automated matcher.

select count(*) as schema_already_set_up from saved_searches;
-- If this errors, run 44_saved_searches.sql first.

-- ───────────────────────────────────────────────────────────────
-- 1. Widen saved_searches to record where a search came from
-- ───────────────────────────────────────────────────────────────

alter table saved_searches
  add column if not exists origin text not null default 'self_service'
    check (origin in ('self_service', 'concierge'));

-- ───────────────────────────────────────────────────────────────
-- 2. The real request queue — what the admin team actually works
-- ───────────────────────────────────────────────────────────────

create table if not exists concierge_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete set null,
  contact_name text,
  contact_phone text,
  raw_message text not null,           -- the real, original text or transcript
  input_method text not null default 'text' check (input_method in ('text','voice')),

  -- Filled in either by an admin reading raw_message, or by Phase 2's
  -- AI parsing — either way, once filled, a matching saved_searches
  -- row is created so this plugs into the same downstream matching
  -- everything else already uses.
  saved_search_id uuid references saved_searches(id),

  status text not null default 'pending' check (status in ('pending','in_progress','matched','closed')),
  assigned_admin_id uuid references profiles(id),
  admin_notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table concierge_requests enable row level security;

-- A requester can see their own request's real status — genuinely
-- useful, not just an admin-only black box.
create policy "concierge_requests_own_read"
  on concierge_requests for select
  using (auth.uid() = user_id);

-- Anyone (including a not-yet-registered visitor, handled via a
-- security-definer function below) can create a request.
create policy "concierge_requests_own_insert"
  on concierge_requests for insert
  with check (auth.uid() = user_id or user_id is null);

create policy "concierge_requests_admin_all"
  on concierge_requests for all
  using (is_admin());

-- ───────────────────────────────────────────────────────────────
-- 3. Real submission function — works for logged-in and anonymous
-- ───────────────────────────────────────────────────────────────

create or replace function submit_concierge_request(
  p_raw_message text,
  p_input_method text default 'text',
  p_contact_name text default null,
  p_contact_phone text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  insert into concierge_requests (user_id, raw_message, input_method, contact_name, contact_phone)
  values (auth.uid(), p_raw_message, p_input_method, p_contact_name, p_contact_phone)
  returning id into v_id;

  -- Real, immediate notification to every admin, not a silent insert
  -- someone has to remember to check for.
  insert into notifications (user_id, title, body)
  select id, 'New concierge request',
    left(p_raw_message, 140)
  from profiles where role = 'admin';

  return v_id;
end;
$$;

-- Called once an admin (or, in Phase 2, the AI parser) has worked out
-- the real structured criteria from raw_message. Creates the matching
-- saved_searches row and links it, so this request now benefits from
-- the exact same vacancy-alert matching every self-service saved
-- search already gets.
create or replace function link_concierge_request_to_search(
  p_request_id uuid,
  p_purpose text,
  p_state text,
  p_lga text,
  p_area text,
  p_min_price numeric,
  p_max_price numeric,
  p_property_type text,
  p_min_bedrooms text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_search_id uuid;
begin
  if not is_admin() then
    raise exception 'Only an admin can link a concierge request to a saved search.';
  end if;

  select user_id into v_user_id from concierge_requests where id = p_request_id;

  insert into saved_searches (user_id, purpose, state, lga, area, min_price, max_price, property_type, min_bedrooms, origin)
  values (v_user_id, p_purpose, p_state, p_lga, p_area, p_min_price, p_max_price, p_property_type, p_min_bedrooms, 'concierge')
  returning id into v_search_id;

  update concierge_requests
    set saved_search_id = v_search_id, status = 'in_progress', updated_at = now()
    where id = p_request_id;

  return v_search_id;
end;
$$;

select table_name from information_schema.tables where table_name = 'concierge_requests';
-- Should return one row.
