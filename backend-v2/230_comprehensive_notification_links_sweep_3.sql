create or replace function accept_offer_with_installment(p_offer_id uuid, p_downpayment_pct numeric)
returns void
language plpgsql
security definer
as $$
declare
  v_seller_id uuid;
  v_buyer_id uuid;
  v_property_id uuid;
begin
  select o.buyer_id, p.id, p.owner_id into v_buyer_id, v_property_id, v_seller_id
    from offers o join properties p on p.id = o.property_id
    where o.id = p_offer_id;

  if v_seller_id != auth.uid() then
    raise exception 'Only the real property owner can accept this offer.';
  end if;
  if p_downpayment_pct is null or p_downpayment_pct <= 0 or p_downpayment_pct > 100 then
    raise exception 'A real, valid down payment percentage between 1 and 100 is required.';
  end if;

  update offers set status = 'accepted', accepts_installment = true, downpayment_pct = p_downpayment_pct where id = p_offer_id;

  perform notify_user(v_buyer_id, '✓ Offer accepted — down payment option available',
    'The seller has accepted your offer and will accept a real down payment of at least ' || p_downpayment_pct || '% to begin, with the balance payable afterward.',
    '/property/' || v_property_id);
end;
$$;

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
    perform notify_user(v_seller_id, '💰 Property fully paid!', 'The buyer has completed all real installments. Your held funds are visible in your wallet pending legal document transfer confirmation.', '/property/' || v_property_id);
    perform notify_user(v_buyer_id, '🎉 Final installment paid — property is now yours!', 'You have completed all real payments. CHS is coordinating your legal document transfer.', '/property/' || v_property_id);
  else
    perform notify_user(v_seller_id, '💰 Real installment received', 'A real payment of ' || v_seller_net || ' (net of commission) has been added to your held balance. ' || (v_offer_amount - (select amount_paid from offers where id = p_offer_id)) || ' remains.', '/property/' || v_property_id);
    perform notify_user(v_buyer_id, '✓ Installment paid', 'You paid ' || v_buyer_total || ' this installment. Real remaining balance: ' || (v_offer_amount - (select amount_paid from offers where id = p_offer_id)) || '.', '/property/' || v_property_id);
  end if;
end;
$$;

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
    'Your agreement to own this property over time is now active — real monthly payments of ' || v_monthly || ' begin now.',
    '/property/' || p_property_id);

  return v_new_id;
end;
$$;

create or replace function request_rent_to_own(p_property_id uuid)
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

  if v_monthly is null or v_price is null then
    raise exception 'This property has no real rent-to-own terms configured.';
  end if;
  if v_seller_id = auth.uid() then
    raise exception 'You cannot request your own property.';
  end if;

  insert into rent_to_own_agreements (property_id, buyer_id, seller_id, total_price, monthly_amount, portion_pct, status)
  values (p_property_id, auth.uid(), v_seller_id, v_price, v_monthly, coalesce(v_portion_pct, 100), 'requested')
  returning id into v_new_id;

  perform notify_user(v_seller_id, '🏠 New Rent-to-Own request',
    'A real buyer wants to start a Rent-to-Own agreement on your property. Review and approve to begin.',
    '/property/' || p_property_id);

  return v_new_id;
end;
$$;

create or replace function approve_rent_to_own_request(p_agreement_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_seller_id uuid;
  v_buyer_id uuid;
  v_monthly uuid;
  v_property_id uuid;
begin
  select seller_id, buyer_id, monthly_amount, property_id into v_seller_id, v_buyer_id, v_monthly, v_property_id from rent_to_own_agreements where id = p_agreement_id;

  if v_seller_id != auth.uid() and not is_admin() then
    raise exception 'Only the real property owner can approve this request.';
  end if;

  update rent_to_own_agreements set status = 'active', started_at = now() where id = p_agreement_id and status = 'requested';

  perform notify_user(v_buyer_id, '✓ Rent-to-Own agreement approved!',
    'Your agreement is now active — real monthly payments of ' || v_monthly || ' begin now.',
    '/property/' || v_property_id);
end;
$$;

create or replace function resolve_owner_concern(p_concern_id uuid, p_response text)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can resolve a concern.';
  end if;

  select owner_id into v_owner_id from owner_concerns where id = p_concern_id;
  update owner_concerns set status = 'resolved', admin_response = p_response, resolved_at = now() where id = p_concern_id;

  perform notify_user(v_owner_id, '✓ Your concern has been resolved', p_response, '/owner');
end;
$$;

create or replace function activate_estate_subscription(p_estate_id uuid, p_tier text)
returns void
language plpgsql
security definer
as $$
declare
  v_manager_id uuid;
  v_price numeric;
  v_balance numeric;
  v_reference text;
begin
  select manager_id into v_manager_id from estates where id = p_estate_id;
  if v_manager_id != auth.uid() then
    raise exception 'You do not manage this estate.';
  end if;
  if p_tier = 'over_500' then
    raise exception 'Estates over 500 units need a custom quote — please contact CHS directly.';
  end if;

  v_price := get_estate_subscription_price(p_tier);
  if v_price is null then
    raise exception 'Invalid subscription tier.';
  end if;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_price then
    raise exception 'Insufficient wallet balance. This tier costs %.', v_price;
  end if;

  v_reference := 'ESTSUB-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - v_price, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', v_price, 'debit', 'Estate Management subscription — ' || p_tier, v_reference);

  update estates set subscription_tier = p_tier, subscription_status = 'active', subscription_expires_at = now() + interval '30 days'
  where id = p_estate_id;

  perform notify_user(v_manager_id, '✓ Estate subscription activated',
    'Your ' || p_tier || ' subscription is active until ' || (now() + interval '30 days')::date || '.',
    '/manager/estates/' || p_estate_id);
end;
$$;
