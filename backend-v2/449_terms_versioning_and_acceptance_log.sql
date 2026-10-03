-- ============================================================================
-- 449 — Terms & Conditions versioning, with a permanent acceptance record
-- ============================================================================
-- Before this, the database knew only THAT a person had accepted the Terms at
-- some point (profiles.terms_accepted_at) — not WHICH version, and a later
-- acceptance simply overwrote the earlier one. When term 36 (refunds when the
-- other party defaults) was added, there was no way to tell who had accepted
-- the old text, and no way to ask anyone to accept the new text.
--
-- A second problem found while building this: only seven dashboards (tenant,
-- owner, agent, manager, artisan, vendor, admin) ever sent a person to accept
-- the Terms. Buyers, guests, hosts, developers, staff and investors had no gate
-- at all — 14 of 35 accounts had never accepted any version. The app-side fix
-- is one global gate (components/TermsGate.tsx) covering every role.
--
-- Now:
--  * platform_settings.terms_current_version is the single authority for what
--    "current" means. Version 1 = the original 35 terms; version 2 = 35 terms
--    plus term 36. (lib/termsVersion.ts must match it.)
--  * profiles.terms_version_accepted records the latest version each person
--    accepted.
--  * terms_acceptances is an append-only history: every acceptance, with the
--    version, the exact time, and the person's name and phone as they were at
--    that moment. People can read their own rows; the super admin can read all;
--    nobody can edit or delete (no insert/update/delete policy exists — rows
--    are written only by accept_terms()).
--  * accept_terms(p_version) refuses any version that is not the current one,
--    so a stale page can never record an acceptance of text the person did not
--    actually see. The old zero-argument accept_terms() is dropped outright so
--    no overload is left behind.
--  * The 21 acceptances that already existed are carried forward as version 1,
--    marked source = 'backfill' so the record is honest that they pre-date
--    versioning.
--
-- Verified by direct test (rolled back): backfill = 21 rows; accept_terms(1)
-- and accept_terms(99) refused; accept_terms(2) records the row and sets the
-- profile version; direct insert refused; user update/delete affect 0 rows; an
-- ordinary user sees 0 of anyone else's rows; the super admin sees all; anon
-- is refused.
-- ============================================================================

alter table profiles add column if not exists terms_version_accepted int;

create table if not exists terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_name text,
  user_phone text,
  terms_version int not null,
  accepted_at timestamptz not null default now(),
  source text not null default 'app'
);
create index if not exists terms_acceptances_user_idx on terms_acceptances (user_id, accepted_at desc);

alter table terms_acceptances enable row level security;
drop policy if exists terms_acceptances_own_read on terms_acceptances;
create policy terms_acceptances_own_read on terms_acceptances for select using (auth.uid() = user_id);
drop policy if exists terms_acceptances_superadmin_read on terms_acceptances;
create policy terms_acceptances_superadmin_read on terms_acceptances for select
  using ((select is_super_admin from profiles where id = auth.uid()));

insert into platform_settings (key, value, updated_at)
values ('terms_current_version', '2', now())
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into terms_acceptances (user_id, user_name, user_phone, terms_version, accepted_at, source)
select p.id, p.full_name, p.phone, 1, p.terms_accepted_at, 'backfill'
from profiles p
where p.terms_accepted_at is not null
  and not exists (select 1 from terms_acceptances t where t.user_id = p.id);

update profiles set terms_version_accepted = 1
where terms_accepted_at is not null and terms_version_accepted is null;

drop function if exists accept_terms();

create or replace function accept_terms(p_version int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current int;
  v_name text;
  v_phone text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept the Terms & Conditions.';
  end if;

  select value::int into v_current from platform_settings where key = 'terms_current_version';
  if v_current is null then
    raise exception 'The current Terms version is not configured.';
  end if;
  if p_version is distinct from v_current then
    raise exception 'terms_version_outdated: The Terms & Conditions have been updated since this page loaded. Please refresh the page and read the latest version.';
  end if;

  select full_name, phone into v_name, v_phone from profiles where id = auth.uid();

  insert into terms_acceptances (user_id, user_name, user_phone, terms_version)
  values (auth.uid(), v_name, v_phone, v_current);

  update profiles set terms_accepted_at = now(), terms_version_accepted = v_current where id = auth.uid();
end;
$$;

revoke all on function accept_terms(int) from public, anon;
grant execute on function accept_terms(int) to authenticated, service_role;
