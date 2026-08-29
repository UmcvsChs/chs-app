-- Real, new category: Rent to Own / Mortgage — a genuine, selectable
-- purpose, not just unused schema fields. Real installment payments,
-- real ownership-progress tracking, real commission.

alter table properties drop constraint properties_purpose_check;
alter table properties add constraint properties_purpose_check
  check (purpose = ANY (ARRAY['rent'::text, 'sale'::text, 'lease'::text, 'hire'::text, 'shortlet'::text, 'rent_to_own'::text]));

create table rent_to_own_agreements (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  buyer_id uuid not null references profiles(id),
  seller_id uuid not null references profiles(id),
  total_price numeric(14,2) not null,
  monthly_amount numeric(14,2) not null,
  portion_pct numeric(5,2) not null,
  total_paid numeric(14,2) not null default 0,
  ownership_pct numeric(5,2) not null default 0,
  status text not null default 'active' check (status in ('active', 'completed', 'defaulted', 'cancelled')),
  started_at timestamptz default now(),
  completed_at timestamptz,
  unique (property_id, buyer_id)
);

alter table rent_to_own_agreements enable row level security;
create policy "rto_buyer_own" on rent_to_own_agreements for select using (auth.uid() = buyer_id);
create policy "rto_seller_own" on rent_to_own_agreements for select using (auth.uid() = seller_id);
create policy "rto_admin_all" on rent_to_own_agreements for all using (staff_can_access('owner_buyer_tenant'));

create table rent_to_own_payments (
  id uuid primary key default uuid_generate_v4(),
  agreement_id uuid not null references rent_to_own_agreements(id) on delete cascade,
  amount numeric(14,2) not null,
  ownership_pct_gained numeric(6,3) not null,
  reference text,
  paid_at timestamptz default now()
);

alter table rent_to_own_payments enable row level security;
create policy "rto_payments_own" on rent_to_own_payments for select using (
  exists (select 1 from rent_to_own_agreements a where a.id = agreement_id and (a.buyer_id = auth.uid() or a.seller_id = auth.uid()))
);
create policy "rto_payments_admin_all" on rent_to_own_payments for all using (staff_can_access('owner_buyer_tenant'));

insert into platform_settings (key, value) values
  ('rent_to_own_buyer_commission_pct', '5'),
  ('rent_to_own_seller_commission_pct', '5.5')
on conflict (key) do nothing;

alter table transaction_commissions drop constraint transaction_commissions_transaction_type_check;
alter table transaction_commissions add constraint transaction_commissions_transaction_type_check
  check (transaction_type in ('sale', 'rental', 'shortlet_hire', 'rent_to_own'));

alter table transaction_commissions add column rent_to_own_payment_id uuid references rent_to_own_payments(id) on delete cascade;
alter table transaction_commissions drop constraint transaction_commissions_check;
alter table transaction_commissions add constraint transaction_commissions_check check (
  (transaction_type = 'sale' and offer_id is not null and tenancy_id is null and shortlet_booking_id is null and rent_to_own_payment_id is null and payer_role in ('buyer', 'seller'))
  or
  (transaction_type = 'rental' and tenancy_id is not null and offer_id is null and shortlet_booking_id is null and rent_to_own_payment_id is null and payer_role in ('tenant', 'landlord'))
  or
  (transaction_type = 'shortlet_hire' and shortlet_booking_id is not null and offer_id is null and tenancy_id is null and rent_to_own_payment_id is null and payer_role in ('guest', 'host'))
  or
  (transaction_type = 'rent_to_own' and rent_to_own_payment_id is not null and offer_id is null and tenancy_id is null and shortlet_booking_id is null and payer_role in ('buyer', 'seller'))
);

create or replace function start_rent_to_own(p_property_id uuid, p_buyer_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_seller_id uuid;
  v_price numeric;
  v_monthly numeric;
  v_portion_pct numeric;
  v_new_id uuid;
begin
  select owner_id, price, rent_to_own_monthly, rent_to_own_portion_pct
    into v_seller_id, v_price, v_monthly, v_portion_pct
    from properties where id = p_property_id and purpose = 'rent_to_own';

  if v_seller_id != auth.uid() and not is_admin() then
    raise exception 'Only the real property owner can start this agreement.';
  end if;
  if v_monthly is null or v_price is null then
    raise exception 'This property has no real rent-to-own terms configured.';
  end if;

  insert into rent_to_own_agreements (property_id, buyer_id, seller_id, total_price, monthly_amount, portion_pct)
  values (p_property_id, p_buyer_id, v_seller_id, v_price, v_monthly, coalesce(v_portion_pct, 100))
  returning id into v_new_id;

  perform notify_user(p_buyer_id, '🏠 Rent-to-Own agreement started',
    'Your agreement to own this property over time is now active — real monthly payments of ' || v_monthly || ' begin now.');

  return v_new_id;
end;
$$;

create or replace function pay_rent_to_own_installment(p_agreement_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_monthly numeric;
  v_total_price numeric;
  v_portion_pct numeric;
  v_balance numeric;
  v_reference text;
  v_ownership_gain numeric;
  v_new_payment_id uuid;
  v_buyer_pct numeric;
  v_seller_pct numeric;
begin
  select buyer_id, seller_id, monthly_amount, total_price, portion_pct
    into v_buyer_id, v_seller_id, v_monthly, v_total_price, v_portion_pct
    from rent_to_own_agreements where id = p_agreement_id and status = 'active';

  if v_buyer_id != auth.uid() then
    raise exception 'Only the real buyer on this agreement can make this payment.';
  end if;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_monthly then
    raise exception 'Insufficient wallet balance for this installment.';
  end if;

  v_reference := 'RTO-' || substr(gen_random_uuid()::text, 1, 8);
  v_ownership_gain := round((v_monthly / v_total_price) * v_portion_pct, 3);

  update wallets set main_balance = main_balance - v_monthly, updated_at = now() where user_id = v_buyer_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_buyer_id, 'main', v_monthly, 'debit', 'Rent-to-Own installment', v_reference);

  update wallets set main_balance = main_balance + v_monthly, updated_at = now() where user_id = v_seller_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_seller_id, 'main', v_monthly, 'credit', 'Rent-to-Own installment received', v_reference);

  insert into rent_to_own_payments (agreement_id, amount, ownership_pct_gained, reference)
  values (p_agreement_id, v_monthly, v_ownership_gain, v_reference)
  returning id into v_new_payment_id;

  update rent_to_own_agreements
    set total_paid = total_paid + v_monthly, ownership_pct = least(100, ownership_pct + v_ownership_gain)
    where id = p_agreement_id;

  select value::numeric into v_buyer_pct from platform_settings where key = 'rent_to_own_buyer_commission_pct';
  select value::numeric into v_seller_pct from platform_settings where key = 'rent_to_own_seller_commission_pct';

  insert into transaction_commissions (transaction_type, rent_to_own_payment_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount)
  values
    ('rent_to_own', v_new_payment_id, (select property_id from rent_to_own_agreements where id = p_agreement_id), v_buyer_id, 'buyer', v_monthly, v_buyer_pct, round(v_monthly * v_buyer_pct / 100, 2)),
    ('rent_to_own', v_new_payment_id, (select property_id from rent_to_own_agreements where id = p_agreement_id), v_seller_id, 'seller', v_monthly, v_seller_pct, round(v_monthly * v_seller_pct / 100, 2));

  if (select ownership_pct from rent_to_own_agreements where id = p_agreement_id) >= 100 then
    update rent_to_own_agreements set status = 'completed', completed_at = now() where id = p_agreement_id;
    update properties set purpose = 'sale', status = 'sold' where id = (select property_id from rent_to_own_agreements where id = p_agreement_id);
    perform notify_user(v_buyer_id, '🎉 You now own this property!', 'Your Rent-to-Own agreement is complete — full ownership has genuinely transferred.');
  end if;
end;
$$;
