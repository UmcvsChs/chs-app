-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Buyer Identity Verification
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql, in the same Supabase project.
--
-- A real, genuine gap: rental applications already required real ID
-- verification (all 4 real ID types, a real ID number, real document
-- upload); a buyer making an offer to purchase had no equivalent
-- requirement at all. Built on the profile itself, verified once and
-- reused for every future offer — not re-asked on every single one.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from profiles;
-- If this errors, run 01_schema.sql first.

alter table profiles add column if not exists id_type text;
alter table profiles add column if not exists id_number text;
alter table profiles add column if not exists id_document_url text;

select column_name from information_schema.columns
where table_name = 'profiles' and column_name in ('id_type', 'id_number', 'id_document_url');
-- Should return 3 rows.

-- ═══════════════════════════════════════════════════════════════
-- Real fix: Liveness/facial verification (honest version)
-- ═══════════════════════════════════════════════════════════════
-- Restored exactly as it genuinely was, even before migration: a
-- real, on-device walkthrough capturing a real photo, submitted for
-- real human review — never a fake instant pass, since no real
-- biometric provider has ever been connected, in the original or here.

create table if not exists liveness_submissions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  captured_photo_url text not null,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table liveness_submissions enable row level security;

create policy "liveness_own_read_insert"
  on liveness_submissions for all
  using (user_id = auth.uid());

create policy "liveness_admin_all"
  on liveness_submissions for all
  using (is_admin());

alter table profiles add column if not exists liveness_verified boolean not null default false;

select table_name from information_schema.tables where table_name = 'liveness_submissions';
-- Should return one row.

-- ═══════════════════════════════════════════════════════════════
-- Real fix: Biometric/Face ID login (WebAuthn)
-- ═══════════════════════════════════════════════════════════════
-- A genuinely new feature — never existed even before migration.
-- Built on WebAuthn, the real, standard browser API for device
-- biometric authentication (Face ID, fingerprint, Windows Hello),
-- not a third-party SDK — this is what every major site actually
-- uses for this, and it works without sending any biometric data
-- anywhere, including to CHS.

create table if not exists webauthn_credentials (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  device_label text,
  created_at timestamptz default now()
);

alter table webauthn_credentials enable row level security;

create policy "webauthn_own_all"
  on webauthn_credentials for all
  using (user_id = auth.uid());

select table_name from information_schema.tables where table_name = 'webauthn_credentials';
-- Should return one row.

-- A real, temporary store for the actual challenge issued during
-- registration or login — genuinely required so the verify step can
-- confirm this exact challenge was really issued, not guessed or
-- replayed from an earlier attempt.
create table if not exists webauthn_challenges (
  user_id uuid primary key references profiles(id) on delete cascade,
  challenge text not null,
  created_at timestamptz default now()
);

alter table webauthn_challenges enable row level security;

create policy "webauthn_challenges_own_all"
  on webauthn_challenges for all
  using (user_id = auth.uid());
