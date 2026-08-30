-- Real, missing trigger found through direct client testing: only
-- admin could ever release a seller's held funds. The buyer — the one
-- actually receiving the real documents — had no way to confirm this
-- themselves, which is the more natural, primary real trigger. Also
-- fixes the complete lack of visibility for the seller (no
-- notification, no dashboard indication of payment, nowhere to mark
-- documents sent) and for admin (no itemized transaction log, no
-- visible escrow summary) found in the same round of testing.

create table document_dispatch_requests (
  id uuid primary key default uuid_generate_v4(),
  offer_id uuid not null references offers(id) on delete cascade,
  requested_by uuid not null references profiles(id),
  status text not null default 'requested' check (status in ('requested', 'dispatched', 'received')),
  dispatch_method text,
  tracking_reference text,
  dispatched_at timestamptz,
  created_at timestamptz default now()
);

alter table document_dispatch_requests enable row level security;
create policy "dispatch_buyer_all" on document_dispatch_requests for all using (
  exists (select 1 from offers o where o.id = offer_id and o.buyer_id = auth.uid())
);
create policy "dispatch_seller_all" on document_dispatch_requests for all using (
  exists (select 1 from offers o join properties p on p.id = o.property_id where o.id = offer_id and p.owner_id = auth.uid())
);
create policy "dispatch_admin_all" on document_dispatch_requests for all using (staff_can_access('owner_buyer_tenant'));

create or replace function request_document_dispatch(p_offer_id uuid)
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

  insert into document_dispatch_requests (offer_id, requested_by, status)
  values (p_offer_id, auth.uid(), 'requested')
  returning id into v_new_id;

  perform notify_user(v_seller_id, '📦 Buyer is requesting your real documents',
    'The buyer has formally requested you package and send the real legal documents for this property. Please mark them as dispatched from your dashboard once sent.');

  return v_new_id;
end;
$$;

create or replace function mark_documents_dispatched(p_offer_id uuid, p_method text, p_tracking text)
returns void
language plpgsql
security definer
as $$
declare
  v_seller_id uuid;
  v_buyer_id uuid;
  v_property_id uuid;
begin
  select o.buyer_id, o.property_id into v_buyer_id, v_property_id from offers o where o.id = p_offer_id;
  select owner_id into v_seller_id from properties where id = v_property_id;

  if v_seller_id != auth.uid() then
    raise exception 'Only the real property owner can mark documents as dispatched.';
  end if;

  update document_dispatch_requests set status = 'dispatched', dispatch_method = p_method, tracking_reference = p_tracking, dispatched_at = now()
  where offer_id = p_offer_id;

  perform notify_user(v_buyer_id, '📦 Your real documents are on the way',
    'The seller has marked your legal documents as dispatched via ' || p_method || coalesce(' (tracking: ' || p_tracking || ')', '') || '. Please confirm once you genuinely receive them.');
end;
$$;

create or replace function confirm_documents_received(p_offer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_property_id uuid;
  v_held_amount numeric;
begin
  select buyer_id, property_id into v_buyer_id, v_property_id from offers where id = p_offer_id;
  if v_buyer_id != auth.uid() then
    raise exception 'Only the real buyer on this offer can confirm this.';
  end if;

  select owner_id into v_seller_id from properties where id = v_property_id;

  update document_dispatch_requests set status = 'received' where offer_id = p_offer_id;

  select escrow_held into v_held_amount from wallets where user_id = v_seller_id;
  if v_held_amount is null or v_held_amount <= 0 then
    raise exception 'No real held funds found for this seller.';
  end if;

  update wallets set escrow_held = 0, main_balance = main_balance + v_held_amount, updated_at = now() where user_id = v_seller_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_seller_id, 'main', v_held_amount, 'credit', 'Sale proceeds released — buyer confirmed real document receipt', 'RELEASE-' || substr(gen_random_uuid()::text, 1, 8));

  update offers set legal_transfer_confirmed = true where id = p_offer_id;

  perform notify_user(v_seller_id, '✓ Funds released!',
    'The buyer has confirmed genuine receipt of the real legal documents. Your ' || v_held_amount || ' is now in your main wallet and available to withdraw.');
end;
$$;
