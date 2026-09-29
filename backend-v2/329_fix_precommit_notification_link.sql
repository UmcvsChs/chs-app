-- Real, direct fix following a specific, well-described client
-- report, confirmed exactly as described: the admin notification for
-- a real negotiation message awaiting review genuinely had no link
-- at all -- nothing to click, nothing to relay. The real approval
-- mechanism itself (approve_precommit_message) was already fully,
-- correctly built and even correctly notifies the recipient with the
-- right link once approved -- this was purely the admin-facing
-- notification missing its own link to get there in the first place.

create or replace function send_precommit_message(p_offer_id uuid, p_text text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_payment_status text;
  v_sender_role text;
  v_recipient_id uuid;
  v_block_reason text;
  v_new_id uuid;
begin
  select o.buyer_id, o.payment_status, p.owner_id
    into v_buyer_id, v_payment_status, v_seller_id
    from offers o join properties p on p.id = o.property_id
    where o.id = p_offer_id;

  if v_payment_status = 'paid' then
    raise exception 'This deal has already been paid for — real messaging is now unrestricted between the two parties directly.';
  end if;

  if auth.uid() = v_buyer_id then
    v_sender_role := 'buyer';
    v_recipient_id := v_seller_id;
  elsif auth.uid() = v_seller_id then
    v_sender_role := 'seller';
    v_recipient_id := v_buyer_id;
  else
    raise exception 'You are not part of this negotiation.';
  end if;

  v_block_reason := detect_offplatform_contact(p_text);

  insert into precommit_messages (offer_id, sender_id, sender_role, recipient_id, text, status, block_reason)
  values (p_offer_id, auth.uid(), v_sender_role, v_recipient_id, p_text,
    case when v_block_reason is not null then 'blocked' else 'pending_review' end, v_block_reason)
  returning id into v_new_id;

  if v_block_reason is not null then
    perform notify_user(auth.uid(), '🚫 Message could not be delivered',
      v_block_reason || ' For your protection and the buyer''s, all negotiation must stay on CHS until final payment is made. Please rephrase without direct contact details.');
  else
    insert into notifications (user_id, title, body, link)
    select id, '📋 A real negotiation message needs your review', p_text, '/admin?tab=offerreview'
    from profiles where is_super_admin = true;
  end if;

  return v_new_id;
end;
$$;
