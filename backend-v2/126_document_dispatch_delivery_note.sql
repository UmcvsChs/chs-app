-- Real, new feature per direct client request: a buyer requesting
-- their real documents should be able to include a real delivery
-- address and their expected timeline in the same request, not a
-- separate, disconnected message.

alter table document_dispatch_requests add column if not exists delivery_note text;

create or replace function request_document_dispatch(p_offer_id uuid, p_delivery_note text default null)
returns uuid
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_property_id uuid;
  v_new_id uuid;
begin
  select buyer_id, property_id into v_buyer_id, v_property_id from offers where id = p_offer_id;
  if v_buyer_id != auth.uid() then
    raise exception 'Only the real buyer on this offer can request this.';
  end if;

  select owner_id into v_seller_id from properties where id = v_property_id;

  insert into document_dispatch_requests (offer_id, requested_by, status, delivery_note)
  values (p_offer_id, auth.uid(), 'requested', p_delivery_note)
  returning id into v_new_id;

  perform notify_user(v_seller_id, '📦 Buyer is requesting your real documents',
    'The buyer has formally requested you package and send the real legal documents for this property.' ||
    coalesce(' Their real delivery note: ' || p_delivery_note, '') ||
    ' Please mark them as dispatched from your dashboard once sent.',
    '/owner');

  return v_new_id;
end;
$$;
