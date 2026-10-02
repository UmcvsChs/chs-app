-- Real, direct extension of the AVS (Automated Verification System)
-- to guarantor documents, per direct client instruction: "the
-- intelligence built for ID verification does not cut across board."
-- Confirmed directly before building: the real automated check only
-- ever covered buyer_id_verifications -- a guarantor's uploaded ID,
-- reviewed on the exact same admin screen, had no automated check at
-- all. Same real schema shape as buyer ID verification, kept on its
-- own, clearly named columns so the two real verification types never
-- share state. Super-admin-only, consistent with the existing
-- restriction on every other real queue involving a phone number
-- alongside an identity document.
--
-- Tested directly: a real super admin can trigger the check (status
-- correctly moves to "running"); a real, ordinary tenant account is
-- correctly refused. No test data left behind.

alter table rental_applications add column if not exists guarantor_avs_status text
  check (guarantor_avs_status in ('not_run', 'running', 'match', 'mismatch', 'error'));
alter table rental_applications add column if not exists guarantor_avs_extracted_name text;
alter table rental_applications add column if not exists guarantor_avs_extracted_id_number text;
alter table rental_applications add column if not exists guarantor_avs_name_match boolean;
alter table rental_applications add column if not exists guarantor_avs_id_number_match boolean;
alter table rental_applications add column if not exists guarantor_avs_notes text;
alter table rental_applications add column if not exists guarantor_avs_checked_at timestamptz;
alter table rental_applications add column if not exists guarantor_avs_checked_by uuid references profiles(id);

create or replace function record_guarantor_avs_result(
  p_application_id uuid,
  p_status text,
  p_extracted_name text,
  p_extracted_id_number text,
  p_name_match boolean,
  p_id_number_match boolean,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update rental_applications set
    guarantor_avs_status = p_status,
    guarantor_avs_extracted_name = p_extracted_name,
    guarantor_avs_extracted_id_number = p_extracted_id_number,
    guarantor_avs_name_match = p_name_match,
    guarantor_avs_id_number_match = p_id_number_match,
    guarantor_avs_notes = p_notes,
    guarantor_avs_checked_at = now(),
    guarantor_avs_checked_by = auth.uid()
  where id = p_application_id;
end;
$$;

revoke all on function record_guarantor_avs_result(uuid, text, text, text, boolean, boolean, text) from public, anon, authenticated;
grant execute on function record_guarantor_avs_result(uuid, text, text, text, boolean, boolean, text) to service_role;

create or replace function start_guarantor_avs_check(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select is_super_admin from profiles where id = auth.uid()) then
    raise exception 'Not authorised: guarantor documents are reviewed by the super admin only.';
  end if;
  update rental_applications set guarantor_avs_status = 'running' where id = p_application_id;
end;
$$;

revoke all on function start_guarantor_avs_check(uuid) from public, anon;
grant execute on function start_guarantor_avs_check(uuid) to authenticated, service_role;
