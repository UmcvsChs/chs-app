-- Real, direct fix per a genuine, confirmed gap: a buyer requesting
-- their real, physical documents had only one optional, generic text
-- box, and the seller's own dashboard never persistently showed
-- whatever was in it — only a one-time notification that could easily
-- be missed. Real, required, structured fields now capture the
-- buyer's real delivery address and contact number separately, and
-- the seller's dashboard shows them persistently, not just once.

alter table document_dispatch_requests add column if not exists delivery_address text;
alter table document_dispatch_requests add column if not exists delivery_phone text;
alter table document_dispatch_requests add column if not exists preferred_method text;

create or replace function request_document_dispatch(
  p_offer_id uuid, p_delivery_address text, p_delivery_phone text, p_preferred_method text, p_delivery_note text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_property_id uuid;
  v_new_id uuid;
  v_reason text;
begin
  select buyer_id, property_id into v_buyer_id, v_property_id from offers where id = p_offer_id;
  if v_buyer_id != auth.uid() then
    raise exception 'Only the real buyer on this offer can request this.';
  end if;
  if trim(coalesce(p_delivery_address, '')) = '' or trim(coalesce(p_delivery_phone, '')) = '' then
    raise exception 'Please provide a real delivery address and a real contact phone number so the seller genuinely knows how to reach you.';
  end if;

  if p_delivery_note is not null then
    v_reason := detect_offplatform_contact(p_delivery_note);
    if v_reason is not null then
      raise exception 'Your note cannot be saved — %', v_reason;
    end if;
  end if;

  select owner_id into v_seller_id from properties where id = v_property_id;

  insert into document_dispatch_requests (offer_id, requested_by, status, delivery_address, delivery_phone, preferred_method, delivery_note)
  values (p_offer_id, auth.uid(), 'requested', trim(p_delivery_address), trim(p_delivery_phone), p_preferred_method, p_delivery_note)
  returning id into v_new_id;

  perform notify_user(v_seller_id, '📦 Buyer is requesting your real documents',
    'The buyer has formally requested you package and send the real legal documents for this property, via ' || p_preferred_method || '. Please review their real delivery details on your dashboard, then mark as dispatched once sent.',
    '/owner');

  return v_new_id;
end;
$$;
