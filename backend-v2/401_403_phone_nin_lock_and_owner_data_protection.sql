-- Applied live: 401_phone_nin_lock_and_verified_badge,
--               402_offer_buyer_verified_snapshot,
--               403_owner_protected_views.
--
-- 401  Identity form now requires a validated contact phone (kept on the
--      submission, deliberately NOT copied onto profiles.phone, which is
--      the person's unique login). The one-NIN-per-person rule now also
--      covers the ID verification path: a NIN locked to / verified on
--      another account is refused; a NIN different from the one the
--      person registered with is refused; approval locks the NIN onto
--      the profile permanently (engaging idx_profiles_nin_unique);
--      already-verified people were backfilled into the lock.
--      Applications record the applicant's verified status at submission
--      so the owner's "ID verified" badge can show (an owner cannot read
--      another user's profile, so it never could before).
-- 402  Same snapshot for offers (buyer_verified).
-- 403  Owner-safe views (owner_rental_applications, owner_offers).
--
-- ================= PENDING STEP - NOT YET APPLIED =================
-- Owners can currently still read the FULL rental_applications and
-- offers rows on their own properties through the API (applicant NIN,
-- ID document link, both phone numbers, guarantor ID and confirmation
-- token, buyer phone), even though the screens no longer show them.
-- The old access is intentionally left in place until this release is
-- deployed and the owner screens are confirmed working, because the
-- previously deployed owner screens read the raw tables and would go
-- blank the moment it is removed. After confirming, run:
--
--   drop policy if exists rental_applications_owner_read_on_own_property on rental_applications;
--   drop policy if exists offers_owner_read_on_own_property on offers;
--
-- and re-check by reading an application as the property owner: the
-- raw table must return nothing, the view must return the safe fields.
-- ==================================================================

-- ---------- 401: phone field, NIN lock, verified-status snapshot ----------

alter table buyer_id_verifications add column if not exists contact_phone text;
alter table rental_applications add column if not exists applicant_verified boolean not null default false;

update rental_applications ra set applicant_verified = coalesce(p.valid_id_verified, false)
from profiles p where p.id = ra.tenant_id;

create or replace function mark_applicant_verified()
returns trigger
language plpgsql
security definer
as $$
begin
  new.applicant_verified := coalesce((select valid_id_verified from profiles where id = new.tenant_id), false);
  return new;
end;
$$;

drop trigger if exists trg_set_applicant_verified on rental_applications;
create trigger trg_set_applicant_verified before insert on rental_applications
  for each row execute function mark_applicant_verified();

drop function if exists submit_buyer_id_verification(text, text, text, text, text, text, text, text, text, text, boolean, uuid, jsonb);

create or replace function submit_buyer_id_verification(
  p_id_type text,
  p_id_number text,
  p_id_document_url text,
  p_full_name_on_id text,
  p_gender text,
  p_age_bracket text,
  p_state_of_residence text,
  p_residential_address text,
  p_occupation text,
  p_contact_email text,
  p_contact_phone text,
  p_consent boolean,
  p_return_property_id uuid default null,
  p_draft_offer jsonb default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new_id uuid;
  v_used_elsewhere boolean;
  v_own_nin text;
  v_number text := trim(p_id_number);
  v_phone text := regexp_replace(coalesce(p_contact_phone, ''), '[\s\-()]', '', 'g');
begin
  if array_length(regexp_split_to_array(trim(coalesce(p_full_name_on_id, '')), '\s+'), 1) < 2 then
    raise exception 'Please enter your full name exactly as printed on your ID (first name and surname at least).';
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
  if v_phone !~ '^(\+?234|0)[0-9]{10}$' then
    raise exception 'Please enter a valid phone number, for example 08012345678.';
  end if;
  if coalesce(p_consent, false) = false then
    raise exception 'Please confirm that these details are true and that you consent to CHS keeping them for verification.';
  end if;

  if p_id_type = 'National ID (NIN slip)' then
    select nin into v_own_nin from profiles where id = auth.uid();
    if v_own_nin is not null and v_own_nin <> v_number then
      raise exception 'The NIN you entered does not match the NIN you registered with. Please enter the NIN you registered with, or contact CHS support if you made a mistake at registration.';
    end if;
    if exists (
      select 1 from profiles
      where id <> auth.uid()
        and (nin = v_number
          or (valid_id_verified = true and valid_id_number = v_number and coalesce(valid_id_type, '') = 'National ID (NIN slip)'))
    ) then
      raise exception 'This NIN is already linked to another CHS account. One person can only hold one account. If you believe this is a mistake, please contact CHS support.';
    end if;
  end if;

  select exists(
    select 1 from profiles
    where id <> auth.uid()
      and (nin = v_number
        or lower(trim(coalesce(id_number, ''))) = lower(v_number)
        or (valid_id_verified = true and lower(trim(coalesce(valid_id_number, ''))) = lower(v_number)))
  ) into v_used_elsewhere;

  insert into buyer_id_verifications (
    user_id, id_type, id_number, id_document_url, status, return_property_id, draft_offer,
    full_name_on_id, gender, age_bracket, state_of_residence, residential_address,
    occupation, contact_email, contact_phone, consent_given_at, id_already_used_elsewhere
  ) values (
    auth.uid(), p_id_type, v_number, p_id_document_url, 'pending', p_return_property_id, p_draft_offer,
    trim(p_full_name_on_id), lower(p_gender), p_age_bracket, trim(p_state_of_residence), trim(p_residential_address),
    trim(p_occupation), lower(trim(p_contact_email)), v_phone, now(), v_used_elsewhere
  ) returning id into v_new_id;

  update profiles set id_type = p_id_type, id_number = v_number, id_document_url = p_id_document_url
  where id = auth.uid();

  return v_new_id;
end;
$$;

create or replace function sync_verified_identity_to_profile()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    begin
      update profiles set
        valid_id_type = new.id_type,
        valid_id_number = new.id_number,
        valid_id_document_url = new.id_document_url,
        gender = coalesce(nullif(new.gender, ''), gender),
        age_bracket = coalesce(nullif(new.age_bracket, ''), age_bracket),
        state = coalesce(nullif(new.state_of_residence, ''), state),
        residential_address = coalesce(nullif(new.residential_address, ''), residential_address),
        profession = coalesce(nullif(new.occupation, ''), profession),
        email = coalesce(nullif(new.contact_email, ''), email),
        nin = case when new.id_type = 'National ID (NIN slip)' then coalesce(nin, new.id_number) else nin end
      where id = new.user_id;
    exception when unique_violation then
      raise exception 'This NIN is already locked to another account, so this verification cannot be approved. Reject it, or contact the applicant.';
    end;
  end if;
  return new;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select id, valid_id_number from profiles
    where valid_id_verified = true and nin is null
      and valid_id_type = 'National ID (NIN slip)'
      and valid_id_number ~ '^[0-9]{11}$'
  loop
    begin
      update profiles set nin = r.valid_id_number where id = r.id;
    exception when unique_violation then
      null;
    end;
  end loop;
end $$;

-- ---------- 403: owner-safe views ----------

create or replace view owner_rental_applications as
select ra.id, ra.property_id, ra.status, ra.created_at, ra.move_in_date,
       ra.applicant_full_name, ra.applicant_occupation, ra.applicant_present_address,
       ra.applicant_income_source, ra.employer_business_name, ra.employer_business_address,
       ra.applicant_id_type, ra.applicant_verified,
       ra.guarantor_name, ra.guarantor_relationship, ra.guarantor_occupation,
       ra.guarantor_address, ra.guarantor_id_type, ra.guarantor_consented, ra.guarantor_confirmed_at,
       ra.owner_decision, ra.owner_decision_at
from rental_applications ra
where exists (select 1 from properties p where p.id = ra.property_id and p.owner_id = auth.uid());

create or replace view owner_offers as
select o.id, o.property_id, o.amount, o.note, o.status, o.created_at, o.seller_response_note,
       o.payment_status, o.legal_transfer_confirmed, o.document_deadline, o.chs_cleared,
       o.accepts_installment, o.downpayment_pct, o.amount_paid, o.acceptance_condition,
       o.payment_deadline_days, o.buyer_full_name, o.buyer_occupation, o.buyer_source_of_funds,
       o.buyer_verified, o.owner_decision, o.owner_decision_at, o.admin_relayed_at, o.refund_status
from offers o
where exists (select 1 from properties p where p.id = o.property_id and p.owner_id = auth.uid());

revoke all on owner_rental_applications from anon, public;
revoke all on owner_offers from anon, public;
grant select on owner_rental_applications to authenticated;
grant select on owner_offers to authenticated;
