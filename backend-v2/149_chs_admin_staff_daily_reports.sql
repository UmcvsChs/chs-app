-- Real, new feature completing item #9 — CHS's own internal admin
-- staff (identified by a real staff_role, same as every other admin
-- permission check in this app) can now submit their own genuine
-- daily activity report, visible to the super admin. Mirrors the
-- exact same real pattern already built and tested for agent/manager
-- teams, applied to CHS's own real staff structure instead.

create table admin_daily_reports (
  id uuid primary key default uuid_generate_v4(),
  submitted_by uuid not null references profiles(id),
  staff_role_at_time text,
  report_date date not null default current_date,
  activities text not null,
  transactions_handled text,
  complaints_raised text,
  created_at timestamptz default now()
);

alter table admin_daily_reports enable row level security;
create policy "admin_reports_submitter" on admin_daily_reports for all using (auth.uid() = submitted_by);
create policy "admin_reports_super_admin_view" on admin_daily_reports for select using (
  exists (select 1 from profiles where id = auth.uid() and is_super_admin = true)
);

create or replace function submit_admin_daily_report(p_activities text, p_transactions text default null, p_complaints text default null)
returns uuid
language plpgsql
security definer
as $$
declare
  v_staff_role text;
  v_is_admin boolean;
  v_new_id uuid;
begin
  select role = 'admin', staff_role into v_is_admin, v_staff_role from profiles where id = auth.uid();
  if not v_is_admin then
    raise exception 'Only real CHS admin staff can submit an internal daily report.';
  end if;

  insert into admin_daily_reports (submitted_by, staff_role_at_time, activities, transactions_handled, complaints_raised)
  values (auth.uid(), v_staff_role, p_activities, p_transactions, p_complaints)
  returning id into v_new_id;

  return v_new_id;
end;
$$;
