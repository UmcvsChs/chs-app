-- Real fixes, per direct client instructions. The database change
-- itself was applied live as migration 399_enforce_identity_verification_everywhere.
--
-- 1) Identity verification first, for everyone. Found and confirmed:
--    the rental application path had no verification check anywhere
--    (an unverified tenant account had already applied), and even the
--    buyer's gate existed only in the browser -- nothing in the
--    database enforced it. One shared check now sits at the database
--    level on offers, rental applications, shortlet/hire bookings and
--    inspections (admins exempt). Tested live and rolled back:
--    an unverified tenant is refused with a clear message; a verified
--    account goes through; a tenant can submit their ID for review.
--
-- 2) Face verification camera, rebuilt after a report from a real
--    phone (steps ran, no camera picture, no error). The step buttons
--    now stay locked until the camera proves it is showing a picture;
--    playback is started explicitly with the attributes phones
--    require; a phone that wants a tap gets a visible button; every
--    failure (permission blocked, camera busy, no picture, failed
--    save) now states what happened instead of failing silently.
--
-- 3) Correction of an earlier mistake: the Escrow Oversight tab
--    queried a "hire_bookings" table that does not exist. Hire
--    bookings live in shortlet_bookings, which the existing deposit
--    query already covers. The incorrect addition was removed (in
--    app/admin/page.tsx, not SQL).
--
-- Part 2 (face camera) is frontend-only -- see
-- components/LivenessCheck.tsx. The real SQL for part 1 follows.

create or replace function enforce_verified_identity()
returns trigger
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_verified boolean;
begin
  if is_admin() then
    return new;
  end if;

  v_user_id := (to_jsonb(new) ->> tg_argv[0])::uuid;
  if v_user_id is null then
    return new;
  end if;

  select valid_id_verified into v_verified from profiles where id = v_user_id;
  if coalesce(v_verified, false) = false then
    raise exception 'identity_verification_required: Please verify your identity first. Submit your ID once from the property page or your profile, and once CHS approves it you can continue.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_require_verified_identity on offers;
create trigger trg_require_verified_identity before insert on offers
  for each row execute function enforce_verified_identity('buyer_id');

drop trigger if exists trg_require_verified_identity on rental_applications;
create trigger trg_require_verified_identity before insert on rental_applications
  for each row execute function enforce_verified_identity('tenant_id');

drop trigger if exists trg_require_verified_identity on shortlet_bookings;
create trigger trg_require_verified_identity before insert on shortlet_bookings
  for each row execute function enforce_verified_identity('guest_id');

drop trigger if exists trg_require_verified_identity on inspections;
create trigger trg_require_verified_identity before insert on inspections
  for each row execute function enforce_verified_identity('requester_id');
