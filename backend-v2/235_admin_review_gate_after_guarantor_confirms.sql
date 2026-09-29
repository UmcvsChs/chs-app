-- Real, direct fix per a genuine, confirmed design gap: once a
-- guarantor confirmed, the application moved straight to the owner
-- automatically, with no real admin review in between -- which is why
-- it looked like it "sent itself" without any real action taken. This
-- didn't match the client's real, consistent expectation that CHS
-- reviews and relays every real step, exactly like the marketplace
-- and the owner-decision relay already do. A real
-- "awaiting_admin_review" status now sits between guarantor
-- confirmation and the owner ever seeing anything.

alter table rental_applications drop constraint if exists rental_applications_status_check;
alter table rental_applications add constraint rental_applications_status_check
  check (status in ('pending', 'awaiting_guarantor_confirmation', 'awaiting_admin_review', 'awaiting_owner_decision', 'owner_decided_pending_relay', 'approved', 'owner_declined'));

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
    status = 'awaiting_admin_review'
  where id = v_app_id;

  perform notify_admins_by_domain('owner_buyer_tenant', '📋 Real application ready for your review',
    'A guarantor has independently confirmed and consented. Review the complete real application, then relay it to the owner.',
    '/admin?tab=applications');
end;
$$;

-- Real, new function — the actual missing step. Admin genuinely
-- reviews the complete real application (applicant + guarantor, both
-- independently verified) before the owner ever sees it.
create or replace function admin_relay_application_to_owner(p_application_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_applicant_name text;
  v_property_title text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can relay a real application to the owner.';
  end if;

  select p.owner_id, p.title, ra.applicant_full_name
    into v_owner_id, v_property_title, v_applicant_name
    from rental_applications ra join properties p on p.id = ra.property_id
    where ra.id = p_application_id and ra.status = 'awaiting_admin_review';

  if v_owner_id is null then
    raise exception 'This real application is not currently awaiting admin review.';
  end if;

  update rental_applications set status = 'awaiting_owner_decision' where id = p_application_id;

  perform notify_user(v_owner_id, '📋 A real rental application is ready for your decision',
    v_applicant_name || ' has applied for ' || v_property_title || '. CHS has reviewed and verified their guarantor — please review and decide.',
    '/owner');
end;
$$;
