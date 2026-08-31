-- Real, serious gap found through direct client testing: once a
-- seller declined an offer, the Accept/Decline controls disappeared
-- permanently — even though real negotiation continued in the chat
-- and reached a genuine new consensus. There was no way to convert
-- that agreement into a real acceptance, and no way to accept at a
-- different, negotiated amount at all (the original offer amount was
-- fixed). This builds the real, missing conversion point.

alter table offers add column if not exists acceptance_condition text;
alter table offers add column if not exists payment_deadline_days int;

create or replace function accept_offer_with_terms(p_offer_id uuid, p_final_amount numeric, p_condition_note text, p_deadline_days int default null)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_buyer_id uuid;
  v_property_id uuid;
  v_property_title text;
begin
  select o.buyer_id, o.property_id into v_buyer_id, v_property_id from offers o where o.id = p_offer_id;
  select owner_id, title into v_owner_id, v_property_title from properties where id = v_property_id;

  if v_owner_id != auth.uid() then
    raise exception 'Only the real property owner can accept this offer.';
  end if;
  if p_final_amount is null or p_final_amount <= 0 then
    raise exception 'A real, valid final agreed amount is required.';
  end if;

  update offers set
    status = 'accepted',
    amount = p_final_amount,
    seller_response_note = coalesce(p_condition_note, seller_response_note),
    acceptance_condition = p_condition_note,
    payment_deadline_days = p_deadline_days
  where id = p_offer_id;

  perform notify_user(v_buyer_id, '✓ Offer accepted at ' || p_final_amount || ' — proceed to payment',
    coalesce(p_condition_note, 'The seller has accepted your negotiated offer. Return to the property page to see your real total due and complete payment.'),
    '/property/' || v_property_id);
end;
$$;
