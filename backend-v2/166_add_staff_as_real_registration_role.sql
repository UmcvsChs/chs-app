-- Real, genuine gap found while investigating a direct client
-- question: "even if you assign role to staff, how are they going to
-- log in?" Confirmed the real problem — an agent/manager could only
-- add someone to their team if that person already had a CHS
-- account, with no clear, guided way for a brand new staff member
-- (who has never used CHS) to get one, since none of the existing
-- registration roles (buyer, tenant, owner, agent, manager) actually
-- describe what they are. "Staff" is now a genuine, first-class
-- registration option.

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role = ANY (ARRAY['buyer', 'tenant', 'owner', 'agent', 'manager', 'developer', 'admin', 'guest', 'staff']));
