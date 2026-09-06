-- Real, direct fix: payout notifications never actually linked to the
-- real document proving the payment happened. Every key payout now
-- links straight to its own real payment voucher / remittance advice.
-- Tested directly with a real remittance -- confirmed the exact real
-- notification link ("/receipt/REMIT-...") was created.

create or replace function remit_collected_rent_to_owner(p_owner_id uuid, p_amount numeric, p_property_id uuid default null, p_note text default null)
returns uuid
language plpgsql
security definer
as $$
declare
  v_agent_balance numeric;
  v_commission_pct numeric;
  v_commission_amount numeric;
  v_chs_fee_pct numeric;
  v_chs_fee_amount numeric;
  v_agent_net numeric;
  v_owner_net numeric;
  v_reference text;
  v_new_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'A real, valid amount is required.';
  end if;

  select main_balance into v_agent_balance from wallets where user_id = auth.uid();
  if v_agent_balance is null or v_agent_balance < p_amount then
    raise exception 'Insufficient wallet balance. Fund your wallet with the real amount collected before remitting it.';
  end if;

  select commission_pct into v_commission_pct from agent_owner_commission_rates
  where agent_id = auth.uid() and owner_id = p_owner_id;

  v_commission_amount := coalesce(round(p_amount * v_commission_pct / 100, 2), 0);
  select value::numeric into v_chs_fee_pct from platform_settings where key = 'agent_platform_fee_pct';
  v_chs_fee_amount := round(v_commission_amount * coalesce(v_chs_fee_pct, 0) / 100, 2);
  v_agent_net := v_commission_amount - v_chs_fee_amount;
  v_owner_net := p_amount - v_commission_amount;

  v_reference := 'REMIT-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - p_amount, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', p_amount, 'debit', 'Real rent remittance to owner', v_reference);

  update wallets set main_balance = main_balance + v_owner_net, updated_at = now() where user_id = p_owner_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (p_owner_id, 'main', v_owner_net, 'credit', 'Real rent remittance received via your agent/manager', v_reference);

  if v_agent_net > 0 then
    update wallets set main_balance = main_balance + v_agent_net, updated_at = now() where user_id = auth.uid();
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (auth.uid(), 'main', v_agent_net, 'credit', 'Real agreed commission on remitted rent, net of CHS platform fee', v_reference);
  end if;

  insert into remittances (remitted_by, owner_id, property_id, gross_amount, commission_pct, commission_amount, chs_fee_amount, owner_net_amount, note, reference)
  values (auth.uid(), p_owner_id, p_property_id, p_amount, v_commission_pct, v_commission_amount, v_chs_fee_amount, v_owner_net, p_note, v_reference)
  returning id into v_new_id;

  perform notify_user(p_owner_id, '💰 Real rent remittance received',
    'Your agent/manager has remitted ' || v_owner_net || ' to your wallet' ||
    (case when v_commission_amount > 0 then ' (after their agreed ' || v_commission_pct || '% commission of ' || v_commission_amount || ')' else '' end) ||
    '. Reference: ' || v_reference || coalesce(E'\nNote: ' || p_note, ''),
    '/receipt/' || v_reference);

  return v_new_id;
end;
$$;

create or replace function release_shortlet_funds_to_host(p_booking_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_host_id uuid;
  v_property_id uuid;
  v_total_price numeric;
  v_host_commission numeric;
  v_net_amount numeric;
  v_payment_status text;
  v_reference text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can release real shortlet/hire funds.';
  end if;

  select sb.property_id, sb.total_price, sb.host_commission_amount, sb.payment_status
    into v_property_id, v_total_price, v_host_commission, v_payment_status
    from shortlet_bookings sb where sb.id = p_booking_id;

  if v_payment_status = 'released' then
    raise exception 'These real funds have already been released.';
  end if;

  select owner_id into v_host_id from properties where id = v_property_id;
  v_net_amount := v_total_price - v_host_commission;
  v_reference := 'PAY-' || substr(p_booking_id::text, 1, 8);

  update wallets set main_balance = main_balance + v_net_amount, updated_at = now() where user_id = v_host_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (v_host_id, 'main', v_net_amount, 'credit', 'Real shortlet/hire payout, net of your real commission', v_reference);

  update shortlet_bookings set payment_status = 'released' where id = p_booking_id;

  perform notify_user(v_host_id, '💰 Real payout released', 'Your real net earnings for this stay have been credited to your wallet.', '/receipt/' || v_reference);
end;
$$;

create or replace function confirm_legal_transfer_complete(p_offer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_seller_id uuid;
  v_property_id uuid;
  v_held_amount numeric;
  v_reference text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can confirm a real legal document transfer.';
  end if;

  select property_id into v_property_id from offers where id = p_offer_id;
  select owner_id into v_seller_id from properties where id = v_property_id;

  select escrow_held into v_held_amount from wallets where user_id = v_seller_id;
  if v_held_amount is null or v_held_amount <= 0 then
    raise exception 'No real held funds found for this seller.';
  end if;

  v_reference := 'RELEASE-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set escrow_held = 0, main_balance = main_balance + v_held_amount, updated_at = now() where user_id = v_seller_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_seller_id, 'main', v_held_amount, 'credit', 'Sale proceeds released -- legal transfer confirmed', v_reference);

  update offers set legal_transfer_confirmed = true where id = p_offer_id;

  perform notify_user(v_seller_id, '✓ Funds released!',
    'CHS has confirmed the real legal document transfer to the buyer is complete. Your ' || v_held_amount || ' is now in your main wallet and available to withdraw.',
    '/receipt/' || v_reference);
end;
$$;
