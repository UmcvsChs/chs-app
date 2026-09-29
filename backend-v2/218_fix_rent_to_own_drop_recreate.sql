drop function pay_rent_to_own_installment(uuid);

create function pay_rent_to_own_installment(p_agreement_id uuid)
returns json
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
  v_buyer_commission numeric;
  v_seller_commission numeric;
  v_real_total_buyer_pays numeric;
  v_seller_net numeric;
begin
  select buyer_id, seller_id, monthly_amount, total_price, portion_pct
    into v_buyer_id, v_seller_id, v_monthly, v_total_price, v_portion_pct
    from rent_to_own_agreements where id = p_agreement_id and status = 'active';

  if v_buyer_id != auth.uid() then
    raise exception 'Only the real buyer on this agreement can make this payment.';
  end if;

  select value::numeric into v_buyer_pct from platform_settings where key = 'rent_to_own_buyer_commission_pct';
  select value::numeric into v_seller_pct from platform_settings where key = 'rent_to_own_seller_commission_pct';
  v_buyer_commission := round(v_monthly * v_buyer_pct / 100, 2);
  v_seller_commission := round(v_monthly * v_seller_pct / 100, 2);
  v_real_total_buyer_pays := v_monthly + v_buyer_commission;
  v_seller_net := v_monthly - v_seller_commission;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_real_total_buyer_pays then
    raise exception 'insufficient_balance';
  end if;

  v_reference := 'RTO-' || substr(gen_random_uuid()::text, 1, 8);
  v_ownership_gain := round((v_monthly / v_total_price) * v_portion_pct, 3);

  update wallets set main_balance = main_balance - v_real_total_buyer_pays, updated_at = now() where user_id = v_buyer_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_buyer_id, 'main', v_real_total_buyer_pays, 'debit',
    'Rent-to-Own installment (' || v_monthly || ' + your real ' || v_buyer_commission || ' commission)', v_reference);

  update wallets set main_balance = main_balance + v_seller_net, updated_at = now() where user_id = v_seller_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_seller_id, 'main', v_seller_net, 'credit', 'Rent-to-Own installment received, net of your real commission', v_reference);

  insert into rent_to_own_payments (agreement_id, amount, ownership_pct_gained, reference)
  values (p_agreement_id, v_monthly, v_ownership_gain, v_reference)
  returning id into v_new_payment_id;

  update rent_to_own_agreements
    set total_paid = total_paid + v_monthly, ownership_pct = least(100, ownership_pct + v_ownership_gain)
    where id = p_agreement_id;

  insert into transaction_commissions (transaction_type, rent_to_own_payment_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount, status, paid_at)
  values
    ('rent_to_own', v_new_payment_id, (select property_id from rent_to_own_agreements where id = p_agreement_id), v_buyer_id, 'buyer', v_monthly, v_buyer_pct, v_buyer_commission, 'paid', now()),
    ('rent_to_own', v_new_payment_id, (select property_id from rent_to_own_agreements where id = p_agreement_id), v_seller_id, 'seller', v_monthly, v_seller_pct, v_seller_commission, 'paid', now());

  if (select ownership_pct from rent_to_own_agreements where id = p_agreement_id) >= 100 then
    update rent_to_own_agreements set status = 'completed', completed_at = now() where id = p_agreement_id;
    update properties set purpose = 'sale', status = 'sold' where id = (select property_id from rent_to_own_agreements where id = p_agreement_id);
    perform notify_user(v_buyer_id, '🎉 You now own this property!', 'Your Rent-to-Own agreement is complete — full ownership has genuinely transferred.');
  end if;

  perform notify_user(v_buyer_id, '✓ Installment paid', 'Your real payment of ' || v_real_total_buyer_pays || ' was successful.');
  perform notify_user(v_seller_id, '💰 Installment received', v_seller_net || ' has been credited to your wallet.');

  return json_build_object('reference', v_reference, 'real_total_paid', v_real_total_buyer_pays, 'installment', v_monthly, 'buyer_commission', v_buyer_commission);
end;
$$;
