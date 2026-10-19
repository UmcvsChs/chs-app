# 538 - Admin access standing order (decided and BUILT 18 Oct 2026, LIVE)

Decided by the CHS team on 18 Oct 2026. One super admin only (Rufus Olushola Timothy, 08037799837). Verified that day: no other admin exists.

## Rule 1 - Admins only by invite link
- Only the super admin can create an admin, by generating a link for a chosen category (customer_care, registration_setup, owner_buyer_tenant, agent_relations, artisan_dev_pm_vendor).
- Link valid 10 minutes, single use, bound to the invitee's phone number. Expired or unused: super admin issues a new one.
- Registering through the link is the only way to become an admin. The old assign_staff_role (promote by phone) is removed.
- Super admin can remove an admin at any time: access stops immediately, history kept.
- Every issue / use / expiry / removal is logged and raises a security alert.

## Rule 2 - Approval code for every admin login (not the super admin)
- Admin asks for a login code; super admin issues a one-time code valid 5 minutes.
- Enforced inside the database (is_admin() requires a valid approval), not only on screens.
- 3 wrong codes lock the account until the super admin unlocks it. A removed admin's codes always read "wrong code".
- Session: logged out automatically after 120 minutes with no activity (decided by the team; replaces the earlier 8-hour proposal).
- Super admin is exempt from the code (so he cannot lock himself out) but his account must be protected by authenticator-app two-step sign-in or a long passphrase, plus a written recovery plan held by the Supabase account owner.
- Optional later: WhatsApp alert to the super admin (needs the Termii sender and WhatsApp approval).

## Today's facts
- is_admin() ignores the existing admin_login_requests approval, and the existing code uses plain random(): both to be replaced.

## What was built (migration admin_access_invites_codes_idle_logout)
Tables admin_invites, admin_access, admin_access_log (no direct access from the app). is_admin() and staff_can_access() now require a valid admin session (super admin always valid). Functions: create_admin_invite, peek_admin_invite, redeem_admin_invite, remove_admin, request_admin_code, admin_issue_code, admin_enter_code, admin_heartbeat, admin_end_session, admin_session_status, admin_unlock, admin_team_overview. assign_staff_role and resolve_admin_login are switched off. Trigger trg_aa_a_guard_admin_creation: no profile can become admin / super admin except through redeem_admin_invite (also blocks raw SQL edits). Idle limit 120 minutes enforced in the database (heartbeat) and by components/AdminIdleGuard.tsx.
Screens: /admin-invite/[token], /admin-approval-pending (code entry), Admin > assign role tab (AdminTeamPanel) and a request box on the dashboard.
Tested (rolled back): self-promote, old assign route, non-super invite, raw SQL promote, wrong account using link, expired link, reused link: all refused. Admin with no code sees nothing; 2 wrong then right code works; 121 minutes idle = no access and heartbeat cannot revive; 3 wrong = locked, even the right code then fails; super admin unaffected; removed admin loses role and old code fails.
Undo of the gate in an emergency: restore is_admin() to `select exists (select 1 from profiles where id = auth.uid() and role = 'admin')`.
Decision: the invitee must already have an ordinary account (normal sign-up) and the link upgrades it; the link expiry is checked when it is accepted.
