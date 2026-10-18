# 536 — Full security audit, 18 Oct 2026 (everything below is LIVE in the database / edge functions)

This note lists every security change made in the audit of 18 Oct 2026, the migration that carries it (see Supabase > Database > Migrations), how it was
tested, and how to undo it if it ever blocks a real user. Nothing in this note is a claim that the platform is "fully secure". The last section lists what
was NOT covered.

## How the tests were done
Each fix was tested inside the database as a real ordinary user (a "stranger" with no connection to the data), impersonating that user's login and calling
the same functions and tables the app uses. Every test ran in a transaction that was rolled back, so no real data changed. A pass means the attack was
refused; a pass for the real user means the normal feature still works.

## A. Users could change their own account (profiles)
Migrations: guard_protected_columns_profiles, guard_profiles_run_first, guard_columns_invoker.
A signed-in user could write directly to their own profile row through the API, including role, super-admin flag, staff role, verification flags, status,
phone, email and NIN. Now a trigger (`trg_aa_guard_profiles`, function `_guard_columns`) refuses those changes unless the caller is an admin or one of our
own functions. Test: as a normal user, setting role='admin' / is_super_admin=true is refused.

## B. Users could write directly to money and approval tables
Migrations: guard_client_writes_all_sensitive_tables, guard_remaining_user_writable_tables.
Trigger `trg_aa_guard_client` (function `_guard_client_writes`, per-table rules) now protects: offers, shortlet_bookings, tenancies, rental_applications,
linked_bank_accounts, pending_bank_account_changes, notifications, properties, property_promotions, promoted_listings, referral_fees_owed, service_charges,
estates, artisans, marketplace_vendors, buyer_id_verifications, liveness_submissions, developer_applications, account_appeals, engage_chs_requests,
agent_owner_commission_rates AND (second pass) inspections, property_documents, property_sale_documents, document_dispatch_requests,
service_quote_requests, marketplace_products, marketplace_bundles, disputes, formal_notices. Extra trigger `_guard_status_fields` protects
condition_reports and fault_reports (a tenant cannot approve a vendor/amount or mark a report approved).
Examples now refused: an owner marking their own documents "verified"; a requester marking an inspection paid or setting its fee; a vendor setting a
status other than active / sold out / delisted; a tenant setting an approved vendor and amount on their own fault.
Undo one table: `drop trigger trg_aa_guard_client on public.<table>;` (only if a real feature is blocked; tell the developer first).

## C. Forged notifications and audit entries
Migrations: notify_user_no_spoofing, audit_log_internal_only_and_readiness_scoped.
Calling notify_user straight from the app is now allowed only towards people you genuinely deal with, with in-app links only. Tested at the top level
(the way the app calls it): refused for an unrelated user. log_audit_event is no longer callable from the app (never was used by it).

## D. The "wrong person" bug (NULL owner checks)
Migration: null_safe_owner_checks_everywhere. About 106 functions compared `owner != auth.uid()`; when the owner was empty the check passed for anyone.
All rewritten as `is distinct from`.

## E. Functions callable by logged-out visitors or by anyone
Migrations: revoke_anon_execute_on_internal_and_money_functions, harden_pin_reset_and_revoke_auth_only_anon, close_callable_function_gaps,
close_apply_admin_action_direct_call.
- Logged-out visitors can run only the 39 public-page functions (property pages, hotel pages, verify-agent, verify-chs, tenant invites, split links).
- `apply_admin_action` could be run by ANY signed-in user and applied a stored admin action (verify a property, clear a sale, approve a profile,
  freeze/unfreeze a wallet, mark a referral paid) even if no one had approved it. Found by the all-functions sweep today. Now not callable from the app;
  only resolve_admin_action (super admin) and request_admin_action reach it.
- run_test_suite, schedule_shortlet_message_escalations, purchase_promo_credits: not callable from the app.
- request_admin_login now requires an admin account.
Undo a revoke: `grant execute on function public.<name>(<args>) to authenticated;`

## F. Forgot-PIN
reset_pin_with_nin_verification: 5 wrong tries per phone per hour locks for an hour, one generic message, admin/staff accounts refused, every reset audited
and notified. (Needs the new zip: the page reads success/message.)

## G. PIN rules
platform_settings: transfer_requires_pin = true (since 18 Oct), withdrawal_requires_pin = true (18 Oct, late). A user without a Payment PIN must now set
one before sending money to another user or withdrawing to a bank. The wallet screen already shows the PIN box.

## H. Storage (private documents)
Migration: storage_policies_tighten_guarantor_and_fix_event_doc. A guarantor's ID document was readable by anyone logged out who knew the link. Now the open
read rule is removed (people with the proper account permissions read it through a short-lived signed link); the guarantor upload link can upload only
to its own folder. The guarantor page now stores the file path
instead of a signed link, and admin opens it with a fresh signed link (needs the new zip).

## I. Secrets
Migration: rotate_internal_secret_and_dispatch_reads_table. An internal secret was written inside backend-v2/69_reminder_engine.sql (and so in GitHub and in
earlier zips). It has been ROTATED (the old value no longer works) and the file now reads it from the private_secrets table. Treat any old zip as
containing a dead secret only.

## J. Edge functions (live as soon as deployed)
- register-user v7: only ordinary roles can be chosen at sign-up (no admin).
- lookup-account-for-linking v7: masked name and rate limit (no phone/NIN enumeration).
- send-multichannel-reminder v6: checks the rotated secret.
- paystack-transfer-webhook v10: signature checked in constant time; every credit once per payment reference; NOW ALSO checks what was paid:
  promo credits cannot exceed amount/₦400, roadmap unlock needs at least the fee, only successful NGN payments count (someone starting a Paystack
  payment themselves could previously put any "credits" number in the payment details).
- add-role-to-account v7: only ordinary roles can be added (before, any role text, including admin, was accepted); admin accounts cannot be changed here.
- Reviewed and left as is: initiate-withdrawal (checks session, 48-hour bank-change window, wallet rules, PIN/code, balance, then Paystack; the wallet
  debit functions cannot be called from the app), initialize-wallet-funding, initialize-promo-credit-funding, initialize-roadmap-funding (amount computed on
  the server), resolve-bank-account, list-nigerian-banks, verify-identity-document (super admin only), webauthn-* (login only succeeds with a valid
  signature from a registered device).

## K. Other
- get_readiness_score: only the person, an admin, or the owner of a property they booked an inspection on can read it.
- search_path pinned on all 189 SECURITY DEFINER functions (migration pin_search_path_on_security_definer_functions).
- Supabase leaked-password protection is deliberately NOT enabled: PINs are the passwords and would be rejected.

## L. Second round (same evening): the items that were listed as "not covered"
Migrations: nin_stored_as_keyed_hash_only, rate_limits_for_lookups, staff_admin_cannot_promote_and_admin_profile_update_policy,
settings_and_fee_tables_super_admin_only, block_direct_api_writes_on_money_tables_for_everyone.
- NIN: profiles.nin no longer holds the number. It is stored as a keyed hash (nin_hash, HMAC-SHA256 with a secret kept in private_secrets, key nin_pepper)
  plus the last 4 digits (nin_last4) for display. Trigger `trg_zz_protect_nin` converts any NIN written in future, so the plain number can never be saved
  again. All 46 existing accounts were converted. Forgot-PIN, duplicate-NIN check at sign-up (register-user v8 via nin_taken) and the agent badge check use
  the hash. Clients cannot write nin_hash / nin_last4 and cannot call nin_hash. The NIN is not recoverable from the database; if the secret is lost, forgot-PIN
  matching stops working for everyone, so never delete the nin_pepper row. Note: an ID number typed on an ID-verification form (buyer_id_verifications,
  profiles.valid_id_number, guarantor id number) is still stored as typed, because an admin must read it to compare with the document. That is a remaining item.
- Rate limits: transfer recipient lookup 20 per hour per user (database); bank-account name check 15 per hour per user (resolve-bank-account v4);
  biometric login lookup 10 per hour per phone and 40 per hour per address, and one identical answer for "no account" and "no biometric"
  (webauthn-auth-options v6); biometric verify 10 per hour per account (webauthn-auth-verify v5). Table lookup_attempts, function _lookup_allowed.
- FOUND AND FIXED: a staff admin (not a super admin) could promote themselves to super admin by writing their own profile through the API (tested: it
  worked before the fix). Now a trigger (`trg_ab_guard_admin_profile`) stops staff admins changing role, super-admin flag, staff role, status and
  verification fields on their own account, and limits what they can change on other accounts to verification marks and the "read" stamp.
- FOUND AND FIXED: the admin buttons "mark agent ID verified", "mark manager credentials verified" and the registration "read" mark were silently doing
  nothing because admins had no permission to update profiles. A policy (profiles_admin_update) now lets admins do exactly the changes the trigger allows.
- FOUND AND FIXED: a staff admin could change any platform setting (fees, PIN switches, release limits). Platform settings, referral fee settings,
  promotion packages and location pricing can now be changed by a super admin only (staff can still read them).
- Money tables (wallets, wallet_transactions, withdrawal_requests, rent_payments, rent_to_own_agreements/payments, sale_installment_payments,
  transaction_commissions, remittances, promo_credit_transactions, part_release_log, wallet_locks): direct writes from the app are now refused for EVERYONE,
  including super admins (trigger `trg_aa_block_money_writes`). Money moves only through the payment functions and the server-side functions. The app never
  wrote to these tables directly (checked), so nothing changes for users. Undo for one table: `drop trigger trg_aa_block_money_writes on public.<table>;`.

## Sweeps run today (all as a stranger, all rolled back)
1. 232 + 300 functions with an id as first argument, each called against about 60 real ids from 40 tables (about 19,000 calls). Result: only harmless public
   getters or forms succeeded, plus the apply_admin_action hole, which is now closed.
2. 173 functions with no id as first argument: only "my own data" functions, a lookup by exact phone/email used for transfers, and harmless getters.
3. 78 read functions: no private data returned to a stranger.

## NOT covered / still a risk (be honest with the team)
- Staff admins (the five staff roles) are separated by domain inside the screens and in some database rules, but many tables still let any admin write
  directly (for example offers, tenancies, properties). A staff admin account that is stolen or misused can do more than its screen shows. Give staff
  accounts only to people you trust, use two-step sign-in on their phones, and review the audit log weekly. Next step if wanted: move each admin write behind a
  checked function.
- ID numbers typed on ID-verification forms (not the NIN field in profiles) are stored as typed so admin can compare them with the document.
- Paystack dashboard, Supabase dashboard and GitHub accounts: two-step sign-in, a separate login for each person, rotate the Paystack secret key if anyone who
  has seen it leaves. Outside the code.
- The "two people approve" rule is only on the actions in admin_action_requests and on part/full releases.
- A professional penetration test by an outside firm has not been done. Before large money volumes, get one.
