-- Real, serious fix: management_delegated could only ever be set to
-- true anywhere in the app — there was no way to ever end a manager's
-- delegation.

create or replace function request_management_termination(p_tenancy_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_landlord_id uuid;
  v_manager_id uuid;
  v_new_id uuid;
begin
  select landlord_id, manager_id into v_landlord_id, v_manager_id from tenancies where id = p_tenancy_id;

  if v_landlord_id != auth.uid() and not is_admin() then
    raise exception 'Only the real property owner can request ending management delegation.';
  end if;

  insert into management_termination_requests (tenancy_id, requested_by, reason, notice_period_ends_at, status)
  values (p_tenancy_id, auth.uid(), p_reason, now() + interval '30 days', 'pending')
  returning id into v_new_id;

  if v_manager_id is not null then
    perform notify_user(v_manager_id, '📋 Management termination requested',
      'The owner has requested to end your management of this property, effective in 30 days real notice.');
  end if;

  return v_new_id;
end;
$$;

create or replace function process_management_terminations()
returns void
language plpgsql
security definer
as $$
declare
  r record;
begin
  for r in select * from management_termination_requests where status = 'pending' and notice_period_ends_at <= now() loop
    update tenancies set management_delegated = false, manager_id = null where id = r.tenancy_id;
    update management_termination_requests set status = 'confirmed' where id = r.id;

    perform notify_user(r.requested_by, '✓ Management delegation ended',
      'The 30-day real notice period has passed — this property is no longer manager-delegated.');
  end loop;
end;
$$;

select cron.unschedule('chs-daily-promo-charges');
select cron.schedule(
  'chs-daily-promo-charges',
  '5 23 * * *',
  $$ select run_daily_promo_charges(); select recompute_promo_rank_categories(); select expire_urgent_sales(); select apply_matured_bank_changes(); select schedule_rent_reminders(); select schedule_maintenance_reminders(); select process_management_terminations(); $$
);
