-- Applied live: 404_booking_guest_verified_snapshot,
--               405_identity_check_on_remaining_commitments,
--               406_complete_details_for_verified_accounts.
--
-- Making identity verification uniform across the platform.
--
-- 404  shortlet_bookings.guest_verified, recorded when the booking is
--      made. Guests no longer upload a separate ID per booking; hosts see
--      "Guest identity verified by CHS" instead of a raw ID document
--      (the verification gate promises guests their ID is never shown to
--      other users). Older bookings that already carry an uploaded ID
--      still show it.
-- 405  The shared identity check now also guards rent_to_own_agreements,
--      marketplace_direct_orders, service_quote_requests and
--      engage_chs_requests (admins exempt), in addition to offers, rental
--      applications, shortlet/hire bookings and inspections. Tested:
--      an unverified account is blocked on all four; a verified account
--      passes the identity check on all four.
-- 406  complete_verified_details(): lets a person verified on the old
--      short form supply gender, age bracket, state, address, occupation
--      and email without re-uploading their ID. Recorded as self-declared
--      (profiles.details_self_declared_at). Never alters the verified ID,
--      the NIN lock, or the login phone. Refused for unverified accounts.
--
-- Front end: rental application and shortlet/hire booking forms no
-- longer ask for an ID (they read the verified ID from the person's own
-- profile; hosts and owners never receive it). Rent-to-own, Engage CHS,
-- marketplace buy-now and quote requests sit behind the same gate.
-- A "Complete your details" prompt appears for verified accounts with
-- missing details (on the profile page and above forms they use).
--
-- STILL PENDING from the earlier round (see 401_403 notes): removal of
-- the old direct owner access to the raw rental_applications and offers
-- tables, after the owner screens are confirmed working on this release.

-- ---------- 404: shortlet guest verified-status snapshot ----------

alter table shortlet_bookings add column if not exists guest_verified boolean not null default false;

update shortlet_bookings b set guest_verified = coalesce(p.valid_id_verified, false)
from profiles p where p.id = b.guest_id;

create or replace function mark_guest_verified()
returns trigger
language plpgsql
security definer
as $$
begin
  new.guest_verified := coalesce((select valid_id_verified from profiles where id = new.guest_id), false);
  return new;
end;
$$;

drop trigger if exists trg_set_guest_verified on shortlet_bookings;
create trigger trg_set_guest_verified before insert on shortlet_bookings
  for each row execute function mark_guest_verified();

-- ---------- 405: identity check on the remaining commitment actions ----------
-- (reuses enforce_verified_identity() from migration 399)

drop trigger if exists trg_require_verified_identity on rent_to_own_agreements;
create trigger trg_require_verified_identity before insert on rent_to_own_agreements
  for each row execute function enforce_verified_identity('buyer_id');

drop trigger if exists trg_require_verified_identity on marketplace_direct_orders;
create trigger trg_require_verified_identity before insert on marketplace_direct_orders
  for each row execute function enforce_verified_identity('buyer_id');

drop trigger if exists trg_require_verified_identity on service_quote_requests;
create trigger trg_require_verified_identity before insert on service_quote_requests
  for each row execute function enforce_verified_identity('requester_id');

drop trigger if exists trg_require_verified_identity on engage_chs_requests;
create trigger trg_require_verified_identity before insert on engage_chs_requests
  for each row execute function enforce_verified_identity('owner_id');

-- ---------- 406: self-declared details for people verified on the old form ----------

alter table profiles add column if not exists details_self_declared_at timestamptz;

create or replace function complete_verified_details(
  p_gender text,
  p_age_bracket text,
  p_state_of_residence text,
  p_residential_address text,
  p_occupation text,
  p_contact_email text,
  p_consent boolean
)
returns void
language plpgsql
security definer
as $$
declare
  v_verified boolean;
begin
  select valid_id_verified into v_verified from profiles where id = auth.uid();
  if coalesce(v_verified, false) = false then
    raise exception 'Please verify your identity first. These details are completed after CHS has approved your ID.';
  end if;

  if lower(coalesce(p_gender, '')) not in ('male', 'female') then
    raise exception 'Please select your gender.';
  end if;
  if coalesce(p_age_bracket, '') not in ('18-24', '25-34', '35-44', '45-54', '55-64', '65+') then
    raise exception 'Please select your age bracket.';
  end if;
  if trim(coalesce(p_state_of_residence, '')) = '' then
    raise exception 'Please select your state of residence.';
  end if;
  if length(trim(coalesce(p_residential_address, ''))) < 10 then
    raise exception 'Please enter your full residential address (house number, street, area).';
  end if;
  if trim(coalesce(p_occupation, '')) = '' then
    raise exception 'Please enter your occupation.';
  end if;
  if p_contact_email is null or position('@' in p_contact_email) < 2 or position('.' in split_part(p_contact_email, '@', 2)) < 2 then
    raise exception 'Please enter a valid email address.';
  end if;
  if coalesce(p_consent, false) = false then
    raise exception 'Please confirm that these details are true and that you consent to CHS keeping them.';
  end if;

  update profiles set
    gender = lower(p_gender),
    age_bracket = p_age_bracket,
    state = trim(p_state_of_residence),
    residential_address = trim(p_residential_address),
    profession = trim(p_occupation),
    email = lower(trim(p_contact_email)),
    details_self_declared_at = now()
  where id = auth.uid();
end;
$$;
