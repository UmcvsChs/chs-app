-- Real, new security layer for guarantors, per direct client
-- discussion and agreement: an ID proves identity, not current
-- address -- a real, separate document, no older than 90 real days,
-- is now required to prove where a guarantor actually lives right
-- now, alongside their ID.

alter table rental_applications add column if not exists guarantor_address_proof_url text;
alter table rental_applications add column if not exists guarantor_address_proof_type text;
alter table rental_applications add column if not exists guarantor_address_proof_date date;

create or replace function submit_guarantor_confirmation(
  p_token text, p_relationship text, p_address text, p_occupation text,
  p_id_type text, p_id_number text, p_id_document_url text, p_signature_full_name text,
  p_address_proof_url text default null, p_address_proof_type text default null, p_address_proof_date date default null
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
  if p_address_proof_url is null then
    raise exception 'A real, recent proof of address is required.';
  end if;
  if p_address_proof_date is null or p_address_proof_date < current_date - 90 then
    raise exception 'Your proof of address must genuinely be dated within the last 90 days.';
  end if;

  update rental_applications set
    guarantor_relationship = p_relationship,
    guarantor_address = p_address,
    guarantor_occupation = p_occupation,
    guarantor_id_type = p_id_type,
    guarantor_id_number = p_id_number,
    guarantor_id_document_url = p_id_document_url,
    guarantor_address_proof_url = p_address_proof_url,
    guarantor_address_proof_type = p_address_proof_type,
    guarantor_address_proof_date = p_address_proof_date,
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
