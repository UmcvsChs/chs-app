-- Real, direct client feedback: merging "Guest" into "Buyer" as one
-- combined label was the wrong call — a genuine, separate role
-- deserves its own real heading, matching every other role, not a
-- footnote on someone else's. Checked first that this is genuinely
-- safe: no real backend function anywhere checks for the specific
-- string 'buyer' to grant permissions (shortlet/hire booking already
-- works off auth.uid() matching, not role), so adding a real,
-- separate role here doesn't touch any existing permission logic.

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role = ANY (ARRAY['buyer', 'tenant', 'owner', 'agent', 'manager', 'developer', 'admin', 'guest']));
