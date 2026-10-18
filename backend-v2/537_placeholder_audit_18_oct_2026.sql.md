# 537 - Placeholder audit and fixes, 18 Oct 2026 (LIVE)
Migrations: honest_reminders_test_flag_hotline, security_alerts_for_super_admin, security_alerts_money_events.
Undo test hiding: `drop policy hide_test_data on public.properties;` (same for marketplace_vendors, marketplace_products). Un-flag: `update <table> set is_test=false where ...` as admin.
Reminder dispatcher: see dispatch_due_reminders; results in scheduled_reminders.delivery_results.

## Staff admin domain limits (same night)
Migration: staff_admin_domain_limits_on_direct_writes. Trigger `trg_ac_staff_domain` (function `_guard_staff_domain`) on 84 tables: a non-super admin may write directly only to tables of their own staff role; money tables, bank details, reminders, fee settings are super-admin only. Tested rolled back: customer_care blocked on 13 other-area tables that were visible to it, owner_buyer_tenant blocked on 17; own-area writes still work. Undo one table: `drop trigger trg_ac_staff_domain on public.<table>;`
Amber TEST ACCOUNT strip restored on every screen for flagged accounts (needs the new zip). admin_set_account_test(user, bool) flips the flag for an account and its listings.
