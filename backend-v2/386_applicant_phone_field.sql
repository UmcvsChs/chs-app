-- Real, direct fix for a genuine, structural gap found while
-- investigating a direct client question: the applicant's own real
-- phone number was never actually collected anywhere on the rental
-- application -- only the guarantor provides one. Admin was shown
-- the phone tied to the logged-in account instead, which is correct
-- in production where one account is one real person, but genuinely
-- wrong here, where a shared test account submitted the application.
-- Added the same real field the guarantor already has, collected
-- directly from the applicant.

alter table rental_applications add column if not exists applicant_phone text;

create or replace function submit_rental_application(
  p_property_id uuid, p_applicant_full_name text, p_applicant_phone text, p_occupation text, p_present_address text,
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
  v_owner_id uuid;
  v_property_title text;
  v_applicant_surname text;
  v_guarantor_surname text;
begin
  v_applicant_surname := lower(trim(regexp_replace(p_applicant_full_name, '^.*\s', '')));
  v_guarantor_surname := lower(trim(regexp_replace(p_guarantor_name, '^.*\s', '')));
  if v_applicant_surname != '' and v_applicant_surname = v_guarantor_surname then
    raise exception 'Your guarantor cannot share your surname — CHS requires a genuine third party, not a spouse, parent, or child.';
  end if;

  v_token := 'GTN-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 16));

  select owner_id, title into v_owner_id, v_property_title from properties where id = p_property_id;

  insert into rental_applications (
    property_id, tenant_id, applicant_full_name, applicant_phone, applicant_occupation, applicant_present_address,
    applicant_income_source, employer_business_name, employer_business_address,
    applicant_id_type, applicant_id_number, applicant_id_document_url,
    guarantor_name, guarantor_phone, guarantor_confirmation_token,
    move_in_date, status
  ) values (
    p_property_id, auth.uid(), p_applicant_full_name, p_applicant_phone, p_occupation, p_present_address,
    p_income_source, p_employer_business_name, p_employer_business_address,
    p_id_type, p_id_number, p_id_document_url,
    p_guarantor_name, p_guarantor_phone, v_token,
    p_move_in_date, 'awaiting_guarantor_confirmation'
  ) returning id into v_new_id;

  perform notify_user(v_owner_id, '📋 A new rental application has started',
    p_applicant_full_name || ' has applied for ' || v_property_title || '. Their guarantor must independently confirm before this reaches you for a decision.',
    '/owner-applications');

  return json_build_object('application_id', v_new_id, 'guarantor_token', v_token);
end;
$$;
