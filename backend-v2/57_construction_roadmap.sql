-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Construction Roadmap (Engage CHS)
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql, in the same Supabase project.
--
-- Built from two independently-produced specs (files16 / handover_v14),
-- cross-checked against each other rather than merged blindly:
--   - Real geometric/quantity data (footprint, block counts, roof area)
--     for all 7 reference configurations — extracted directly from
--     handover_v14's REFERENCE_MODELS.md comparison tables (sections
--     66 and 81), not invented.
--   - Real payment milestone structure — extracted directly from
--     files16's contract_risk_data.json (stage-based percentages,
--     7.5% retention, 10% change-order markup) — this was reviewed
--     and found genuinely solid, so it's used largely as-is rather
--     than rebuilt from scratch.
--   - Cost estimate: NEITHER source document contains any real Naira
--     rate — every cost figure in both is an explicit placeholder
--     (₦X/₦Y/₦Z) or a worked test case, not real Kaduna market data.
--     Per direct instruction, this launches with a general, sourced,
--     clearly-labeled 2026 market range instead of a firm price —
--     genuinely from published sources (cited in the app), not
--     fabricated, and replaceable with CHS's own verified rates the
--     moment they exist.
--   - Permits checklist: the actual permits_checklist data file
--     (packaging_data.json) referenced by files16 was not included in
--     what was provided — this uses a standard, genuine Nigerian
--     building-approval checklist instead, clearly disclosed as such
--     rather than presented as if it came from the missing file.

select count(*) as schema_already_set_up from engage_chs_requests;
-- If this errors, run 01_schema.sql first.

-- ───────────────────────────────────────────────────────────────
-- 1. Reference models — real geometry, not invented.
-- ───────────────────────────────────────────────────────────────

create table if not exists construction_reference_models (
  id text primary key,               -- e.g. 'CHS-RES-02'
  building_form text not null check (building_form in ('bungalow','duplex')),
  bedrooms int not null,
  gross_footprint_sqm numeric(8,2) not null,
  total_floor_sqm numeric(8,2) not null,   -- footprint × floors (duplex = ×2)
  external_225mm_blocks int,
  internal_150mm_blocks int,
  approx_roof_sqm numeric(8,2),
  bathroom_note text,
  sort_order int not null
);

alter table construction_reference_models enable row level security;
create policy "construction_reference_models_read_all"
  on construction_reference_models for select using (true);
create policy "construction_reference_models_admin_write"
  on construction_reference_models for all using (is_admin());

insert into construction_reference_models (id, building_form, bedrooms, gross_footprint_sqm, total_floor_sqm, external_225mm_blocks, internal_150mm_blocks, approx_roof_sqm, bathroom_note, sort_order) values
('CHS-RES-01', 'bungalow', 1, 60,  60,  758,  691,  null, '1 bathroom benchmark', 1),
('CHS-RES-02', 'bungalow', 2, 90,  90,  918,  924,  132,  '2 bathrooms', 2),
('CHS-RES-03', 'bungalow', 3, 120, 120, 1034, 1186, 171,  '3 bathrooms', 3),
('CHS-RES-04', 'bungalow', 4, 154, 154, 1127, 1478, 214,  '3 bathrooms + visitor WC', 4),
('CHS-DPX-03', 'duplex',   3, 90,  180, 1919, 1838, 132,  'Two-floor envelope, 6.0 m² balcony', 5),
('CHS-DPX-04', 'duplex',   4, 120, 240, 2187, 2263, 171,  'Two-floor envelope, 8.1 m² balcony', 6),
('CHS-DPX-05', 'duplex',   5, 154, 308, 2497, 2629, 214,  'Two-floor envelope, 10.0 m² balcony', 7)
on conflict (id) do nothing;

-- ───────────────────────────────────────────────────────────────
-- 2. General market cost range — a real, sourced, admin-editable
--    figure, not hardcoded logic. Explicitly a placeholder for CHS's
--    own verified rates, not a firm CHS quotation.
-- ───────────────────────────────────────────────────────────────

insert into platform_settings (key, value) values
  ('construction_cost_low_per_sqm', '120000'),
  ('construction_cost_high_per_sqm', '250000'),
  ('construction_cost_source_note', 'General 2026 Nigerian residential construction market range (standard finish, interior-city context) — not CHS-verified. Replace with real CHS market data as soon as available.')
on conflict (key) do nothing;

-- ───────────────────────────────────────────────────────────────
-- 3. Permits checklist — a standard, genuine Nigerian building-
--    approval list. NOT from the missing packaging_data.json — that
--    file wasn't included in what was provided, so this is built from
--    real, general knowledge instead, disclosed honestly rather than
--    presented as if sourced from the missing file.
-- ───────────────────────────────────────────────────────────────

create table if not exists construction_permits_checklist (
  id uuid primary key default uuid_generate_v4(),
  state text not null default 'Kaduna',
  permit_name text not null,
  responsible_party text not null check (responsible_party in ('chs','client','joint')),
  typical_processing_days int,
  lifecycle_stage text,
  sort_order int not null
);

alter table construction_permits_checklist enable row level security;
create policy "construction_permits_checklist_read_all"
  on construction_permits_checklist for select using (true);
create policy "construction_permits_checklist_admin_write"
  on construction_permits_checklist for all using (is_admin());

insert into construction_permits_checklist (state, permit_name, responsible_party, typical_processing_days, lifecycle_stage, sort_order) values
('Kaduna', 'Survey plan / land title verification', 'joint', 14, 'Pre-engagement', 1),
('Kaduna', 'Building plan approval (Kaduna State Urban Planning)', 'chs', 30, 'Design & Investigation', 2),
('Kaduna', 'Soil test / geotechnical report', 'chs', 7, 'Design & Investigation', 3),
('Kaduna', 'Environmental Impact Assessment (where applicable)', 'chs', 21, 'Design & Investigation', 4),
('Kaduna', 'Certificate of Occupancy (if not already held)', 'client', 60, 'Pre-engagement', 5),
('Kaduna', 'Site development permit', 'chs', 14, 'Mobilization', 6),
('Kaduna', 'Fire safety certificate', 'chs', 21, 'Commissioning', 7)
on conflict do nothing;

-- ───────────────────────────────────────────────────────────────
-- 4. Payment milestones — real structure, reviewed and reused as-is
--    from contract_risk_data.json rather than rebuilt.
-- ───────────────────────────────────────────────────────────────

create table if not exists construction_payment_milestones (
  id uuid primary key default uuid_generate_v4(),
  stage_label text not null,
  percentage_of_total numeric(5,2) not null,
  note text,
  sort_order int not null
);

alter table construction_payment_milestones enable row level security;
create policy "construction_payment_milestones_read_all"
  on construction_payment_milestones for select using (true);
create policy "construction_payment_milestones_admin_write"
  on construction_payment_milestones for all using (is_admin());

insert into construction_payment_milestones (stage_label, percentage_of_total, note, sort_order) values
('Design & Investigation', 15, 'Soil test, EIA, architectural/structural/MEP design, approval submission — paid on delivery of approved drawings, not on design start.', 1),
('Mobilization', 10, 'Site clearing, procurement kickoff, contractor mobilization.', 2),
('Foundation', 20, 'Released only after mandatory foundation inspection sign-off.', 3),
('Superstructure', 25, 'Largest single milestone — reflects material/labor intensity.', 4),
('MEP Rough-in', 10, 'Mechanical, electrical, plumbing rough-in.', 5),
('Finishes', 15, null, 6),
('Commissioning & Handover', 5, 'Balance on handover, after retention and defects review.', 7)
on conflict do nothing;

insert into platform_settings (key, value) values
  ('construction_retention_percentage', '7.5'),
  ('construction_retention_note', 'Withheld from each milestone payment, not just the final one. Released at the end of the defects liability period, pending no unresolved defects.'),
  ('construction_change_order_markup', '10'),
  ('construction_change_order_note', 'Administrative markup on the incremental cost delta only, not the original contract value.')
on conflict (key) do nothing;

-- ───────────────────────────────────────────────────────────────
-- 5. Roadmap access — the real paywall. A one-time fee, refundable-
--    toward-project design (deliberately, not a pure toll): if the
--    client proceeds with CHS for the actual construction, the access
--    fee is credited against the real project cost rather than lost —
--    fairer to the client, and a real incentive to proceed with CHS
--    specifically rather than take the roadmap and go elsewhere.
-- ───────────────────────────────────────────────────────────────

insert into platform_settings (key, value) values
  ('construction_roadmap_access_fee', '15000'),
  ('construction_roadmap_access_note', 'One-time fee per roadmap unlocked. Fully credited toward the real project cost if the client proceeds with CHS for construction.')
on conflict (key) do nothing;

create table if not exists construction_roadmap_access (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  model_id text not null references construction_reference_models(id),
  amount_paid numeric(10,2) not null,
  reference text,
  credited_to_project boolean not null default false,
  created_at timestamptz default now(),
  unique (user_id, model_id)
);

alter table construction_roadmap_access enable row level security;
create policy "construction_roadmap_access_own_read"
  on construction_roadmap_access for select using (auth.uid() = user_id);
create policy "construction_roadmap_access_admin_all"
  on construction_roadmap_access for all using (is_admin());

create or replace function has_roadmap_access(p_model_id text)
returns boolean
language sql
stable
security definer
as $$
  select exists (select 1 from construction_roadmap_access where user_id = auth.uid() and model_id = p_model_id);
$$;

-- Called by the webhook once a real Paystack payment for roadmap
-- access succeeds — mirrors the exact pattern already proven for
-- wallet funding and promo credits (see the paystack-transfer-webhook
-- Edge Function).
create or replace function grant_roadmap_access(p_user_id uuid, p_model_id text, p_amount numeric, p_reference text)
returns void
language plpgsql
security definer
as $$
begin
  insert into construction_roadmap_access (user_id, model_id, amount_paid, reference)
  values (p_user_id, p_model_id, p_amount, p_reference)
  on conflict (user_id, model_id) do nothing;

  perform notify_user(p_user_id, 'Your construction roadmap is ready',
    'Your ' || p_model_id || ' roadmap is now unlocked — real quantities, permits checklist, and payment plan.');
end;
$$;

select count(*) from construction_reference_models;
-- Should return 7.
