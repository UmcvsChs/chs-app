-- Real, related gap found while fixing a direct, confirmed client
-- report (with a real screenshot): the buyer's real phone number was
-- shown directly to the owner, completely bypassing the same
-- contact-blocking every other real negotiation on this platform
-- already enforces. While fixing that, found the real trigger
-- protecting offers only ever checked the "note" field -- the newer
-- occupation and source-of-funds fields, added afterward, were never
-- covered, meaning a phone number typed into either would have gone
-- straight through undetected.

create or replace function block_contact_info_in_offer_fields()
returns trigger
language plpgsql
as $$
declare
  v_reason text;
begin
  if new.note is not null then
    v_reason := detect_offplatform_contact(new.note);
    if v_reason is not null then
      raise exception 'Your offer note cannot be saved — %  Please remove any phone number or email and try again. Your offer amount itself is unaffected once you resubmit without contact details.', v_reason;
    end if;
  end if;

  if new.seller_response_note is not null then
    v_reason := detect_offplatform_contact(new.seller_response_note);
    if v_reason is not null then
      raise exception 'Your response note cannot be saved — %  Please remove any phone number or email and try again.', v_reason;
    end if;
  end if;

  if new.buyer_occupation is not null then
    v_reason := detect_offplatform_contact(new.buyer_occupation);
    if v_reason is not null then
      raise exception 'Your occupation field cannot be saved — %  Please remove any phone number or email.', v_reason;
    end if;
  end if;

  if new.buyer_source_of_funds is not null then
    v_reason := detect_offplatform_contact(new.buyer_source_of_funds);
    if v_reason is not null then
      raise exception 'Your source-of-funds field cannot be saved — %  Please remove any phone number or email.', v_reason;
    end if;
  end if;

  return new;
end;
$$;
