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
  values (v_seller_id, 'main', v_held_amount, 'credit', 'Sale proceeds released — legal transfer confirmed', v_reference);

  update offers set legal_transfer_confirmed = true where id = p_offer_id;

  -- Real, permanent audit entry — the single highest-stakes action
  -- in the whole system (releasing real, held funds) is now always
  -- traceable: who released it, how much, from which offer, when.
  perform log_audit_event('release_escrow_funds', 'offers', p_offer_id,
    'Released ' || v_held_amount || ' to seller', jsonb_build_object('seller_id', v_seller_id, 'amount', v_held_amount, 'reference', v_reference));

  perform notify_user(v_seller_id, '✓ Funds released!',
    'CHS has confirmed the real legal document transfer to the buyer is complete. Your ' || v_held_amount || ' is now in your main wallet and available to withdraw.',
    '/receipt/' || v_reference);
end;
$$;

create or replace function suspend_user_account(p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Only CHS staff can suspend a real account.';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A real, genuine reason must be recorded for any suspension.';
  end if;

  update profiles set status = 'suspended', suspension_reason = p_reason, suspended_at = now() where id = p_user_id;

  perform log_audit_event('suspend_account', 'profiles', p_user_id, 'Account suspended', jsonb_build_object('reason', p_reason));

  perform notify_user(p_user_id, '⚠️ Your CHS account has been suspended', p_reason || ' If you believe this is a mistake, you can submit a real appeal from the app.', '/profile');
end;
$$;

create or replace function reactivate_user_account(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Only CHS staff can reactivate a real account.';
  end if;

  update profiles set status = 'approved', suspension_reason = null, suspended_at = null where id = p_user_id;
  perform log_audit_event('reactivate_account', 'profiles', p_user_id, 'Account reactivated', null);
  perform notify_user(p_user_id, '✓ Your CHS account has been reactivated', 'Your real access to CHS has been fully restored.', '/profile');
end;
$$;
