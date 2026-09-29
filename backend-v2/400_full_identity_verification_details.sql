-- Applied live as migration 400_full_identity_verification_details.
--
-- Identity verification used to collect only an ID type, number and
-- document. Now collects: the name exactly as printed on the ID,
-- gender, age bracket, state and full residential address, occupation,
-- email, and explicit consent to CHS keeping these details.
--
-- Database: nine new columns on buyer_id_verifications; age_bracket on
-- profiles; the submission function replaced (both old overloaded
-- versions dropped -- leaving either would recreate the ambiguity that
-- broke the guarantor form earlier); server-side validation of every
-- field with plain-language messages; a flag when the same ID number is
-- already verified on another account.
--
-- On admin approval a trigger copies the verified state, gender, age
-- bracket, address, occupation, email and ID details onto the person's
-- profile. The registered NAME is deliberately never overwritten, so a
-- mismatch with the name on the ID stays visible to the reviewing admin.
--
-- The approval notification said "continue your real offer" -- wrong for
-- tenants and guests; patched to neutral wording.
--
-- get_users_by_state() added for the by-state counts, shown at the top
-- of the User Registry tab (super admin).
--
-- Tested live and rolled back: one-word names and missing consent are
-- refused; a good submission approved by admin fills the profile
-- correctly; the registered name is untouched.
--
-- The function bodies this migration originally shipped (the
-- submission function, the approval-sync trigger, get_users_by_state)
-- were replaced again in migration 401, which added the phone field
-- and the NIN lock. See that file for the current, correct logic --
-- reproducing this migration's now-superseded versions here would
-- only invite someone to run the wrong one. Its lasting contribution
-- is the schema itself:

alter table buyer_id_verifications add column if not exists full_name_on_id text;
alter table buyer_id_verifications add column if not exists gender text;
alter table buyer_id_verifications add column if not exists age_bracket text;
alter table buyer_id_verifications add column if not exists state_of_residence text;
alter table buyer_id_verifications add column if not exists residential_address text;
alter table buyer_id_verifications add column if not exists occupation text;
alter table buyer_id_verifications add column if not exists contact_email text;
alter table buyer_id_verifications add column if not exists consent_given_at timestamptz;
alter table buyer_id_verifications add column if not exists id_already_used_elsewhere boolean not null default false;
alter table profiles add column if not exists age_bracket text;
