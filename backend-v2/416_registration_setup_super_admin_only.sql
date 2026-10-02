-- Real, direct security restriction per explicit, firm client
-- instruction: every real queue involving a person's phone number
-- alongside an identity document or registration record -- ID
-- Verification, Face Verification, and Registrations -- is now
-- exclusively the super admin's own prerogative. A regular
-- "registration_setup" domain admin can no longer view, let alone
-- act on, any of this. This is a genuine narrowing, not a relabeling:
-- previously, a registration_setup admin could VIEW these (their
-- final approval already required super-admin sign-off, via the
-- existing request_admin_action pipeline -- that part was already
-- correct), but viewing a real phone number next to a real ID
-- document is itself the thing being restricted here.
--
-- Honest, direct note: this makes "registration_setup" effectively a
-- dormant staff-role option going forward -- there is currently
-- nothing else assigned to that domain. Any admin currently holding
-- that role keeps their account, but loses access to this data; only
-- a real super admin can act on it now.
--
-- Tested directly: a real, non-super-admin registration_setup account
-- was confirmed to see 0 of the 4 real rows that genuinely exist in
-- buyer_id_verifications, while the real super admin account
-- continued to work correctly. No test data left behind.

create or replace function get_pending_registrations_full()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select is_super_admin from profiles where id = auth.uid()) then
    raise exception 'Not authorised: registrations are visible to the super admin only.';
  end if;
  return get_pending_registrations_full_impl();
end $$;

create or replace function get_recently_handled_registrations()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select is_super_admin from profiles where id = auth.uid()) then
    raise exception 'Not authorised: registrations are visible to the super admin only.';
  end if;
  return get_recently_handled_registrations_impl();
end $$;

create or replace function start_avs_check(p_verification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select is_super_admin from profiles where id = auth.uid()) then
    raise exception 'Not authorised: ID verification is reviewed by the super admin only.';
  end if;
  update buyer_id_verifications set avs_status = 'running' where id = p_verification_id;
end $$;

drop policy if exists buyer_id_admin_all on buyer_id_verifications;
create policy buyer_id_admin_all on buyer_id_verifications for all
  using ((select is_super_admin from profiles where id = auth.uid()));

drop policy if exists liveness_admin_all on liveness_submissions;
create policy liveness_admin_all on liveness_submissions for all
  using ((select is_super_admin from profiles where id = auth.uid()));
