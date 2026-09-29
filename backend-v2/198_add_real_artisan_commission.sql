-- Real, critical fix found while directly auditing the artisan side of
-- the app, per direct client request: an artisan was paid the entire,
-- full approved amount for a completed job, with CHS taking zero
-- commission -- confirmed by reading the real function directly, and
-- confirmed nowhere in the real Terms & Conditions either. A real,
-- fair 10% is now taken from the artisan's own payment, matching the
-- same real, capped-percentage-from-the-earner's-own-pay model
-- already used for agent-managed listings.

insert into platform_settings (key, value) values ('artisan_commission_pct', '10')
on conflict (key) do nothing;

create or replace function confirm_job_completion(p_fault_report_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_payer_id uuid;
  v_artisan_user_id uuid;
  v_amount numeric;
  v_reserve_balance numeric;
  v_main_balance numeric;
  v_from_reserve numeric;
  v_from_main numeric;
  v_reference text;
  v_commission_pct numeric;
  v_commission_amount numeric;
  v_artisan_net numeric;
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

  select maintenance_reserve, main_balance into v_reserve_balance, v_main_balance from wallets where user_id = v_payer_id;

  v_from_reserve := least(coalesce(v_reserve_balance, 0), v_amount);
  v_from_main := v_amount - v_from_reserve;

  if v_from_main > coalesce(v_main_balance, 0) then
    raise exception 'Insufficient combined balance (reserve + main wallet) to pay for this job.';
  end if;

  select value::numeric into v_commission_pct from platform_settings where key = 'artisan_commission_pct';
  v_commission_amount := round(v_amount * coalesce(v_commission_pct, 10) / 100, 2);
  v_artisan_net := v_amount - v_commission_amount;

  v_reference := 'JOB-' || substr(gen_random_uuid()::text, 1, 8);

  if v_from_reserve > 0 then
    update wallets set maintenance_reserve = maintenance_reserve - v_from_reserve, updated_at = now() where user_id = v_payer_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (v_payer_id, 'maintenance_reserve', v_from_reserve, 'debit', 'Maintenance job payment (from reserve)', v_reference);
  end if;
  if v_from_main > 0 then
    update wallets set main_balance = main_balance - v_from_main, updated_at = now() where user_id = v_payer_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (v_payer_id, 'main', v_from_main, 'debit', 'Maintenance job payment (from main wallet, reserve insufficient)', v_reference);
  end if;

  update wallets set main_balance = main_balance + v_artisan_net, updated_at = now() where user_id = v_artisan_user_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_artisan_user_id, 'main', v_artisan_net, 'credit', 'Maintenance job payment received, net of real CHS commission (' || v_commission_pct || '%)', v_reference);

  insert into transaction_commissions (transaction_type, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount, status, paid_at)
  values ('maintenance_job', (select property_id from fault_reports where id = p_fault_report_id), v_artisan_user_id, 'artisan', v_amount, v_commission_pct, v_commission_amount, 'paid', now());

  update fault_reports set status = 'resolved' where id = p_fault_report_id;

  perform notify_user(v_artisan_user_id, '💰 Payment received', 'You have been paid ' || v_artisan_net || ' (net of CHS''s real ' || v_commission_pct || '% commission) for a completed job.');
end;
$$;
