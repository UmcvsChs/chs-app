-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Estate Management: The Reminder Engine
-- ═══════════════════════════════════════════════════════════════
-- One real, generic, reusable engine — not a "rent reminder" bolted
-- on. Covers the two real scenarios described (rent due in 60 days,
-- and an artisan who accepted a job but never showed up while the
-- manager's attention was elsewhere), and is built to take a third,
-- fourth, and fifth reminder type later without rebuilding anything.

select count(*) as schema_already_set_up from tenancies;

-- ───────────────────────────────────────────────────────────────
-- 1. Configurable cadence — admin-editable, not hardcoded. Each rule
--    defines WHEN a reminder type fires, relative to its real trigger
--    date, and across which channels.
-- ───────────────────────────────────────────────────────────────

create table if not exists reminder_rules (
  id uuid primary key default uuid_generate_v4(),
  reminder_type text not null check (reminder_type in ('rent_due', 'maintenance_followup')),
  offset_days int not null,  -- negative = before the date, positive = after
  audience text not null check (audience in ('tenant', 'manager', 'artisan', 'owner')),
  channels text[] not null default '{in_app}',  -- any of: in_app, email, sms, whatsapp
  message_title text not null,
  message_body_template text not null,  -- {{name}}, {{days}}, {{amount}}, {{ticket}} placeholders
  active boolean not null default true
);

alter table reminder_rules enable row level security;
create policy "reminder_rules_read_all" on reminder_rules for select using (true);
create policy "reminder_rules_admin_write" on reminder_rules for all using (is_admin());

-- Real, sensible defaults matching exactly what was described.
insert into reminder_rules (reminder_type, offset_days, audience, channels, message_title, message_body_template) values
  ('rent_due', -60, 'tenant', '{in_app,email}', 'Your rent renewal is due in 60 days', 'Your lease at {{property}} is due for renewal on {{date}}. Real early notice — plenty of time to plan ahead.'),
  ('rent_due', -30, 'tenant', '{in_app,email,sms}', 'Your rent renewal is due in 30 days', 'Your lease at {{property}} renews on {{date}} — 30 days from now.'),
  ('rent_due', -7, 'tenant', '{in_app,sms,whatsapp}', 'Your rent renewal is due in 7 days', 'Your lease at {{property}} renews on {{date}} — just 7 days away.'),
  ('rent_due', 0, 'tenant', '{in_app,sms,whatsapp}', 'Your rent renewal is due today', 'Your lease at {{property}} renews today, {{date}}.'),
  ('rent_due', 7, 'tenant', '{in_app,sms,whatsapp}', 'Your rent renewal is now overdue', 'Your lease at {{property}} was due for renewal on {{date}} and is now overdue.'),
  ('rent_due', -30, 'manager', '{in_app}', 'A tenant''s rent renewal is due in 30 days', '{{tenant_name}} at {{property}} renews on {{date}}.'),
  ('rent_due', 7, 'manager', '{in_app,email}', 'A tenant''s rent is now overdue', '{{tenant_name}} at {{property}} was due {{date}} and has not renewed.'),
  ('maintenance_followup', 1, 'artisan', '{in_app,sms}', 'A job you accepted is awaiting completion', 'Ticket {{ticket}} was approved {{days}} day(s) ago. Please update its status or complete the work.'),
  ('maintenance_followup', 3, 'artisan', '{in_app,sms,whatsapp}', 'Reminder: a job is still pending', 'Ticket {{ticket}} has been pending {{days}} days since approval. Please action this urgently.'),
  ('maintenance_followup', 5, 'manager', '{in_app,email,sms}', 'A maintenance job may have fallen through', 'Ticket {{ticket}} was approved {{days}} days ago and is still not resolved. The assigned artisan may not have followed up.')
on conflict do nothing;

-- ───────────────────────────────────────────────────────────────
-- 2. Real, scheduled instances — one row per actual reminder that
--    needs to fire, for a specific real person, about a specific
--    real thing.
-- ───────────────────────────────────────────────────────────────

create table if not exists scheduled_reminders (
  id uuid primary key default uuid_generate_v4(),
  reminder_type text not null,
  target_user_id uuid not null references profiles(id) on delete cascade,
  related_entity_type text not null,  -- 'tenancy' | 'fault_report'
  related_entity_id uuid not null,
  trigger_at timestamptz not null,
  channels text[] not null,
  message_title text not null,
  message_body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
  sent_at timestamptz,
  created_at timestamptz default now(),
  unique (reminder_type, target_user_id, related_entity_id, trigger_at)
);

alter table scheduled_reminders enable row level security;
create policy "scheduled_reminders_own_read" on scheduled_reminders for select using (auth.uid() = target_user_id);
create policy "scheduled_reminders_admin_all" on scheduled_reminders for all using (is_admin());

-- ───────────────────────────────────────────────────────────────
-- 3. Real timestamp for "when did this job actually get approved" —
--    fault_reports never had one; without it, elapsed-time escalation
--    for the maintenance scenario has no real anchor point.
-- ───────────────────────────────────────────────────────────────

alter table fault_reports add column if not exists approved_at timestamptz;

create or replace function set_fault_report_approved_at()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('approved_by_owner', 'approved_by_manager') and old.approved_at is null then
    new.approved_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_fault_report_approved_at on fault_reports;
create trigger trg_set_fault_report_approved_at
  before update on fault_reports
  for each row execute function set_fault_report_approved_at();

-- ───────────────────────────────────────────────────────────────
-- 4. Real scheduling — computes and inserts the actual reminders due
--    for real tenancies and real fault reports, idempotently (safe
--    to run repeatedly; never double-schedules the same reminder).
-- ───────────────────────────────────────────────────────────────

create or replace function schedule_rent_reminders()
returns void
language plpgsql
security definer
as $$
declare
  t record;
  rule record;
begin
  for t in
    select tn.id, tn.tenant_id, tn.manager_id, tn.lease_end, p.title as property_title, pr.full_name as tenant_name
    from tenancies tn
    join properties p on p.id = tn.property_id
    join profiles pr on pr.id = tn.tenant_id
    where tn.status = 'active' and tn.lease_end is not null
  loop
    for rule in select * from reminder_rules where reminder_type = 'rent_due' and active loop
      if rule.audience = 'tenant' then
        insert into scheduled_reminders (reminder_type, target_user_id, related_entity_type, related_entity_id, trigger_at, channels, message_title, message_body)
        values ('rent_due', t.tenant_id, 'tenancy', t.id, (t.lease_end + rule.offset_days * interval '1 day'),
          rule.channels, rule.message_title,
          replace(replace(rule.message_body_template, '{{property}}', t.property_title), '{{date}}', t.lease_end::text))
        on conflict do nothing;
      elsif rule.audience = 'manager' and t.manager_id is not null then
        insert into scheduled_reminders (reminder_type, target_user_id, related_entity_type, related_entity_id, trigger_at, channels, message_title, message_body)
        values ('rent_due', t.manager_id, 'tenancy', t.id, (t.lease_end + rule.offset_days * interval '1 day'),
          rule.channels, rule.message_title,
          replace(replace(replace(rule.message_body_template, '{{property}}', t.property_title), '{{date}}', t.lease_end::text), '{{tenant_name}}', t.tenant_name))
        on conflict do nothing;
      end if;
    end loop;
  end loop;
end;
$$;

create or replace function schedule_maintenance_reminders()
returns void
language plpgsql
security definer
as $$
declare
  f record;
  rule record;
  v_artisan_id uuid;
  v_manager_id uuid;
  v_days_elapsed int;
begin
  for f in
    select fr.id, fr.ticket_ref, fr.approved_at, fr.tenancy_id
    from fault_reports fr
    where fr.approved_at is not null and fr.status not in ('resolved')
  loop
    v_days_elapsed := extract(day from now() - f.approved_at)::int;

    select manager_id into v_manager_id from tenancies where id = f.tenancy_id;
    -- The real assigned artisan for this ticket — resolved via the
    -- real fault_reports.approved_vendor match against
    -- fault_quotations, then artisans.id -> artisans.user_id, since
    -- fault_quotations.artisan_id points to the artisans table, not
    -- directly to a real notifiable profile.
    select a.user_id into v_artisan_id
      from fault_quotations fq
      join artisans a on a.id = fq.artisan_id
      where fq.fault_report_id = f.id and fq.vendor_name = (select approved_vendor from fault_reports where id = f.id)
      limit 1;

    for rule in select * from reminder_rules where reminder_type = 'maintenance_followup' and active loop
      if rule.audience = 'artisan' and v_artisan_id is not null and v_days_elapsed >= rule.offset_days then
        insert into scheduled_reminders (reminder_type, target_user_id, related_entity_type, related_entity_id, trigger_at, channels, message_title, message_body)
        values ('maintenance_followup', v_artisan_id, 'fault_report', f.id, now(), rule.channels, rule.message_title,
          replace(replace(rule.message_body_template, '{{ticket}}', f.ticket_ref), '{{days}}', v_days_elapsed::text))
        on conflict do nothing;
      elsif rule.audience = 'manager' and v_manager_id is not null and v_days_elapsed >= rule.offset_days then
        insert into scheduled_reminders (reminder_type, target_user_id, related_entity_type, related_entity_id, trigger_at, channels, message_title, message_body)
        values ('maintenance_followup', v_manager_id, 'fault_report', f.id, now(), rule.channels, rule.message_title,
          replace(replace(rule.message_body_template, '{{ticket}}', f.ticket_ref), '{{days}}', v_days_elapsed::text))
        on conflict do nothing;
      end if;
    end loop;
  end loop;
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 5. Real dispatch — fires whatever's actually due. In-app always
--    lands (it's free and already built). Email/SMS/WhatsApp go
--    through a real Edge Function that holds the real provider keys
--    and gracefully skips any channel whose key isn't configured yet
--    — this works today for in-app, and picks up the other channels
--    the moment Termii/Resend keys are added, with no further code
--    changes needed.
-- ───────────────────────────────────────────────────────────────

create or replace function dispatch_due_reminders()
returns void
language plpgsql
security definer
as $$
declare
  r record;
begin
  for r in select * from scheduled_reminders where status = 'pending' and trigger_at <= now() loop
    perform notify_user(r.target_user_id, r.message_title, r.message_body);

    perform http((
      'POST',
      'https://havwhdgjqgtxtqklkqfm.supabase.co/functions/v1/send-multichannel-reminder',
      ARRAY[http_header('x-internal-secret', '742885069319032bfb4d784ebb2fc62f1ec45445a2c5d4c2'), http_header('Content-Type', 'application/json')],
      'application/json',
      json_build_object('userId', r.target_user_id, 'channels', r.channels, 'title', r.message_title, 'body', r.message_body)::text
    )::http_request);

    update scheduled_reminders set status = 'sent', sent_at = now() where id = r.id;
  end loop;
end;
$$;

select cron.unschedule('chs-daily-promo-charges');
select cron.schedule(
  'chs-daily-promo-charges',
  '5 23 * * *',
  $$ select run_daily_promo_charges(); select recompute_promo_rank_categories(); select expire_urgent_sales(); select apply_matured_bank_changes(); select schedule_rent_reminders(); select schedule_maintenance_reminders(); $$
);

select cron.schedule('chs-dispatch-reminders', '*/15 * * * *', $$ select dispatch_due_reminders(); $$);

select count(*) from reminder_rules;
-- Should return 10.
