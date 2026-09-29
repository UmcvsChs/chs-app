-- Applied live as migration 407_one_rulebook_for_numbers.
--
-- Trigger: a guarantor's 10-digit NIN was accepted. The form only checked
-- the field was not empty, and the database checked nothing. Auditing
-- showed the same gap everywhere: ~22 phone inputs, ~9 ID-number inputs
-- and the bank account field each had their own check, or none. Two real
-- profiles already held wrong phone numbers (10 and 12 digits).
--
-- ONE RULEBOOK, in two matching places:
--   front end : lib/validators.ts  (+ components/ValidatedInput.tsx)
--   database  : chs_phone_error / chs_nin_error / chs_account_error /
--               chs_id_number_error, applied by the single trigger
--               function chs_enforce_formats() on every table that stores
--               such a number.
-- Verified identical: 30 test values run through both, 30/30 agree.
--
--   Nigerian mobile   0[789][01] + 8 digits (11 total). +234 / 234 forms
--                     accepted and STORED in the standard 0-prefixed form.
--   International     '+' and 8-15 digits, only where a person may be abroad
--                     (buyers, guests, contact numbers, vendors).
--   NIN               exactly 11 digits
--   Bank account      exactly 10 digits (NUBAN)
--   Passport          1 letter + 8 digits
--   Voter's card      19 letters/digits   (least certain: adjust if a real card is refused)
--   Driver's licence  10-15 letters/digits (least certain: same)
--
-- Tables covered: rental_applications, buyer_id_verifications, offers,
-- shortlet_bookings, engage_chs_requests, concierge_requests,
-- document_dispatch_requests, agent_change_requests, marketplace_vendors,
-- tenant_register, linked_bank_accounts, pending_bank_account_changes,
-- profiles (on change only).
--
-- Only values being ENTERED OR CHANGED are checked, so an old record can
-- never block an unrelated edit (tested against the existing bad record).
-- Not enforced in the database: profile INSERT at signup (so a rule can
-- never become a cryptic "database error" during registration; the
-- registration screen enforces it up front), CAC numbers, and names.
--
-- Existing bad data found (NOT changed by this migration):
--   * 1 guarantor NIN with 10 digits (the client's own test application)
--   * 2 profile phone numbers: an agent (10 digits, starts 0000) and an
--     owner (12 digits). Phone is the login identity, so correcting these
--     needs the account holder's confirmation.
--
-- Also still pending from the earlier data-protection round: removal of
-- the old direct owner access to the raw rental_applications and offers
-- tables, once the owner screens are confirmed working.

create or replace function chs_normalize_phone(p text) returns text
language sql immutable as $$
  select case when p is null then null else
    case
      when regexp_replace(p, '[\s\-().]', '', 'g') ~ '^\+234[0-9]{10}$' then '0' || substr(regexp_replace(p, '[\s\-().]', '', 'g'), 5)
      when regexp_replace(p, '[\s\-().]', '', 'g') ~ '^234[0-9]{10}$'  then '0' || substr(regexp_replace(p, '[\s\-().]', '', 'g'), 4)
      else regexp_replace(p, '[\s\-().]', '', 'g')
    end
  end
$$;

create or replace function chs_phone_error(p text, p_allow_international boolean default false) returns text
language plpgsql immutable as $$
declare
  v text := chs_normalize_phone(p);
  n int;
begin
  if v ~ '^0[789][01][0-9]{8}$' then return null; end if;
  if p_allow_international and v ~ '^\+[1-9][0-9]{7,14}$' then return null; end if;
  n := length(regexp_replace(coalesce(v, ''), '\D', '', 'g'));
  return case
    when v ~ '[^0-9+]' then 'a phone number may only contain digits'
    when p_allow_international and v like '+%' then 'that international number looks incomplete or too long — include the country code, for example +447911123456'
    when n <> 11 then format('a Nigerian mobile number has exactly 11 digits, like 08012345678 — you entered %s', n)
    else 'that does not look like a real Nigerian mobile number — it should start with 070, 080, 081, 090 or 091'
  end;
end $$;

create or replace function chs_nin_error(p text) returns text
language plpgsql immutable as $$
declare v text := regexp_replace(coalesce(p, ''), '[\s\-]', '', 'g');
begin
  if v ~ '^[0-9]{11}$' then return null; end if;
  if v ~ '[^0-9]' then return 'a NIN contains digits only'; end if;
  return format('a National ID (NIN) number is exactly 11 digits — you entered %s', length(v));
end $$;

create or replace function chs_account_error(p text) returns text
language plpgsql immutable as $$
declare v text := regexp_replace(coalesce(p, ''), '[\s\-]', '', 'g');
begin
  if v ~ '^[0-9]{10}$' then return null; end if;
  if v ~ '[^0-9]' then return 'a bank account number contains digits only'; end if;
  return format('a bank account number is exactly 10 digits — you entered %s', length(v));
end $$;

create or replace function chs_id_number_error(t text, p text) returns text
language plpgsql immutable as $$
declare v text := upper(regexp_replace(coalesce(p, ''), '[\s\-]', '', 'g'));
begin
  if t is null then return null; end if;
  if t ilike 'national id%' or t ilike '%nin slip%' then return chs_nin_error(p); end if;
  if t ilike '%passport%' then
    if v ~ '^[A-Z][0-9]{8}$' then return null; end if;
    return 'a Nigerian international passport number is one letter followed by 8 digits, like A12345678';
  elsif t ilike '%voter%' then
    if v ~ '^[A-Z0-9]{19}$' then return null; end if;
    return format('a voter''s card number (VIN) is 19 letters and digits — you entered %s', length(v));
  elsif t ilike '%driver%' or t ilike '%licen%' then
    if v ~ '^[A-Z0-9]{10,15}$' then return null; end if;
    return format('a driver''s licence number is 10 to 15 letters and digits — you entered %s', length(v));
  end if;
  return null;
end $$;

create or replace function chs_normalize_id(t text, p text) returns text
language sql immutable as $$
  select case when t is null then p else upper(regexp_replace(coalesce(p, ''), '[\s\-]', '', 'g')) end
$$;

create or replace function chs_enforce_formats() returns trigger
language plpgsql as $$
declare
  arg text; col text; rule text; v text; err text; idtype text; label text;
  newj jsonb := to_jsonb(new);
  oldj jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  patch jsonb := '{}'::jsonb;
begin
  foreach arg in array tg_argv loop
    col := split_part(arg, ':', 1);
    rule := split_part(arg, ':', 2);
    v := newj ->> col;
    if v is null or btrim(v) = '' then continue; end if;
    if oldj is not null and (oldj ->> col) is not distinct from v then continue; end if;

    idtype := case when rule like 'id@%' then newj ->> substr(rule, 4) else null end;
    err := case
      when rule = 'phone_ng'  then chs_phone_error(v, false)
      when rule = 'phone_any' then chs_phone_error(v, true)
      when rule = 'nin'       then chs_nin_error(v)
      when rule = 'account'   then chs_account_error(v)
      when rule like 'id@%'   then chs_id_number_error(idtype, v)
      else null end;

    if err is not null then
      label := replace(initcap(replace(col, '_', ' ')), ' Id ', ' ID ');
      label := replace(replace(label, 'Nin', 'NIN'), 'Id Number', 'ID Number');
      raise exception 'invalid_format: % — %', label, err;
    end if;

    patch := patch || jsonb_build_object(col, case
      when rule in ('phone_ng', 'phone_any') then chs_normalize_phone(v)
      when rule in ('nin', 'account') then regexp_replace(v, '[\s\-]', '', 'g')
      when rule like 'id@%' then chs_normalize_id(idtype, v)
      else v end);
  end loop;

  if patch <> '{}'::jsonb then
    new := jsonb_populate_record(new, patch);
  end if;
  return new;
end $$;

drop trigger if exists trg_chs_formats on rental_applications;
create trigger trg_chs_formats before insert or update on rental_applications
  for each row execute function chs_enforce_formats('applicant_phone:phone_ng', 'guarantor_phone:phone_ng', 'guarantor_id_number:id@guarantor_id_type');

drop trigger if exists trg_chs_formats on buyer_id_verifications;
create trigger trg_chs_formats before insert or update on buyer_id_verifications
  for each row execute function chs_enforce_formats('id_number:id@id_type', 'contact_phone:phone_any');

drop trigger if exists trg_chs_formats on offers;
create trigger trg_chs_formats before insert or update on offers
  for each row execute function chs_enforce_formats('buyer_phone:phone_any');

drop trigger if exists trg_chs_formats on shortlet_bookings;
create trigger trg_chs_formats before insert or update on shortlet_bookings
  for each row execute function chs_enforce_formats('guest_phone:phone_any');

drop trigger if exists trg_chs_formats on engage_chs_requests;
create trigger trg_chs_formats before insert or update on engage_chs_requests
  for each row execute function chs_enforce_formats('contact_phone:phone_any');

drop trigger if exists trg_chs_formats on concierge_requests;
create trigger trg_chs_formats before insert or update on concierge_requests
  for each row execute function chs_enforce_formats('contact_phone:phone_any');

drop trigger if exists trg_chs_formats on document_dispatch_requests;
create trigger trg_chs_formats before insert or update on document_dispatch_requests
  for each row execute function chs_enforce_formats('delivery_phone:phone_any');

drop trigger if exists trg_chs_formats on agent_change_requests;
create trigger trg_chs_formats before insert or update on agent_change_requests
  for each row execute function chs_enforce_formats('requested_agent_phone:phone_ng');

drop trigger if exists trg_chs_formats on marketplace_vendors;
create trigger trg_chs_formats before insert or update on marketplace_vendors
  for each row execute function chs_enforce_formats('phone:phone_any');

drop trigger if exists trg_chs_formats on tenant_register;
create trigger trg_chs_formats before insert or update on tenant_register
  for each row execute function chs_enforce_formats('phone:phone_ng', 'emergency_contact_phone:phone_ng', 'id_number:id@id_type');

drop trigger if exists trg_chs_formats on linked_bank_accounts;
create trigger trg_chs_formats before insert or update on linked_bank_accounts
  for each row execute function chs_enforce_formats('account_number:account');

drop trigger if exists trg_chs_formats on pending_bank_account_changes;
create trigger trg_chs_formats before insert or update on pending_bank_account_changes
  for each row execute function chs_enforce_formats('account_number:account');

drop trigger if exists trg_chs_formats on profiles;
create trigger trg_chs_formats before update on profiles
  for each row execute function chs_enforce_formats('phone:phone_ng', 'nin:nin');

do $$
declare def text;
begin
  select pg_get_functiondef(oid) into def from pg_proc where proname = 'submit_buyer_id_verification';
  if position($a$if v_phone !~ '^(\+?234|0)[0-9]{10}$' then$a$ in def) = 0 then
    raise exception 'anchor not found in submit_buyer_id_verification';
  end if;
  def := replace(def,
    $a$if v_phone !~ '^(\+?234|0)[0-9]{10}$' then
    raise exception 'Please enter a valid phone number, for example 08012345678.';$a$,
    $a$if chs_phone_error(v_phone, true) is not null then
    raise exception 'Phone number: %', chs_phone_error(v_phone, true);$a$);
  execute def;
end $$;
