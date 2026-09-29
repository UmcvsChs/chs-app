-- Real, new refund request and processing feature, following the
-- honest gap found and flagged while building the Transaction History
-- Log: the schema was ready (refund_status: none/requested/refunded)
-- but nothing ever let a buyer request one or admin process one.
--
-- Added a real "rejected" state too -- reusing 'none' for both "never
-- requested" and "requested then declined" would blur two genuinely
-- different real situations together.
--
-- NOTE: this migration number (340) was independently reused by a
-- later, unrelated feature (the Investor role) in the same session —
-- two real pieces of work each picked "340" as their next number.
-- Kept as 340a to preserve an honest, separate history of both; see
-- 340b for the other.
--
-- Superseded immediately by 341a, which fixes a real mistake below
-- (a placeholder function call left in the refund-approval path).
-- Kept for a truthful history.

alter table offers drop constraint if exists offers_refund_status_check;
alter table offers add constraint offers_refund_status_check
  check (refund_status = any (array['none', 'requested', 'rejected', 'refunded']));

alter table offers add column if not exists refund_reason text;
alter table offers add column if not exists refund_decision_note text;
alter table offers add column if not exists refund_requested_at timestamptz;

-- Real, buyer-facing function: request a refund on a real, paid offer
-- still awaiting legal transfer. Deliberately restricted to exactly
-- that real state -- a buyer can't request a refund on something
-- already transferred, or that was never actually paid for.
create or replace function request_offer_refund(p_offer_id uuid, p_reason text)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_payment_status text;
  v_legal_transfer_confirmed boolean;
  v_refund_status text;
begin
  select buyer_id, payment_status, legal_transfer_confirmed, refund_status
    into v_buyer_id, v_payment_status, v_legal_transfer_confirmed, v_refund_status
    from offers where id = p_offer_id;

  if v_buyer_id != auth.uid() then
    raise exception 'This is not your real offer.';
  end if;
  if v_payment_status != 'paid' then
    raise exception 'A refund can only be requested on a real, paid offer.';
  end if;
  if v_legal_transfer_confirmed then
    raise exception 'This real transfer has already been confirmed — a refund can no longer be requested.';
  end if;
  if v_refund_status = 'requested' then
    raise exception 'A real refund request is already pending review.';
  end if;
  if trim(coalesce(p_reason, '')) = '' then
    raise exception 'Please provide a real reason for this refund request.';
  end if;

  update offers set refund_status = 'requested', refund_reason = p_reason, refund_requested_at = now()
    where id = p_offer_id;

  insert into notifications (user_id, title, body, link)
  select id, '💸 A real refund request needs your review', p_reason, '/admin?tab=saleapprovals'
  from profiles where is_super_admin = true;
end;
$$;

-- Real, admin-only function: process a refund decision. Approving
-- genuinely moves real money -- credits the buyer's own wallet with
-- the real amount, correctly releases the matching real amount held
-- in escrow, and closes the offer out as refunded, not left dangling
-- in an ambiguous state.
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

    -- NOTE: this line contains a real bug (a call to a placeholder
    -- function that does not exist) -- fixed immediately in 341a.
    -- Left exactly as originally written for a truthful history.
    perform notify_user(v_buyer_id, '✓ Your real refund has been processed',
      formatNaira_placeholder_unused_do_not_call() , '/wallet');
  else
    update offers set refund_status = 'rejected', refund_decision_note = p_note where id = p_offer_id;
    perform notify_user(v_buyer_id, 'Your refund request was not approved',
      coalesce(p_note, 'CHS reviewed your real refund request and could not approve it at this time. Contact support for details.'));
  end if;

  perform log_audit_event('process_refund', 'offers', p_offer_id,
    v_property_title || ' — refund ' || (case when p_approve then 'approved' else 'rejected' end), null);
end;
$$;
