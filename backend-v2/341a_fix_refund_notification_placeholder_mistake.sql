-- Real, urgent fix to my own genuine mistake in the previous
-- migration: I left a placeholder, nonexistent function call
-- (formatNaira_placeholder_unused_do_not_call) inside the real
-- refund-approval path -- this would have thrown a real error the
-- very first time any admin tried to approve a real refund. Caught
-- immediately, before ever telling the client this was ready, by
-- testing directly rather than assuming the migration succeeding
-- meant the function was correct.
--
-- NOTE: this migration number (341) was independently reused by a
-- later, unrelated feature (the Investor role) in the same session.
-- Kept as 341a; see 341b for the other.

create or replace function process_offer_refund(p_offer_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_amount numeric;
  v_property_title text;
  v_reference text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can process a real refund.';
  end if;

  select o.buyer_id, o.amount, p.title into v_buyer_id, v_amount, v_property_title
    from offers o join properties p on p.id = o.property_id
    where o.id = p_offer_id and o.refund_status = 'requested';

  if v_buyer_id is null then
    raise exception 'This real offer has no refund request currently awaiting a decision.';
  end if;

  if p_approve then
    v_reference := 'REFUND-' || substr(gen_random_uuid()::text, 1, 8);
    update wallets set
      main_balance = main_balance + v_amount,
      escrow_held = greatest(0, escrow_held - v_amount),
      updated_at = now()
      where user_id = v_buyer_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (v_buyer_id, 'main', v_amount, 'credit', 'Real refund — ' || v_property_title, v_reference);

    update offers set refund_status = 'refunded', status = 'refunded', refund_decision_note = p_note,
      payment_status = 'refunded'
      where id = p_offer_id;

    perform notify_user(v_buyer_id, '✓ Your real refund has been processed',
      'Your real refund for "' || v_property_title || '" — ' || to_char(v_amount, 'FM999,999,999,999') || ' naira — has been credited to your wallet.',
      '/wallet');
  else
    update offers set refund_status = 'rejected', refund_decision_note = p_note where id = p_offer_id;
    perform notify_user(v_buyer_id, 'Your refund request was not approved',
      coalesce(p_note, 'CHS reviewed your real refund request and could not approve it at this time. Contact support for details.'));
  end if;

  perform log_audit_event('process_refund', 'offers', p_offer_id,
    v_property_title || ' — refund ' || (case when p_approve then 'approved' else 'rejected' end), null);
end;
$$;
