create or replace function admin_relay_application_to_owner(p_application_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_applicant_name text;
  v_property_title text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can relay a real application to the owner.';
  end if;

  select p.owner_id, p.title, ra.applicant_full_name
    into v_owner_id, v_property_title, v_applicant_name
    from rental_applications ra join properties p on p.id = ra.property_id
    where ra.id = p_application_id and ra.status = 'awaiting_admin_review';

  if v_owner_id is null then
    raise exception 'This real application is not currently awaiting admin review.';
  end if;

  update rental_applications set status = 'awaiting_owner_decision' where id = p_application_id;

  perform log_audit_event('relay_application_to_owner', 'rental_applications', p_application_id,
    v_applicant_name || ' — ' || v_property_title, null);

  perform notify_user(v_owner_id, '📋 A real rental application is ready for your decision',
    v_applicant_name || ' has applied for ' || v_property_title || '. CHS has reviewed and verified their guarantor — please review and decide.',
    '/owner');
end;
$$;

create or replace function admin_relay_offer_to_owner(p_offer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_buyer_name text;
  v_property_title text;
  v_property_id uuid;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can relay a real offer to the owner.';
  end if;

  select o.property_id, o.buyer_full_name, p.title, p.owner_id
    into v_property_id, v_buyer_name, v_property_title, v_owner_id
    from offers o join properties p on p.id = o.property_id
    where o.id = p_offer_id and o.status = 'awaiting_admin_review';

  if v_owner_id is null then
    raise exception 'This real offer is not currently awaiting admin review.';
  end if;

  update offers set status = 'pending' where id = p_offer_id;

  perform log_audit_event('relay_offer_to_owner', 'offers', p_offer_id,
    v_buyer_name || ' — ' || v_property_title, null);

  perform notify_user(v_owner_id, '💰 A real offer is ready for your review',
    v_buyer_name || ' has made a real offer on ' || v_property_title || '. CHS has reviewed their real details — please review and decide.',
    '/owner');
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

  perform log_audit_event('relay_offer_decision_to_buyer', 'offers', p_offer_id,
    v_property_title || ' — owner ' || v_decision, null);

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
