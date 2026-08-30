-- Real bug caught by testing a second real installment: transaction_
-- commissions has a real unique constraint (one row per offer per
-- role), correct for a single full payment but incompatible with
-- multiple real installments on the same offer. Fixed by not
-- duplicating what sale_installment_payments already correctly
-- records per real payment — this table alone is the authoritative
-- source for installment commissions.

create or replace function pay_sale_installment(p_offer_id uuid, p_amount numeric)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_property_id uuid;
  v_status text;
  v_payment_status text;
  v_offer_amount numeric;
  v_downpayment_pct numeric;
  v_amount_paid numeric;
  v_buyer_pct numeric;
  v_seller_pct numeric;
  v_buyer_commission numeric;
  v_seller_commission numeric;
  v_buyer_total numeric;
  v_seller_net numeric;
  v_buyer_balance numeric;
  v_reference text;
  v_min_downpayment numeric;
  v_deadline_days int;
begin
  select o.buyer_id, o.property_id, o.status, o.payment_status, o.amount, o.downpayment_pct, o.amount_paid
    into v_buyer_id, v_property_id, v_status, v_payment_status, v_offer_amount, v_downpayment_pct, v_amount_paid
    from offers o where o.id = p_offer_id;

  select owner_id into v_seller_id from properties where id = v_property_id;

  if v_buyer_id != auth.uid() then
    raise exception 'Only the real buyer on this offer can make this payment.';
  end if;
  if v_status != 'accepted' then
    raise exception 'This offer has not been accepted yet.';
  end if;
  if v_payment_status = 'paid' then
    raise exception 'This property has already been fully paid for.';
  end if;

  v_min_downpayment := round(v_offer_amount * v_downpayment_pct / 100, 2);
  if v_amount_paid = 0 and p_amount < v_min_downpayment then
    raise exception 'Your first payment must be at least the real minimum down payment of %.', v_min_downpayment;
  end if;
  if v_amount_paid + p_amount > v_offer_amount then
    raise exception 'This payment would exceed the real remaining balance of %.', v_offer_amount - v_amount_paid;
  end if;

  select value::numeric into v_buyer_pct from platform_settings where key = 'sale_commission_buyer_percentage';
  select value::numeric into v_seller_pct from platform_settings where key = 'sale_commission_seller_percentage';
  v_buyer_commission := round(p_amount * v_buyer_pct / 100, 2);
  v_seller_commission := round(p_amount * v_seller_pct / 100, 2);
  v_buyer_total := p_amount + v_buyer_commission;
  v_seller_net := p_amount - v_seller_commission;

  select main_balance into v_buyer_balance from wallets where user_id = v_buyer_id;
  if v_buyer_balance is null or v_buyer_balance < v_buyer_total then
    raise exception 'Insufficient wallet balance. This payment (including your commission) totals %.', v_buyer_total;
  end if;

  v_reference := 'INSTALL-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - v_buyer_total, updated_at = now() where user_id = v_buyer_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_buyer_id, 'main', v_buyer_total, 'debit', 'Property purchase installment (+ commission)', v_reference);

  update wallets set escrow_held = escrow_held + v_seller_net, updated_at = now() where user_id = v_seller_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_seller_id, 'escrow_held', v_seller_net, 'credit', 'Property sale installment received — held pending legal transfer', v_reference);

  insert into sale_installment_payments (offer_id, amount, buyer_commission, seller_commission, reference)
  values (p_offer_id, p_amount, v_buyer_commission, v_seller_commission, v_reference);

  update offers set amount_paid = amount_paid + p_amount where id = p_offer_id;

  if (select amount_paid from offers where id = p_offer_id) >= v_offer_amount then
    select value::int into v_deadline_days from platform_settings where key = 'sale_document_deadline_days';
    update offers set payment_status = 'paid', chs_cleared = true, document_deadline = now() + (coalesce(v_deadline_days, 14) || ' days')::interval where id = p_offer_id;
    update properties set status = 'sold' where id = v_property_id;
    perform notify_user(v_seller_id, '💰 Property fully paid!', 'The buyer has completed all real installments. Your held funds are visible in your wallet pending legal document transfer confirmation.');
    perform notify_user(v_buyer_id, '🎉 Final installment paid — property is now yours!', 'You have completed all real payments. CHS is coordinating your legal document transfer.');
  else
    perform notify_user(v_seller_id, '💰 Real installment received', 'A real payment of ' || v_seller_net || ' (net of commission) has been added to your held balance. ' || (v_offer_amount - (select amount_paid from offers where id = p_offer_id)) || ' remains.');
    perform notify_user(v_buyer_id, '✓ Installment paid', 'You paid ' || v_buyer_total || ' this installment. Real remaining balance: ' || (v_offer_amount - (select amount_paid from offers where id = p_offer_id)) || '.');
  end if;
end;
$$;
