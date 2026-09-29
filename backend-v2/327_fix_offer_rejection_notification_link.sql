-- Real, exact, confirmed fix, following a direct client report tested
-- on the actual live deployment (not a stale-version assumption) and
-- re-confirmed in a second browser: the "accepted" branch of this
-- function correctly links to the real property page, where the real
-- negotiation chat (OfferMessageThread) actually lives -- but the
-- "rejected" branch, right next to it, was hardcoded to
-- /my-applications instead, a list page with no chat box on it at
-- all. Clicking the notification correctly navigated -- just to the
-- wrong real destination, which is exactly why the buyer had nowhere
-- to reply and had to "go back to make offer" to find anywhere to
-- respond, precisely as reported.

create or replace function admin_relay_offer_decision_to_buyer(p_offer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_decision text;
  v_seller_note text;
  v_property_title text;
  v_property_id uuid;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can relay a real offer decision.';
  end if;

  select o.buyer_id, o.owner_decision, o.seller_response_note, p.title, o.property_id
    into v_buyer_id, v_decision, v_seller_note, v_property_title, v_property_id
    from offers o join properties p on p.id = o.property_id
    where o.id = p_offer_id and o.status = 'owner_decided_pending_relay';

  if v_buyer_id is null then
    raise exception 'This real offer decision is not currently awaiting relay.';
  end if;

  update offers set status = v_decision where id = p_offer_id;

  perform log_audit_event('relay_offer_decision_to_buyer', 'offers', p_offer_id,
    v_property_title || ' — owner ' || v_decision, null);

  if v_decision = 'accepted' then
    perform notify_user(v_buyer_id, '✓ Offer Accepted — Proceed to Payment',
      'The owner has accepted your real offer on ' || v_property_title || '. Proceed to payment from the property page.' || coalesce(' Note: ' || v_seller_note, ''),
      '/property/' || v_property_id);
  else
    perform notify_user(v_buyer_id, 'Update on your real offer',
      'The owner was not able to accept your offer on ' || v_property_title || '.' || coalesce(' Reason: ' || v_seller_note, '') || ' Reply directly on the property page to keep negotiating.',
      '/property/' || v_property_id);
  end if;
end;
$$;
