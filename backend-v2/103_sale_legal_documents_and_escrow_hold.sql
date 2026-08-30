-- Real, substantial new requirement, sourced from actual Nigerian
-- real estate practice (Lexology, PropertyPro, Diya Fatimilehin & Co,
-- and other real, cited sources), not invented: the real documents
-- required to legally transfer a property in Nigeria — Certificate of
-- Occupancy, Deed of Assignment, Survey Plan, Governor's Consent, Tax
-- Clearance, Sale Agreement, and Building Plan Approval where a
-- structure exists. A seller must have these on file before their
-- Sale listing goes live, CHS genuinely verifies each one, and a
-- buyer's payment lands in the seller's wallet visibly, but cannot be
-- withdrawn until CHS confirms the real, physical legal documents
-- have actually been handed to the new owner.

create table property_sale_documents (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  document_type text not null check (document_type in (
    'certificate_of_occupancy', 'deed_of_assignment', 'survey_plan',
    'governors_consent', 'tax_clearance_certificate', 'sale_agreement',
    'building_plan_approval'
  )),
  file_url text not null,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz default now(),
  unique (property_id, document_type)
);

alter table property_sale_documents enable row level security;
create policy "sale_docs_owner_all" on property_sale_documents for all using (
  exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid())
);
create policy "sale_docs_admin_all" on property_sale_documents for all using (staff_can_access('owner_buyer_tenant'));
create policy "sale_docs_public_status" on property_sale_documents for select using (true);

create or replace function get_required_sale_documents()
returns text[]
language sql
immutable
as $$
  select array['certificate_of_occupancy', 'deed_of_assignment', 'survey_plan', 'governors_consent', 'tax_clearance_certificate', 'sale_agreement'];
$$;

create or replace function are_sale_documents_verified(p_property_id uuid)
returns boolean
language sql
stable
as $$
  select (
    select count(*) from property_sale_documents
    where property_id = p_property_id
      and document_type = any(get_required_sale_documents())
      and verification_status = 'verified'
  ) >= array_length(get_required_sale_documents(), 1);
$$;

alter table wallets add column if not exists escrow_held numeric(14,2) not null default 0;
alter table offers add column if not exists legal_transfer_confirmed boolean default false;

create or replace function pay_for_property(p_offer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_property_id uuid;
  v_status text;
  v_payment_status text;
  v_breakdown record;
  v_buyer_balance numeric;
  v_reference text;
begin
  select buyer_id, property_id, status, payment_status
    into v_buyer_id, v_property_id, v_status, v_payment_status
    from offers where id = p_offer_id;

  select owner_id into v_seller_id from properties where id = v_property_id;

  if v_buyer_id != auth.uid() then
    raise exception 'Only the real buyer on this offer can make this payment.';
  end if;
  if v_status != 'accepted' then
    raise exception 'This offer has not been accepted yet.';
  end if;
  if v_payment_status = 'paid' then
    raise exception 'This property has already been paid for.';
  end if;
  if not are_sale_documents_verified(v_property_id) then
    raise exception 'This property''s legal documents have not all been verified by CHS yet. Payment cannot proceed until they are.';
  end if;

  select * into v_breakdown from get_sale_commission_breakdown(p_offer_id);

  select main_balance into v_buyer_balance from wallets where user_id = v_buyer_id;
  if v_buyer_balance is null or v_buyer_balance < v_breakdown.buyer_total then
    raise exception 'Insufficient wallet balance. Total due (including your commission) is %.', v_breakdown.buyer_total;
  end if;

  v_reference := 'SALEPAY-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - v_breakdown.buyer_total, updated_at = now() where user_id = v_buyer_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_buyer_id, 'main', v_breakdown.buyer_total, 'debit', 'Property purchase (price + commission)', v_reference);

  update wallets set escrow_held = escrow_held + v_breakdown.seller_net, updated_at = now() where user_id = v_seller_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_seller_id, 'escrow_held', v_breakdown.seller_net, 'credit', 'Property sale proceeds — held pending real legal document transfer', v_reference);

  insert into transaction_commissions (transaction_type, offer_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount, status, paid_at)
  values
    ('sale', p_offer_id, v_property_id, v_buyer_id, 'buyer', v_breakdown.offer_amount, v_breakdown.buyer_pct, v_breakdown.buyer_commission, 'paid', now()),
    ('sale', p_offer_id, v_property_id, v_seller_id, 'seller', v_breakdown.offer_amount, v_breakdown.seller_pct, v_breakdown.seller_commission, 'paid', now());

  update offers set payment_status = 'paid', chs_cleared = true where id = p_offer_id;
  update properties set status = 'sold' where id = v_property_id;

  perform notify_user(v_seller_id, '💰 Property sold and paid!',
    'The buyer has paid in full — ' || v_breakdown.seller_net || ' is now visible in your wallet, held pending confirmation that all real legal documents have been transferred to the buyer. You cannot withdraw it until CHS confirms this.');
  perform notify_user(v_buyer_id, '🎉 Payment successful!',
    'You paid ' || v_breakdown.buyer_total || ' total. CHS will now coordinate the real transfer of all legal documents to you before the seller''s funds are released.');
end;
$$;

create or replace function confirm_legal_transfer_complete(p_offer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_seller_id uuid;
  v_property_id uuid;
  v_held_amount numeric;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can confirm a real legal document transfer.';
  end if;

  select property_id into v_property_id from offers where id = p_offer_id;
  select owner_id into v_seller_id from properties where id = v_property_id;

  select escrow_held into v_held_amount from wallets where user_id = v_seller_id;
  if v_held_amount is null or v_held_amount <= 0 then
    raise exception 'No real held funds found for this seller.';
  end if;

  update wallets set escrow_held = 0, main_balance = main_balance + v_held_amount, updated_at = now() where user_id = v_seller_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_seller_id, 'main', v_held_amount, 'credit', 'Sale proceeds released — legal transfer confirmed', 'RELEASE-' || substr(gen_random_uuid()::text, 1, 8));

  update offers set legal_transfer_confirmed = true where id = p_offer_id;

  perform notify_user(v_seller_id, '✓ Funds released!',
    'CHS has confirmed the real legal document transfer to the buyer is complete. Your ' || v_held_amount || ' is now in your main wallet and available to withdraw.');
end;
$$;
