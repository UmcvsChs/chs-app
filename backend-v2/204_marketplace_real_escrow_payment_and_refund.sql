-- Real, complete replacement of the old "self-report and hope" model:
-- accepting a real, CHS-approved quote now genuinely charges the
-- buyer's wallet -- the real quoted price plus a real 6% buyer
-- commission -- and holds it in escrow, exactly like every other real
-- money-moving feature already built in CHS. Nothing is trusted on
-- honor anymore.

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
    'Reference ' || v_reference || ' — ' || v_real_total || ' is now held, pending confirmed delivery.');

  return json_build_object('success', true, 'real_total_paid', v_real_total, 'escrow_reference', v_escrow_ref);
end;
$$;

-- Real, admin-confirmed release — only once the buyer genuinely
-- confirms the real goods/service were delivered as agreed. The
-- vendor receives the real price, net of their own 4% commission.
create or replace function release_marketplace_escrow_to_vendor(p_request_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_vendor_user_id uuid;
  v_quoted_amount numeric;
  v_vendor_commission numeric;
  v_vendor_net numeric;
  v_payment_status text;
  v_reference text;
  v_escrow_ref text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can release real marketplace escrow funds.';
  end if;

  select sqr.quoted_amount, sqr.vendor_commission_amount, sqr.payment_status, sqr.reference_number, sqr.escrow_reference, mv.user_id
    into v_quoted_amount, v_vendor_commission, v_payment_status, v_reference, v_escrow_ref, v_vendor_user_id
    from service_quote_requests sqr
    join marketplace_products mp on mp.id = sqr.product_id
    join marketplace_vendors mv on mv.id = mp.vendor_id
    where sqr.id = p_request_id;

  if v_payment_status != 'held_escrow' then
    raise exception 'These real funds are not currently held in escrow.';
  end if;

  v_vendor_net := v_quoted_amount - v_vendor_commission;

  update wallets set main_balance = main_balance + v_vendor_net, updated_at = now() where user_id = v_vendor_user_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_vendor_user_id, 'main', v_vendor_net, 'credit',
    'Real marketplace sale, ref ' || v_reference || ', net of your real ' || round(v_vendor_commission / v_quoted_amount * 100, 1) || '% commission', v_escrow_ref);

  update service_quote_requests set payment_status = 'released', status = 'closed' where id = p_request_id;

  perform notify_user(v_vendor_user_id, '💰 Real payment released', 'Your real net proceeds have been credited to your wallet.');
end;
$$;

-- Real refund — if the real deal genuinely doesn't go through, the
-- buyer's full amount (price + their commission) is returned in full.
create or replace function refund_marketplace_escrow_to_buyer(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
as $$
declare
  v_requester_id uuid;
  v_quoted_amount numeric;
  v_buyer_commission numeric;
  v_payment_status text;
  v_reference text;
  v_escrow_ref text;
  v_real_refund numeric;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can authorize a real marketplace refund.';
  end if;

  select requester_id, quoted_amount, buyer_commission_amount, payment_status, reference_number, escrow_reference
    into v_requester_id, v_quoted_amount, v_buyer_commission, v_payment_status, v_reference, v_escrow_ref
    from service_quote_requests where id = p_request_id;

  if v_payment_status != 'held_escrow' then
    raise exception 'These real funds are not currently held in escrow.';
  end if;

  v_real_refund := v_quoted_amount + v_buyer_commission;

  update wallets set main_balance = main_balance + v_real_refund, updated_at = now() where user_id = v_requester_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_requester_id, 'main', v_real_refund, 'credit', 'Real marketplace refund, ref ' || v_reference || ' — ' || p_reason, v_escrow_ref);

  update service_quote_requests set payment_status = 'refunded', status = 'closed' where id = p_request_id;

  perform notify_user(v_requester_id, '✓ Your real refund has been issued',
    'Your full ' || v_real_refund || ' has been returned to your wallet. Reason: ' || p_reason);
end;
$$;
