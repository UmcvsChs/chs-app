-- Real, serious fix found during Phase 3: there was no way anywhere
-- in the app to actually mark a maintenance job resolved, or pay the
-- artisan for approved work.

alter table fault_reports drop constraint if exists fault_reports_status_check;
alter table fault_reports add constraint fault_reports_status_check
  check (status in ('reported','assigned','converted_to_quote','gathering_quotes','awaiting_owner_approval','awaiting_manager_approval','approved_by_owner','approved_by_manager','completed_pending_confirmation','resolved'));

create or replace function submit_job_completion(p_fault_report_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_artisan_user_id uuid;
begin
  select a.user_id into v_artisan_user_id
    from fault_reports fr
    join fault_quotations fq on fq.fault_report_id = fr.id and fq.vendor_name = fr.approved_vendor
    join artisans a on a.id = fq.artisan_id
    where fr.id = p_fault_report_id
    limit 1;

  if v_artisan_user_id != auth.uid() then
    raise exception 'Only the real, approved artisan on this job can mark it complete.';
  end if;

  update fault_reports set status = 'completed_pending_confirmation' where id = p_fault_report_id;
end;
$$;

-- Note: confirm_job_completion is superseded by the version in
-- migration 95, which correctly draws from the maintenance reserve
-- first. See that file for the final, real implementation.
create or replace function confirm_job_completion(p_fault_report_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_payer_id uuid;
  v_artisan_user_id uuid;
  v_amount numeric;
  v_balance numeric;
  v_reference text;
begin
  select
    coalesce(
      (select case when t.management_delegated then t.manager_id else t.landlord_id end from tenancies t where t.id = fr.tenancy_id),
      (select p.owner_id from properties p where p.id = fr.property_id)
    ),
    fr.approved_amount
    into v_payer_id, v_amount
    from fault_reports fr where fr.id = p_fault_report_id;

  if v_payer_id != auth.uid() and not is_admin() then
    raise exception 'Only the real, responsible owner or manager can confirm this job is complete.';
  end if;
  if v_amount is null then
    raise exception 'This job has no real approved amount to pay.';
  end if;

  select a.user_id into v_artisan_user_id
    from fault_reports fr
    join fault_quotations fq on fq.fault_report_id = fr.id and fq.vendor_name = fr.approved_vendor
    join artisans a on a.id = fq.artisan_id
    where fr.id = p_fault_report_id
    limit 1;

  select main_balance into v_balance from wallets where user_id = v_payer_id;
  if v_balance is null or v_balance < v_amount then
    raise exception 'Insufficient wallet balance to pay for this job.';
  end if;

  v_reference := 'JOB-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - v_amount, updated_at = now() where user_id = v_payer_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_payer_id, 'main', v_amount, 'debit', 'Maintenance job payment', v_reference);

  update wallets set main_balance = main_balance + v_amount, updated_at = now() where user_id = v_artisan_user_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_artisan_user_id, 'main', v_amount, 'credit', 'Maintenance job payment received', v_reference);

  update fault_reports set status = 'resolved' where id = p_fault_report_id;

  perform notify_user(v_artisan_user_id, '💰 Payment received', 'You have been paid ' || v_amount || ' for a completed job.');
end;
$$;
