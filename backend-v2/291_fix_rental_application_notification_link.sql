-- Real, direct fix for a confirmed, precisely-diagnosed client
-- complaint: this notification's own comment already said "a real,
-- direct link takes them straight to it" -- but the actual link was
-- just the generic /owner dashboard root, not anywhere that shows
-- the real application. Fixed to point to /owner-applications, the
-- real page that lists every application regardless of stage --
-- including this one, still awaiting guarantor confirmation, so the
-- owner can genuinely see it and understand why there's nothing yet
-- to act on.

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
  v_owner_id uuid;
  v_property_title text;
begin
  v_token := 'GTN-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 16));

  select owner_id, title into v_owner_id, v_property_title from properties where id = p_property_id;

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

  perform notify_user(v_owner_id, '📋 A new rental application has started',
    p_applicant_full_name || ' has applied for ' || v_property_title || '. Their guarantor must independently confirm before this reaches you for a decision.',
    '/owner-applications');

  return json_build_object('application_id', v_new_id, 'guarantor_token', v_token);
end;
$$;
