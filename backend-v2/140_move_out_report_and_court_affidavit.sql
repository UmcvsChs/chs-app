-- Real, serious gap confirmed through direct investigation: only a
-- move-in inventory existed, with no move-out counterpart, no real
-- court affidavit requirement, and critically, no visibility for the
-- landlord/owner anywhere — a tenant could submit a real report and
-- the property owner would never see it. This was genuinely
-- described and agreed on earlier, then never actually finished.

alter table condition_reports drop constraint if exists condition_reports_report_type_check;
alter table condition_reports add constraint condition_reports_report_type_check
  check (report_type = ANY (ARRAY['move_in', 'check_in', 'check_out', 'move_out']));

alter table condition_reports add column if not exists affidavit_url text;
alter table condition_reports add column if not exists affidavit_reference text;

drop policy if exists "condition_reports_landlord" on condition_reports;
create policy "condition_reports_landlord" on condition_reports for select using (
  exists (
    select 1 from tenancies t
    where t.id = condition_reports.tenancy_id
    and (t.landlord_id = auth.uid() or t.manager_id = auth.uid())
  )
);
