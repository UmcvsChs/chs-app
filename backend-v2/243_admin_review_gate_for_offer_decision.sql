-- Real, direct fix completing the offer mediation loop: the owner's
-- accept/decline decision went straight to the buyer with zero admin
-- involvement -- confirmed by reading the real, current code directly.
-- This was true before today's other offer fixes; those only ever
-- covered the submission direction (buyer -> owner), never the
-- response direction (owner -> buyer). Matching the exact same
-- pattern already built for rental applications.

alter table offers add column if not exists owner_decision text;
alter table offers add column if not exists owner_decision_at timestamptz;

alter table offers drop constraint offers_status_check;
alter table offers add constraint offers_status_check
  check (status = ANY (ARRAY['awaiting_admin_review', 'pending', 'owner_decided_pending_relay', 'accepted', 'rejected', 'withdrawn']));

create or replace function record_offer_decision(p_offer_id uuid, p_decision text, p_seller_note text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_reason text;
begin
  select p.owner_id into v_owner_id from offers o join properties p on p.id = o.property_id where o.id = p_offer_id;
  if v_owner_id != auth.uid() then
    raise exception 'Only the real property owner can decide on this offer.';
  end if;
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Not a real, recognized decision.';
  end if;
  if p_decision = 'rejected' and (p_seller_note is null or trim(p_seller_note) = '') then
    raise exception 'Please state a real reason for declining.';
  end if;

  if p_seller_note is not null then
    v_reason := detect_offplatform_contact(p_seller_note);
    if v_reason is not null then
      raise exception 'Your note cannot be saved — %  Please remove any phone number or email.', v_reason;
    end if;
  end if;

  update offers set owner_decision = p_decision, owner_decision_at = now(), seller_response_note = p_seller_note, status = 'owner_decided_pending_relay'
  where id = p_offer_id;

  perform notify_admins_by_domain('owner_buyer_tenant', '📋 Real owner decision on an offer, ready to relay',
    'An owner has decided on a real offer — review and relay it to the buyer.',
    '/admin?tab=offerreview');
end;
$$;

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
begin
  if not is_admin() then
    raise exception 'Only CHS staff can relay a real offer decision.';
  end if;

  select o.buyer_id, o.owner_decision, o.seller_response_note, p.title
    into v_buyer_id, v_decision, v_seller_note, v_property_title
    from offers o join properties p on p.id = o.property_id
    where o.id = p_offer_id and o.status = 'owner_decided_pending_relay';

  if v_buyer_id is null then
    raise exception 'This real offer decision is not currently awaiting relay.';
  end if;

  update offers set status = v_decision where id = p_offer_id;

  if v_decision = 'accepted' then
    perform notify_user(v_buyer_id, '✓ Offer Accepted — Proceed to Payment',
      'The owner has accepted your real offer on ' || v_property_title || '. Proceed to payment from the property page.' || coalesce(' Note: ' || v_seller_note, ''),
      '/property/' || (select property_id from offers where id = p_offer_id));
  else
    perform notify_user(v_buyer_id, 'Update on your real offer',
      'The owner was not able to accept your offer on ' || v_property_title || '.' || coalesce(' Reason: ' || v_seller_note, ''),
      '/my-applications');
  end if;
end;
$$;
