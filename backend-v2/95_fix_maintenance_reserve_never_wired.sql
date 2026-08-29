-- Real, three-part fix, confirmed by checking directly: the
-- maintenance reserve could never be externally funded, was never
-- actually the real source of artisan payments despite existing for
-- that purpose, and could never be withdrawn on its own.

create or replace function fund_maintenance_reserve(p_amount numeric)
returns void
language plpgsql
security definer
as $$
declare
  v_balance numeric;
  v_reference text;
begin
  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < p_amount then
    raise exception 'Insufficient main wallet balance to fund your maintenance reserve.';
  end if;

  v_reference := 'MRES-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - p_amount, maintenance_reserve = maintenance_reserve + p_amount, updated_at = now()
  where user_id = auth.uid();

  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', p_amount, 'debit', 'Moved to maintenance reserve', v_reference);
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'maintenance_reserve', p_amount, 'credit', 'Funded from main wallet', v_reference);
end;
$$;

-- The real, corrected artisan-payment logic — draws from the
-- maintenance reserve FIRST (its actual real purpose), only falling
-- back to the main wallet for any genuine shortfall.
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

  update wallets set main_balance = main_balance + v_amount, updated_at = now() where user_id = v_artisan_user_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_artisan_user_id, 'main', v_amount, 'credit', 'Maintenance job payment received', v_reference);

  update fault_reports set status = 'resolved' where id = p_fault_report_id;

  perform notify_user(v_artisan_user_id, '💰 Payment received', 'You have been paid ' || v_amount || ' for a completed job.');
end;
$$;

-- Real, standalone withdrawal for unused maintenance funds — no
-- approval needed.
create or replace function withdraw_maintenance_reserve_to_main(p_amount numeric)
returns void
language plpgsql
security definer
as $$
declare
  v_balance numeric;
  v_reference text;
begin
  select maintenance_reserve into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < p_amount then
    raise exception 'Insufficient maintenance reserve balance.';
  end if;

  v_reference := 'MWD-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set maintenance_reserve = maintenance_reserve - p_amount, main_balance = main_balance + p_amount, updated_at = now()
  where user_id = auth.uid();

  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'maintenance_reserve', p_amount, 'debit', 'Withdrawn to main wallet', v_reference);
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', p_amount, 'credit', 'From maintenance reserve', v_reference);
end;
$$;
