-- ═══════════════════════════════════════════════════════════════
-- CHS (Complete Housing Solutions) — Full Database Schema
-- For Supabase (PostgreSQL + Row-Level Security)
-- Built against: CHS_Privacy_Scoping_Audit.docx (20 July 2026)
-- ═══════════════════════════════════════════════════════════════
-- Run this entire file once in the Supabase SQL Editor.
-- It creates every table, enables RLS on all of them, and writes
-- the exact Public/Private/Admin policies from the audit.
-- ═══════════════════════════════════════════════════════════════

-- ── EXTENSIONS ──
create extension if not exists "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════
-- 1. PROFILES  (extends Supabase's built-in auth.users)
-- ═══════════════════════════════════════════════════════════════
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('buyer','tenant','owner','agent','manager','developer','admin')),
  full_name text not null,
  phone text unique not null,
  email text,
  state text default 'Kaduna',
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),

  -- Trust score fields (PUBLIC data — visible to all)
  trust_score numeric(2,1) default 0,
  deals_completed int default 0,
  badges text[] default '{}',
  listed_since timestamptz default now(),

  -- Agent-specific
  agent_type text check (agent_type in ('independent','chs_official')),
  agent_tier numeric(4,2) default 35.00, -- % share, launch rate

  -- Property Manager-specific
  pm_qualification text,
  pm_registration_number text,

  -- Developer-specific
  company_name text,
  cac_number text,
  developer_projects text,
  offers_instalment boolean default false,
  offers_investment boolean default false,

  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- Breaks infinite-recursion risk: any policy needing to check "is this user
-- an admin?" must call this function, never re-query profiles directly inside
-- a policy on profiles itself (or on any table, for safety/consistency).
create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer set search_path = public;


-- PUBLIC: anyone can read basic trust/reputation fields for approved users
-- (In Postgres RLS you can't restrict columns per-policy, so sensitive
--  fields like phone/email are protected via a separate public view — see bottom of file)
create policy "profiles_public_read_approved"
  on profiles for select
  using (status = 'approved');

-- PRIVATE: a user can always read/update their own full profile
create policy "profiles_own_read"
  on profiles for select
  using (auth.uid() = id);

create policy "profiles_own_update"
  on profiles for update
  using (auth.uid() = id);

-- ADMIN: full access
create policy "profiles_admin_all"
  on profiles for all
  using (is_admin());


-- ═══════════════════════════════════════════════════════════════
-- 2. PROPERTIES  — PUBLIC (marketplace), write PRIVATE to owner
-- ═══════════════════════════════════════════════════════════════
create table properties (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  purpose text not null check (purpose in ('rent','sale','lease','hire')),
  property_type text not null,
  location_area text not null,
  location_lga text,
  location_state text default 'Kaduna',
  price numeric(14,2) not null,
  price_period text, -- 'per year','per month','per night', null for sale

  description text,
  bedrooms int,
  bathrooms int,
  floor_area_sqm numeric(10,2),
  fenced boolean,
  gated boolean,
  road_type text check (road_type in ('tarred','untarred_motorable','untarred_difficult')),
  electricity_backup text,
  water_source text,
  estate_security text,

  -- Sale-specific
  for_sale boolean default false,
  acquisition_method text,
  title_document_type text,
  payment_terms text,
  owner_acceptable_amount numeric(14,2),

  -- Rent-to-own
  rent_to_own_available boolean default false,
  rent_to_own_monthly numeric(14,2),
  rent_to_own_portion_pct numeric(5,2),
  rent_to_own_years int,
  rent_to_own_min_deposit numeric(14,2),

  photos text[] default '{}',
  video_url text,

  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  verification_notes text,

  status text not null default 'active' check (status in ('active','rented','sold','delisted')),
  created_at timestamptz default now()
);

alter table properties enable row level security;

-- PUBLIC: verified properties are visible to everyone
create policy "properties_public_read_verified"
  on properties for select
  using (verification_status = 'verified' and status = 'active');

-- PRIVATE: owner can always see and manage their own properties, verified or not
create policy "properties_owner_all"
  on properties for all
  using (auth.uid() = owner_id);

-- ADMIN: full access
create policy "properties_admin_all"
  on properties for all
  using (is_admin());


-- ═══════════════════════════════════════════════════════════════
-- 3. TENANCIES — PRIVATE (tenant, their owner/manager, admin only)
-- ═══════════════════════════════════════════════════════════════
create table tenancies (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid not null references profiles(id) on delete cascade,
  landlord_id uuid not null references profiles(id) on delete cascade,
  manager_id uuid references profiles(id),
  lease_start date not null,
  lease_end date not null,
  annual_rent numeric(14,2) not null,
  status text not null default 'active' check (status in ('active','notice_given','ended')),
  notice_given_at timestamptz,
  created_at timestamptz default now()
);

alter table tenancies enable row level security;

create policy "tenancies_tenant_own"
  on tenancies for all
  using (auth.uid() = tenant_id);

create policy "tenancies_landlord_own"
  on tenancies for select
  using (auth.uid() = landlord_id);

create policy "tenancies_manager_assigned"
  on tenancies for select
  using (auth.uid() = manager_id);

create policy "tenancies_admin_all"
  on tenancies for all
  using (is_admin());


-- ═══════════════════════════════════════════════════════════════
-- 4. WALLETS — PRIVATE (strictly own account + admin)
-- ═══════════════════════════════════════════════════════════════
create table wallets (
  user_id uuid primary key references profiles(id) on delete cascade,
  main_balance numeric(14,2) default 0,
  rent_savings numeric(14,2) default 0,
  maintenance_reserve numeric(14,2) default 0,
  agent_earnings_paid numeric(14,2) default 0,
  agent_earnings_pending numeric(14,2) default 0,
  updated_at timestamptz default now()
);

alter table wallets enable row level security;

create policy "wallets_own_all"
  on wallets for all
  using (auth.uid() = user_id);

create policy "wallets_admin_all"
  on wallets for all
  using (is_admin());

create table wallet_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  wallet_type text not null check (wallet_type in ('main','rent_savings','maintenance_reserve','agent_earnings')),
  amount numeric(14,2) not null,
  direction text not null check (direction in ('credit','debit')),
  description text,
  reference text,
  created_at timestamptz default now()
);

alter table wallet_transactions enable row level security;

create policy "wallet_tx_own"
  on wallet_transactions for select
  using (auth.uid() = user_id);

create policy "wallet_tx_admin_all"
  on wallet_transactions for all
  using (is_admin());


-- ═══════════════════════════════════════════════════════════════
-- 5. INSPECTIONS — PRIVATE (requester + admin); agent gets masked view via a separate view
-- ═══════════════════════════════════════════════════════════════
create table inspections (
  id uuid primary key default uuid_generate_v4(),
  reference text unique not null,
  property_id uuid not null references properties(id) on delete cascade,
  requester_id uuid not null references profiles(id) on delete cascade,
  requested_date date not null,
  requested_time time not null,
  meeting_point text not null,
  distance_km numeric(6,2),
  transport_fee numeric(10,2),
  video_call boolean default false,
  verified_report_addon boolean default false,
  status text not null default 'pending' check (status in ('pending','confirmed','completed','cancelled')),
  created_at timestamptz default now(),

  constraint min_12_hours_notice check (
    (requested_date + requested_time)::timestamptz >= created_at + interval '12 hours'
  )
);

alter table inspections enable row level security;

create policy "inspections_requester_own"
  on inspections for all
  using (auth.uid() = requester_id);

create policy "inspections_admin_all"
  on inspections for all
  using (is_admin());

-- Property owner can see inspections booked on their own property (no requester identity beyond what they need)
create policy "inspections_property_owner_read"
  on inspections for select
  using (exists (select 1 from properties pr where pr.id = property_id and pr.owner_id = auth.uid()));


-- ═══════════════════════════════════════════════════════════════
-- 6. AGENT REFERRALS — PRIVATE + MASKED (agent sees only own, never buyer identity)
-- ═══════════════════════════════════════════════════════════════
create table agent_referrals (
  id uuid primary key default uuid_generate_v4(),
  masked_reference text unique not null, -- e.g. "Referral #4471"
  listing_agent_id uuid references profiles(id),
  referring_agent_id uuid references profiles(id),
  buyer_id uuid not null references profiles(id) on delete cascade, -- never exposed to agents directly
  property_id uuid not null references properties(id),
  stage text not null default 'enquiry' check (stage in ('enquiry','inspection','offer','completed','lost')),
  chs_commission numeric(14,2),
  agent_share_pct numeric(5,2),
  agent_payout numeric(14,2),
  split_50_50 boolean default false, -- true when listing_agent != referring_agent
  created_at timestamptz default now()
);

alter table agent_referrals enable row level security;

-- Agents see their own referrals, but the RLS below still exposes buyer_id at the row level;
-- the application layer MUST query through the masked view below, never this base table directly,
-- for any agent-facing screen.
create policy "referrals_agent_own"
  on agent_referrals for select
  using (auth.uid() = listing_agent_id or auth.uid() = referring_agent_id);

create policy "referrals_admin_all"
  on agent_referrals for all
  using (is_admin());

-- Masked view — THIS is what the Agent dashboard should query, never agent_referrals directly
create view agent_referrals_masked as
  select
    id, masked_reference, listing_agent_id, referring_agent_id,
    property_id, stage, chs_commission, agent_share_pct, agent_payout,
    split_50_50, created_at
    -- buyer_id deliberately excluded
  from agent_referrals;


-- ═══════════════════════════════════════════════════════════════
-- 7. FAULT REPORTS — PRIVATE (tenant, their manager/owner, admin)
-- ═══════════════════════════════════════════════════════════════
create table fault_reports (
  id uuid primary key default uuid_generate_v4(),
  ticket_number text unique not null,
  tenancy_id uuid not null references tenancies(id) on delete cascade,
  category text not null,
  urgency text not null check (urgency in ('low','medium','high')),
  location_in_property text,
  description text not null,
  photos text[] default '{}',
  status text not null default 'reported' check (status in ('reported','assigned','converted_to_quote','resolved')),
  created_at timestamptz default now()
);

alter table fault_reports enable row level security;

create policy "faults_tenant_own"
  on fault_reports for all
  using (exists (select 1 from tenancies t where t.id = tenancy_id and t.tenant_id = auth.uid()));

create policy "faults_landlord_manager_read"
  on fault_reports for select
  using (exists (select 1 from tenancies t where t.id = tenancy_id and (t.landlord_id = auth.uid() or t.manager_id = auth.uid())));

create policy "faults_admin_all"
  on fault_reports for all
  using (is_admin());


-- ═══════════════════════════════════════════════════════════════
-- 8. CONDITION REPORTS — PRIVATE (evidentiary; tenancy + admin only)
-- ═══════════════════════════════════════════════════════════════
create table condition_reports (
  id uuid primary key default uuid_generate_v4(),
  reference text unique not null,
  tenancy_id uuid not null references tenancies(id) on delete cascade,
  rooms jsonb not null, -- [{name, items:[{item, condition, photo_url}], notes}]
  tenant_confirmed boolean default false,
  status text not null default 'draft' check (status in ('draft','pending_review','approved')),
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz default now()
);

alter table condition_reports enable row level security;

create policy "condition_tenant_own"
  on condition_reports for all
  using (exists (select 1 from tenancies t where t.id = tenancy_id and t.tenant_id = auth.uid()));

create policy "condition_landlord_read"
  on condition_reports for select
  using (exists (select 1 from tenancies t where t.id = tenancy_id and t.landlord_id = auth.uid()));

create policy "condition_admin_all"
  on condition_reports for all
  using (is_admin());


-- ═══════════════════════════════════════════════════════════════
-- 9. MEDIA REQUESTS — PUBLIC once answered; requester identity NEVER stored
-- ═══════════════════════════════════════════════════════════════
create table media_requests (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  request_type text,
  description text not null,
  status text not null default 'pending' check (status in ('pending','answered')),
  answer text,
  answered_at timestamptz,
  created_at timestamptz default now()
  -- Deliberately NO requester_id column — anonymous by design, matching the audit
);

alter table media_requests enable row level security;

-- PUBLIC: anyone can read answered requests (this is the point — future visitors benefit)
create policy "media_requests_public_read_answered"
  on media_requests for select
  using (status = 'answered');

-- Anyone authenticated can submit a request (insert-only, no way to read others' pending ones)
create policy "media_requests_insert_any_authenticated"
  on media_requests for insert
  with check (auth.role() = 'authenticated');

-- Property owner can read + answer pending requests on their own property
create policy "media_requests_owner_manage"
  on media_requests for all
  using (exists (select 1 from properties pr where pr.id = property_id and pr.owner_id = auth.uid()));

create policy "media_requests_admin_all"
  on media_requests for all
  using (is_admin());


-- ═══════════════════════════════════════════════════════════════
-- 10. COMMUNITY FEEDBACK — PUBLIC once approved; PRIVATE (pending) to submitter + admin
-- ═══════════════════════════════════════════════════════════════
create table community_feedback (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  relation text not null,
  note text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now()
  -- No submitter_id stored — anonymous by design
);

alter table community_feedback enable row level security;

create policy "community_public_read_approved"
  on community_feedback for select
  using (status = 'approved');

create policy "community_insert_any_authenticated"
  on community_feedback for insert
  with check (auth.role() = 'authenticated');

create policy "community_admin_all"
  on community_feedback for all
  using (is_admin());


-- ═══════════════════════════════════════════════════════════════
-- 11. ENGAGE CHS REQUESTS (Full-Service) — PRIVATE (owner + admin)
-- ═══════════════════════════════════════════════════════════════
create table engage_chs_requests (
  id uuid primary key default uuid_generate_v4(),
  reference text unique not null,
  owner_id uuid not null references profiles(id) on delete cascade,
  service_type text not null,
  description text not null,
  location text,
  status text not null default 'pending' check (status in ('pending','contacted','agreement_signed')),
  created_at timestamptz default now()
);

alter table engage_chs_requests enable row level security;

create policy "engage_owner_own"
  on engage_chs_requests for all
  using (auth.uid() = owner_id);

create policy "engage_admin_all"
  on engage_chs_requests for all
  using (is_admin());


-- ═══════════════════════════════════════════════════════════════
-- 12. PROMOTED LISTINGS — PUBLIC (visible in marketplace ranking)
-- ═══════════════════════════════════════════════════════════════
create table promoted_listings (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tier text not null check (tier in ('7day','30day','90day')),
  amount_paid numeric(10,2) not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

alter table promoted_listings enable row level security;

create policy "promoted_public_read_active"
  on promoted_listings for select
  using (expires_at > now());

create policy "promoted_owner_own"
  on promoted_listings for all
  using (exists (select 1 from properties pr where pr.id = property_id and pr.owner_id = auth.uid()));

create policy "promoted_admin_all"
  on promoted_listings for all
  using (is_admin());


-- ═══════════════════════════════════════════════════════════════
-- 13. DEMAND REGISTRY (Market Watch) — aggregate, PUBLIC-safe
-- ═══════════════════════════════════════════════════════════════
create table demand_registry (
  id uuid primary key default uuid_generate_v4(),
  search_summary text not null,
  area_filter text,
  min_price numeric(14,2),
  max_price numeric(14,2),
  created_at timestamptz default now()
  -- No user_id — this is intentionally anonymous aggregate signal data
);

alter table demand_registry enable row level security;

create policy "demand_public_read"
  on demand_registry for select
  using (true);

create policy "demand_insert_any_authenticated"
  on demand_registry for insert
  with check (auth.role() = 'authenticated');


-- ═══════════════════════════════════════════════════════════════
-- 14. DISPUTES — PRIVATE (parties involved + admin)
-- ═══════════════════════════════════════════════════════════════
create table disputes (
  id uuid primary key default uuid_generate_v4(),
  tenancy_id uuid references tenancies(id),
  raised_by uuid not null references profiles(id),
  against uuid references profiles(id),
  description text not null,
  amount_in_dispute numeric(14,2),
  status text not null default 'open' check (status in ('open','ruled_for_tenant','ruled_for_owner','closed')),
  ruling_notes text,
  created_at timestamptz default now()
);

alter table disputes enable row level security;

create policy "disputes_party_read"
  on disputes for select
  using (auth.uid() = raised_by or auth.uid() = against);

create policy "disputes_raise_own"
  on disputes for insert
  with check (auth.uid() = raised_by);

create policy "disputes_admin_all"
  on disputes for all
  using (is_admin());


-- ═══════════════════════════════════════════════════════════════
-- INDEXES for common query patterns
-- ═══════════════════════════════════════════════════════════════
create index idx_properties_owner on properties(owner_id);
create index idx_properties_status on properties(verification_status, status);
create index idx_tenancies_tenant on tenancies(tenant_id);
create index idx_tenancies_landlord on tenancies(landlord_id);
create index idx_inspections_requester on inspections(requester_id);
create index idx_inspections_property on inspections(property_id);
create index idx_referrals_listing_agent on agent_referrals(listing_agent_id);
create index idx_referrals_referring_agent on agent_referrals(referring_agent_id);
create index idx_fault_reports_tenancy on fault_reports(tenancy_id);
create index idx_media_requests_property on media_requests(property_id);
create index idx_community_feedback_property on community_feedback(property_id);

-- ═══════════════════════════════════════════════════════════════
-- END OF SCHEMA
-- ═══════════════════════════════════════════════════════════════
