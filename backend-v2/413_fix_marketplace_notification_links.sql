-- Real, direct fixes for the same class of bug found in 412, applied
-- to every real marketplace notification function that lacked one.

create or replace function accept_marketplace_quote(p_request_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_requester_id uuid;
  v_quoted_amount numeric;
  v_response_status text;
  v_payment_status text;
  v_buyer_pct numeric;
  v_vendor_pct numeric;
  v_buyer_commission numeric;
  v_vendor_commission numeric;
  v_real_total numeric;
  v_balance numeric;
  v_reference text;
  v_escrow_ref text;
begin
  select requester_id, quoted_amount, response_moderation_status, payment_status, reference_number
    into v_requester_id, v_quoted_amount, v_response_status, v_payment_status, v_reference
    from service_quote_requests where id = p_request_id;

  if v_requester_id != auth.uid() then
    raise exception 'You are not the real buyer on this request.';
  end if;
  if v_response_status != 'approved' then
    raise exception 'This quote has not yet been reviewed and approved by CHS.';
  end if;
  if v_payment_status != 'unpaid' then
    raise exception 'This request has already been paid for.';
  end if;
  if v_quoted_amount is null or v_quoted_amount <= 0 then
    raise exception 'No real quoted amount is available to accept.';
  end if;

  select value::numeric into v_buyer_pct from platform_settings where key = 'marketplace_buyer_commission_pct';
  select value::numeric into v_vendor_pct from platform_settings where key = 'marketplace_vendor_commission_pct';

  v_buyer_commission := round(v_quoted_amount * v_buyer_pct / 100, 2);
  v_vendor_commission := round(v_quoted_amount * v_vendor_pct / 100, 2);
  v_real_total := v_quoted_amount + v_buyer_commission;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_real_total then
    raise exception 'insufficient_balance';
  end if;

  v_escrow_ref := 'MKTPAY-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - v_real_total, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', v_real_total, 'debit',
    'Real marketplace purchase, ref ' || v_reference || ' (price + your ' || v_buyer_pct || '% commission), held in escrow', v_escrow_ref);

  update service_quote_requests set
    payment_status = 'held_escrow',
    buyer_commission_amount = v_buyer_commission,
    vendor_commission_amount = v_vendor_commission,
    escrow_reference = v_escrow_ref,
    status = 'paid'
  where id = p_request_id;

  perform notify_admins_by_domain('owner_buyer_tenant', '💰 Real marketplace payment held in escrow',
    'Reference ' || v_reference || ' — ' || v_real_total || ' is now held, pending confirmed delivery.',
    '/admin?tab=marketplacemoderation');

  return json_build_object('success', true, 'real_total_paid', v_real_total, 'escrow_reference', v_escrow_ref);
end;
$$;

create or replace function buy_product_direct(p_product_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_price numeric;
  v_buyer_pct numeric;
  v_vendor_pct numeric;
  v_buyer_commission numeric;
  v_vendor_commission numeric;
  v_real_total numeric;
  v_balance numeric;
  v_new_id uuid;
  v_reference text;
  v_escrow_ref text;
  v_vendor_user_id uuid;
begin
  select mp.price, mv.user_id into v_price, v_vendor_user_id
    from marketplace_products mp join marketplace_vendors mv on mv.id = mp.vendor_id
    where mp.id = p_product_id and mp.status = 'active';

  if v_price is null then
    raise exception 'This real product is not currently available.';
  end if;

  select value::numeric into v_buyer_pct from platform_settings where key = 'marketplace_buyer_commission_pct';
  select value::numeric into v_vendor_pct from platform_settings where key = 'marketplace_vendor_commission_pct';

  v_buyer_commission := round(v_price * v_buyer_pct / 100, 2);
  v_vendor_commission := round(v_price * v_vendor_pct / 100, 2);
  v_real_total := v_price + v_buyer_commission;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_real_total then
    raise exception 'insufficient_balance';
  end if;

  v_escrow_ref := 'BUYPAY-' || substr(gen_random_uuid()::text, 1, 8);

  insert into marketplace_direct_orders (product_id, buyer_id, amount, buyer_commission_amount, vendor_commission_amount, escrow_reference)
  values (p_product_id, auth.uid(), v_price, v_buyer_commission, v_vendor_commission, v_escrow_ref)
  returning id, reference_number into v_new_id, v_reference;

  update wallets set main_balance = main_balance - v_real_total, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', v_real_total, 'debit', 'Real direct marketplace purchase, ref ' || v_reference || ' (price + your ' || v_buyer_pct || '% commission), held in escrow', v_escrow_ref);

  perform notify_user(v_vendor_user_id, '🛒 A real direct order was placed',
    'Reference ' || v_reference || ' — a real buyer has paid in full for this item. CHS is holding the funds until delivery is confirmed.');
  perform notify_admins_by_domain('owner_buyer_tenant', '🛒 A real direct marketplace order needs fulfillment tracking',
    'Reference ' || v_reference || ' — ' || v_real_total || ' held in escrow.',
    '/admin?tab=marketplacemoderation');

  return json_build_object('success', true, 'reference_number', v_reference, 'real_total_paid', v_real_total);
end;
$$;

create or replace function submit_marketplace_quote_request(p_product_id uuid, p_property_details text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_block_reason text;
  v_new_id uuid;
begin
  v_block_reason := detect_offplatform_contact(p_property_details);

  insert into service_quote_requests (product_id, requester_id, property_details, moderation_status, block_reason)
  values (p_product_id, auth.uid(), p_property_details,
    case when v_block_reason is not null then 'blocked' else 'pending_review' end, v_block_reason)
  returning id into v_new_id;

  if v_block_reason is not null then
    perform notify_user(auth.uid(), '🚫 Your message could not be sent',
      v_block_reason || ' For your protection, every real marketplace conversation stays on CHS — no phone numbers or emails, please. Rephrase and try again.');
  else
    perform notify_admins_by_domain('owner_buyer_tenant', '📋 A real marketplace quote request needs your review',
      'A new request is waiting — review and relay it to the real vendor.',
      '/admin?tab=marketplacemoderation');
  end if;

  return v_new_id;
end;
$$;

create or replace function submit_vendor_quote_response(p_request_id uuid, p_response text, p_quoted_amount numeric)
returns void
language plpgsql
security definer
as $$
declare
  v_vendor_user_id uuid;
  v_block_reason text;
begin
  select mv.user_id into v_vendor_user_id
    from service_quote_requests sqr
    join marketplace_products mp on mp.id = sqr.product_id
    join marketplace_vendors mv on mv.id = mp.vendor_id
    where sqr.id = p_request_id;

  if v_vendor_user_id != auth.uid() then
    raise exception 'You are not the real vendor for this request.';
  end if;

  v_block_reason := detect_offplatform_contact(p_response);

  update service_quote_requests set
    vendor_response = p_response,
    quoted_amount = p_quoted_amount,
    response_moderation_status = case when v_block_reason is not null then 'blocked' else 'pending_review' end,
    response_block_reason = v_block_reason,
    status = 'responded'
  where id = p_request_id;

  if v_block_reason is not null then
    perform notify_user(auth.uid(), '🚫 Your response could not be sent',
      v_block_reason || ' Every real marketplace conversation stays on CHS — no phone numbers or emails, please.');
  else
    perform notify_admins_by_domain('owner_buyer_tenant', '📋 A real vendor response needs your review',
      'A real quote response is waiting to be relayed to the buyer.',
      '/admin?tab=marketplacemoderation');
  end if;
end;
$$;
