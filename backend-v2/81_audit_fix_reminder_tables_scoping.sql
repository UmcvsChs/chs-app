-- Real fix: neither of these cleanly belongs to a single sub-admin
-- domain — reminder_rules and scheduled_reminders both span rent_due
-- (owner/tenant) AND maintenance_followup (artisan/vendor) types.
-- Correct fix is Super Admin only, same as Finance.

drop policy if exists "reminder_rules_admin_write" on reminder_rules;
create policy "reminder_rules_admin_write" on reminder_rules for all using (
  exists (select 1 from profiles where id = auth.uid() and is_super_admin = true)
);

drop policy if exists "scheduled_reminders_admin_all" on scheduled_reminders;
create policy "scheduled_reminders_admin_all" on scheduled_reminders for all using (
  exists (select 1 from profiles where id = auth.uid() and is_super_admin = true)
);
