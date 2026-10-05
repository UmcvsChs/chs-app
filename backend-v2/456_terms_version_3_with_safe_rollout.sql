-- ============================================================================
-- 456 — Terms & Conditions Version 3, with a rollout that cannot lock anyone out
-- ============================================================================
-- DECISION: raise the Terms to Version 3 and ask every user to accept once more. Version 3
-- (on top of Version 2's term 36) rewrites term 11: hotels, lodges, shortlets and event centres
-- are booked request-first (nothing is charged until the host confirms; short payment windows by
-- urgency; urgent stays need a pre-funded wallet); everything between guest and host goes through
-- CHS; messages are reviewed before delivery until a booking is paid; phone numbers and emails are
-- blocked; hosts see a guest's name and CHS reference only. These change what users pay, when,
-- and what they can do, so fresh, recorded acceptance is the standard way to make them binding.
-- Everyone is asked once, on their next visit, shown what is new (the banner covers every change
-- since Version 1). Acceptances are logged permanently (terms_acceptances) with version and time.
--
-- ROLLOUT SAFETY: accept_terms() used to refuse anything but the exact current version, so raising
-- the version before the new pages were deployed would have locked out anyone who needed to
-- accept (the old pages send the old number). It now accepts any version from 1 up to the current
-- and RECORDS THE VERSION THE PERSON ACTUALLY SAW (never one that does not exist yet). Deployment
-- order therefore does not matter: someone who accepts through an old page is recorded truthfully
-- as having accepted the older version, and is asked again, once, afterwards.
--
-- Verified (rolled back): current version 3; all 21 people who had accepted before must re-accept;
-- a version-2 user accepting 3 is recorded as 3; a user on the old page sending 2 is recorded as 2
-- and will be asked again; versions 4, 0 and null are refused; a signed-out visitor is refused;
-- the log has no write policies.

create or replace function accept_terms(p_version int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current int;
  v_name text;
  v_phone text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept the Terms & Conditions.';
  end if;

  select value::int into v_current from platform_settings where key = 'terms_current_version';
  if v_current is null then
    raise exception 'The current Terms version is not configured.';
  end if;
  if p_version is null or p_version < 1 or p_version > v_current then
    raise exception 'terms_version_outdated: The Terms & Conditions have been updated since this page loaded. Please refresh the page and read the latest version.';
  end if;

  select full_name, phone into v_name, v_phone from profiles where id = auth.uid();

  insert into terms_acceptances (user_id, user_name, user_phone, terms_version)
  values (auth.uid(), v_name, v_phone, p_version);

  update profiles set terms_accepted_at = now(), terms_version_accepted = p_version where id = auth.uid();
end;
$$;

update platform_settings set value = '3', updated_at = now() where key = 'terms_current_version';
