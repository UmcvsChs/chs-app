-- Real, serious fix found during Phase 3 of the audit: nowhere in the
-- entire app could a tenant actually pay their real annual rent to
-- their landlord.

create table if not exists rent_payments (
  id uuid primary key default uuid_generate_v4(),
  tenancy_id uuid not null references tenancies(id) on delete cascade,
  tenant_id uuid not null references profiles(id),
  landlord_id uuid not null references profiles(id),
  amount numeric(14,2) not null,
  covers_period_start date not null,
  covers_period_end date not null,
  reference text,
  created_at timestamptz default now()
);

alter table rent_payments enable row level security;
create policy "rent_payments_tenant_read" on rent_payments for select using (auth.uid() = tenant_id);
create policy "rent_payments_landlord_read" on rent_payments for select using (auth.uid() = landlord_id);
create policy "rent_payments_admin_all" on rent_payments for all using (staff_can_access('owner_buyer_tenant'));

create or replace function pay_rent(p_tenancy_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_landlord_id uuid;
  v_annual_rent numeric;
  v_lease_end date;
  v_balance numeric;
  v_reference text;
  v_new_lease_end date;
begin
  select tenant_id, landlord_id, annual_rent, lease_end
    into v_tenant_id, v_landlord_id, v_annual_rent, v_lease_end
    from tenancies where id = p_tenancy_id;

  if v_tenant_id != auth.uid() then
    raise exception 'Only the real tenant on this tenancy can pay this rent.';
  end if;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_annual_rent then
    raise exception 'Insufficient wallet balance. Your annual rent is %.', v_annual_rent;
  end if;

  v_reference := 'RENT-' || substr(gen_random_uuid()::text, 1, 8);
  v_new_lease_end := v_lease_end + interval '1 year';

  update wallets set main_balance = main_balance - v_annual_rent, updated_at = now() where user_id = v_tenant_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_tenant_id, 'main', v_annual_rent, 'debit', 'Rent payment', v_reference);

  update wallets set main_balance = main_balance + v_annual_rent, updated_at = now() where user_id = v_landlord_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_landlord_id, 'main', v_annual_rent, 'credit', 'Rent payment received', v_reference);

  insert into rent_payments (tenancy_id, tenant_id, landlord_id, amount, covers_period_start, covers_period_end, reference)
  values (p_tenancy_id, v_tenant_id, v_landlord_id, v_annual_rent, v_lease_end, v_new_lease_end, v_reference);

  update tenancies set lease_end = v_new_lease_end where id = p_tenancy_id;

  perform notify_user(v_tenant_id, '✓ Rent paid', 'Your rent has been paid and your lease renewed to ' || v_new_lease_end || '.');
  perform notify_user(v_landlord_id, '💰 Rent received', 'A tenant just paid ' || v_annual_rent || ' — your real, current balance has been credited.');
end;
$$;
