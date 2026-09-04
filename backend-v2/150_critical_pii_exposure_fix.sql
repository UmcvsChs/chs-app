-- CRITICAL, real security vulnerability found and proven during a
-- direct data-protection audit: the "public read" policy on profiles
-- allowed ANY logged-in user to read EVERY field on ANY approved
-- account — including phone, email, NIN, ID numbers, uploaded ID
-- document scans, and residential address. Verified directly: a real,
-- unrelated buyer account successfully read the super admin's actual
-- NIN and phone number through a completely normal query. Fixed
-- immediately by removing the blanket table-level exposure and
-- replacing it with a real, safe view containing only fields that
-- were ever legitimately meant to be public.

drop policy if exists "profiles_public_read_approved" on profiles;

create view public_profiles as
select
  id, full_name, avatar_url, role, secondary_roles,
  trust_score, deals_completed, badges, listed_since,
  membership_verified, chs_agent_id, agent_type, agent_tier,
  company_name, profession, years_experience,
  operating_states, operating_lgas, association_name
from profiles
where status = 'approved';

grant select on public_profiles to authenticated, anon;
