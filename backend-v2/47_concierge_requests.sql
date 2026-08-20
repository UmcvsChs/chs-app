-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Concierge Search Requests (Phase 1)
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql and 44_saved_searches.sql.
--
-- "Talk to an agent" — anyone (logged in or not) can type or speak a
-- free-form request ("2-bedroom flat in Benawa GRA, budget around
-- ₦2m/year"). It lands in an admin queue for the team to work.
-- Structured criteria (state, budget, bedrooms) reuse the exact same
-- shape as saved_searches, so once a request is triaged, it becomes
-- a real saved_search — feeding the same Vacancy Alert matching the
-- app already has, instead of being a second, disconnected system.
--
-- Guests (not logged in) can submit — contact_name/phone/email
-- capture the lead directly, since requiring signup first would lose
-- exactly the fast, low-friction requests this feature is for.

select count(*) as schema_already_set_up from saved_searches;
-- If this errors, run 44_saved_searches.sql first.

create table if not exists concierge_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete set null,  -- null = guest

  contact_name text,
  contact_phone text,
  contact_email text,

  raw_message text not null,
  input_type text not null default 'text' check (input_type in ('text','voice')),

  -- Structured criteria — same shape as saved_searches, filled in by
  -- an admin (or later, AI-assisted parsing of raw_message).
  purpose text,
  state text,
  lga text,
  area text,
  min_price numeric,
  max_price numeric,
  property_type text,
  min_bedrooms text,
  amenities text,

  status text not null default 'new' check (status in ('new','in_progress','matched','closed')),
  assigned_admin_id uuid references profiles(id),
  admin_notes text,
  saved_search_id uuid references saved_searches(id),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table concierge_requests enable row level security;

-- Anyone can submit a request — logged in or not. This is a lead-
-- capture form, not a protected resource; requiring auth here would
-- lose the exact fast, no-friction requests it exists to catch.
create policy "concierge_requests_anyone_insert"
  on concierge_requests for insert
  with check (true);

-- Logged-in users can see their own past requests.
create policy "concierge_requests_own_read"
  on concierge_requests for select
  using (auth.uid() is not null and user_id = auth.uid());

create policy "concierge_requests_admin_all"
  on concierge_requests for all
  using (is_admin());

-- Admin triages a request: fills in structured criteria, and this
-- creates the matching saved_search in the same transaction — so the
-- request immediately starts benefiting from whatever vacancy-alert
-- matching already runs against saved_searches, without building a
-- second, parallel matching system.
create or replace function triage_concierge_request(
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
    raise exception 'Only an admin can triage a concierge request.';
  end if;

  select user_id into v_user_id from concierge_requests where id = p_request_id;

  update concierge_requests
  set purpose = p_purpose, state = p_state, lga = p_lga, area = p_area,
      min_price = p_min_price, max_price = p_max_price,
      property_type = p_property_type, min_bedrooms = p_min_bedrooms,
      status = 'in_progress', updated_at = now()
  where id = p_request_id;

  -- Only create a real saved_search if this request came from a
  -- registered user — saved_searches requires a real user_id, and a
  -- guest lead should be worked by the admin team directly instead.
  if v_user_id is not null then
    insert into saved_searches (user_id, purpose, state, lga, area, min_price, max_price, property_type, min_bedrooms)
    values (v_user_id, p_purpose, p_state, p_lga, p_area, p_min_price, p_max_price, p_property_type, p_min_bedrooms)
    returning id into v_search_id;

    update concierge_requests set saved_search_id = v_search_id where id = p_request_id;
  end if;

  return v_search_id;
end;
$$;

select table_name from information_schema.tables where table_name = 'concierge_requests';
-- Should return one row.
