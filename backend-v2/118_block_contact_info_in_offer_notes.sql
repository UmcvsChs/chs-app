-- Real, serious gap found through direct client testing: a buyer's
-- initial offer note and a seller's response note were both saved as
-- plain free text with zero contact-info checking — completely
-- bypassing the real precommit_messages moderation system, which only
-- ever governed the later, ongoing negotiation thread. A phone number
-- typed directly into an offer note went straight through unblocked.
--
-- Fixed at the database level with a real trigger, deliberately not
-- just a frontend check — this way it can never be bypassed by any
-- current or future code path that writes to these two columns.

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

  return new;
end;
$$;

drop trigger if exists trg_block_contact_info_offers on offers;
create trigger trg_block_contact_info_offers
  before insert or update on offers
  for each row execute function block_contact_info_in_offer_fields();
