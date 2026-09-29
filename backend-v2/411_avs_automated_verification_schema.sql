-- Real, new feature per direct client request (Phase 1 of the AVS --
-- Automated Verification System -- discussed with the team): an
-- automated first-pass check on identity verification submissions,
-- comparing the name and ID number the applicant TYPED against what
-- is actually PRINTED on their uploaded ID document image, using
-- Claude's real vision capability to read the document. This is
-- explicitly a text-matching first pass, not a biometric face-match
-- or a real government database check (NIN authenticity, BVN lookup)
-- -- that second, genuinely different capability requires a licensed
-- third-party provider (Dojah / VerifyMe / Youverify) and a real,
-- separate business decision on cost, discussed directly with the
-- client and deliberately deferred as Phase 2.
--
-- Results are stored, not just shown once, so admin has a permanent
-- record of which submissions were machine-checked, when, and what
-- the machine actually found -- a real audit trail, not a black box.
--
-- The actual vision call and comparison logic live in the
-- verify-identity-document Edge Function (edge-functions-v2/), not
-- here -- this migration is the schema and the two real, narrow
-- functions the edge function and the admin screen call.

alter table buyer_id_verifications add column if not exists avs_status text
  check (avs_status in ('not_run', 'running', 'match', 'mismatch', 'error'));
alter table buyer_id_verifications add column if not exists avs_extracted_name text;
alter table buyer_id_verifications add column if not exists avs_extracted_id_number text;
alter table buyer_id_verifications add column if not exists avs_name_match boolean;
alter table buyer_id_verifications add column if not exists avs_id_number_match boolean;
alter table buyer_id_verifications add column if not exists avs_notes text;
alter table buyer_id_verifications add column if not exists avs_checked_at timestamptz;
alter table buyer_id_verifications add column if not exists avs_checked_by uuid references profiles(id);

-- Real, admin-only function the edge function calls (via the service
-- role) to write its result back. Kept as a real, callable function
-- rather than a raw table write so the same real audit-log pattern
-- already used everywhere else in CHS can log this too.
create or replace function record_avs_result(
  p_verification_id uuid,
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
  update buyer_id_verifications set
    avs_status = p_status,
    avs_extracted_name = p_extracted_name,
    avs_extracted_id_number = p_extracted_id_number,
    avs_name_match = p_name_match,
    avs_id_number_match = p_id_number_match,
    avs_notes = p_notes,
    avs_checked_at = now(),
    avs_checked_by = auth.uid()
  where id = p_verification_id;
end;
$$;

revoke all on function record_avs_result(uuid, text, text, text, boolean, boolean, text) from public, anon, authenticated;
grant execute on function record_avs_result(uuid, text, text, text, boolean, boolean, text) to service_role;

-- Real, admin-callable function to mark a check as "running" the
-- instant the button is clicked, so the UI can show a real, live
-- loading state even before the vision call returns.
create or replace function start_avs_check(p_verification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not staff_can_access('registration_setup') then
    raise exception 'Not authorised: ID verification is reviewed by CHS registration staff only.';
  end if;
  update buyer_id_verifications set avs_status = 'running' where id = p_verification_id;
end;
$$;

revoke all on function start_avs_check(uuid) from public, anon;
grant execute on function start_avs_check(uuid) to authenticated, service_role;
