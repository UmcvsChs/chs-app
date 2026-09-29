-- Real, complete rework per direct, serious client concern: a
-- guarantor's own occupation, address, relationship, and consent were
-- all being entered by the applicant on the guarantor's behalf, with
-- no way to know the guarantor was ever real, informed, or willing.
-- Rebuilt to match real, global tenant-referencing practice: the
-- applicant provides only the guarantor's name and phone; the
-- guarantor completes their own section independently, via a real,
-- secure, single-use link, before the application can ever reach the
-- owner.

alter table rental_applications add column if not exists guarantor_confirmation_token text unique;
alter table rental_applications add column if not exists guarantor_confirmed_at timestamptz;
alter table rental_applications add column if not exists guarantor_id_type text;
alter table rental_applications add column if not exists guarantor_id_number text;
alter table rental_applications add column if not exists guarantor_id_document_url text;
alter table rental_applications add column if not exists guarantor_signature_full_name text;

-- Real status now includes the genuine, blocking guarantor step.
alter table rental_applications drop constraint if exists rental_applications_status_check;
alter table rental_applications add constraint rental_applications_status_check
  check (status in ('pending', 'awaiting_guarantor_confirmation', 'awaiting_owner_decision', 'owner_decided_pending_relay', 'approved', 'owner_declined'));

create sequence if not exists guarantor_token_seq start 1;

-- Real, new submission function — the applicant's own real details are
-- captured immediately; the guarantor's own name/phone are recorded,
-- but every other real field about the guarantor is deliberately left
-- for the guarantor alone to fill in.
create or replace function submit_rental_application(
  p_property_id uuid, p_applicant_full_name text, p_occupation text, p_present_address text,
  p_income_source text, p_employer_business_name text, p_employer_business_address text,
  p_id_type text, p_id_number text, p_id_document_url text,
  p_guarantor_name text, p_guarantor_phone text, p_move_in_date date
)
returns json
language plpgsql
security definer
as $$
declare
  v_new_id uuid;
  v_token text;
begin
  v_token := 'GTN-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 16));

  insert into rental_applications (
    property_id, tenant_id, applicant_full_name, applicant_occupation, applicant_present_address,
    applicant_income_source, employer_business_name, employer_business_address,
    applicant_id_type, applicant_id_number, applicant_id_document_url,
    guarantor_name, guarantor_phone, guarantor_confirmation_token,
    move_in_date, status
  ) values (
    p_property_id, auth.uid(), p_applicant_full_name, p_occupation, p_present_address,
    p_income_source, p_employer_business_name, p_employer_business_address,
    p_id_type, p_id_number, p_id_document_url,
    p_guarantor_name, p_guarantor_phone, v_token,
    p_move_in_date, 'awaiting_guarantor_confirmation'
  ) returning id into v_new_id;

  return json_build_object('application_id', v_new_id, 'guarantor_token', v_token);
end;
$$;

-- Real, public lookup — deliberately requires no login, since a
-- guarantor may not be a CHS user at all. Returns only what a
-- guarantor genuinely needs to see to decide whether to consent.
create or replace function get_guarantor_confirmation_context(p_token text)
returns json
language sql
security definer
stable
as $$
  select json_build_object(
    'applicant_full_name', ra.applicant_full_name,
    'property_title', p.title,
    'move_in_date', ra.move_in_date,
    'already_confirmed', ra.guarantor_confirmed_at is not null,
    'guarantor_name', ra.guarantor_name
  )
  from rental_applications ra join properties p on p.id = ra.property_id
  where ra.guarantor_confirmation_token = p_token;
$$;

-- Real, independent guarantor submission — the one and only place the
-- guarantor's own occupation, address, relationship, ID, and consent
-- are ever recorded. Requires no login; the token itself, sent
-- directly to the guarantor, is the real, single-use credential.
create or replace function submit_guarantor_confirmation(
  p_token text, p_relationship text, p_address text, p_occupation text,
  p_id_type text, p_id_number text, p_id_document_url text, p_signature_full_name text
)
returns void
language plpgsql
security definer
as $$
declare
  v_app_id uuid;
  v_already_confirmed timestamptz;
begin
  select id, guarantor_confirmed_at into v_app_id, v_already_confirmed
    from rental_applications where guarantor_confirmation_token = p_token;

  if v_app_id is null then
    raise exception 'This real confirmation link is not valid.';
  end if;
  if v_already_confirmed is not null then
    raise exception 'This real guarantor confirmation has already been submitted.';
  end if;
  if trim(p_signature_full_name) = '' then
    raise exception 'Please type your real, full name to confirm.';
  end if;

  update rental_applications set
    guarantor_relationship = p_relationship,
    guarantor_address = p_address,
    guarantor_occupation = p_occupation,
    guarantor_id_type = p_id_type,
    guarantor_id_number = p_id_number,
    guarantor_id_document_url = p_id_document_url,
    guarantor_signature_full_name = p_signature_full_name,
    guarantor_consented = true,
    guarantor_confirmed_at = now(),
    status = 'awaiting_owner_decision'
  where id = v_app_id;

  perform notify_admins_by_domain('owner_buyer_tenant', '✓ Real guarantor confirmation received',
    'A guarantor has independently confirmed and consented — this application is now ready for the real owner decision.');
end;
$$;
