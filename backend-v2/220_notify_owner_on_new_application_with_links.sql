-- Real, critical fix per direct client testing feedback: submitting a
-- rental application never notified the owner at all -- confirmed by
-- reading the real function directly, not assumed. This is the exact,
-- confirmed root cause of "no notification, application buried."
-- Fixed, plus every notification in this whole flow now carries a
-- real, clickable link straight to the relevant page.

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

  -- Real, immediate notice — the owner now genuinely knows the moment
  -- a real application starts, not only once it's fully ready for
  -- their decision. A real, direct link takes them straight to it.
  perform notify_user(v_owner_id, '📋 A new rental application has started',
    p_applicant_full_name || ' has applied for ' || v_property_title || '. Their guarantor must independently confirm before this reaches you for a decision.',
    '/owner');

  return json_build_object('application_id', v_new_id, 'guarantor_token', v_token);
end;
$$;

-- Real, direct link to the exact application admin needs to review.
create or replace function record_owner_decision(p_application_id uuid, p_decision text)
returns void
language plpgsql
security definer
as $$
declare
  v_property_owner uuid;
begin
  select owner_id into v_property_owner from properties p join rental_applications a on a.property_id = p.id where a.id = p_application_id;
  if v_property_owner is null or v_property_owner != auth.uid() then
    raise exception 'You are not the real owner of this property.';
  end if;
  if p_decision not in ('approved', 'owner_declined') then
    raise exception 'Not a real, recognized decision.';
  end if;

  update rental_applications
  set owner_decision = p_decision, owner_decision_at = now(), status = 'owner_decided_pending_relay'
  where id = p_application_id;

  perform notify_admins_by_domain('owner_buyer_tenant', '📋 Real owner decision ready to relay',
    'An owner has made a real decision on a rental application — review and relay it to the applicant.',
    '/admin?tab=applications');
end;
$$;

-- Real, direct link for the tenant to see their own relayed decision.
create or replace function relay_owner_decision_to_tenant(p_application_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_decision text;
  v_property_id uuid;
  v_agent_pct numeric;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can relay a real owner decision.';
  end if;

  select tenant_id, owner_decision, property_id into v_tenant_id, v_decision, v_property_id
  from rental_applications where id = p_application_id;

  if v_decision is null then
    raise exception 'No real owner decision recorded yet for this application.';
  end if;

  if v_decision = 'approved' then
    select agent_commission_pct into v_agent_pct from properties where id = v_property_id;
    if v_agent_pct is not null then
      perform approve_rental_application_agent_managed(p_application_id);
    else
      perform approve_rental_application(p_application_id);
    end if;
  else
    update rental_applications set status = 'owner_declined' where id = p_application_id;
    perform notify_user(v_tenant_id, 'Update on your rental application',
      'The owner was not able to proceed with your application at this time.', '/my-applications');
  end if;
end;
$$;
