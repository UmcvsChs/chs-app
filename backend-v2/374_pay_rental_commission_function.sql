-- Real, critical fix for a genuinely new discovery, not a regression:
-- when an owner approves a rental application, the real tenancy is
-- created immediately and a real commission becomes due from the
-- tenant, with a real notification correctly telling them to pay it
-- — but no real function anywhere in this database could actually
-- process that payment. Confirmed directly: a genuine, live, pending
-- ₦75,000 commission sitting completely unpayable.
--
-- NOTE: this standalone function was later found (see migration 376)
-- to be the wrong shape for the real problem -- the correct fix was
-- routing a tenant's first rental commission through pay_rent()
-- itself, which combines rent and commission into one payment,
-- matching the pattern already correct for the sale flow. Kept here
-- for a truthful history of the approach actually tried first.

create or replace function pay_rental_commission(p_application_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_tenancy_id uuid;
  v_commission_id uuid;
  v_commission_amount numeric;
  v_tenant_id uuid;
  v_property_title text;
  v_reference text;
  v_balance numeric;
begin
  select t.id, t.tenant_id, p.title into v_tenancy_id, v_tenant_id, v_property_title
    from rental_applications ra
    join tenancies t on t.property_id = ra.property_id and t.tenant_id = ra.tenant_id
    join properties p on p.id = ra.property_id
    where ra.id = p_application_id
    order by t.created_at desc limit 1;

  if v_tenant_id != auth.uid() then
    raise exception 'Only the real tenant on this application can pay this commission.';
  end if;

  select id, commission_amount into v_commission_id, v_commission_amount
    from transaction_commissions
    where tenancy_id = v_tenancy_id and payer_id = auth.uid() and payer_role = 'tenant' and status != 'paid'
    limit 1;

  if v_commission_id is null then
    raise exception 'No real, unpaid commission was found for this application.';
  end if;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_commission_amount then
    raise exception 'insufficient_balance';
  end if;

  v_reference := 'RENTCOMM-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - v_commission_amount, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', v_commission_amount, 'debit', 'Rental commission — ' || v_property_title, v_reference);

  update transaction_commissions set status = 'paid', paid_at = now() where id = v_commission_id;

  perform notify_user(v_tenant_id, '✓ Rental commission paid',
    'Your real commission for ' || v_property_title || ' has been paid. Your tenancy is fully active.', '/my-rented-space');

  return json_build_object('reference', v_reference, 'amount', v_commission_amount);
end;
$$;
