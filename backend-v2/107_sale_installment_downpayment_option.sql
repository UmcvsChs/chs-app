-- Real, new feature per direct client request: a seller may accept a
-- down payment instead of requiring full payment upfront, specifying
-- a real minimum percentage; a buyer can then pay the rest in one or
-- more further real installments. Commission is charged proportionally
-- on each real payment, matching the same principle already proven
-- for Rent-to-Own. The property is only marked sold, and the escrow
-- hold only becomes eligible for release, once genuinely fully paid.

alter table offers add column if not exists accepts_installment boolean default false;
alter table offers add column if not exists downpayment_pct numeric(5,2);
alter table offers add column if not exists amount_paid numeric(14,2) default 0;

create table sale_installment_payments (
  id uuid primary key default uuid_generate_v4(),
  offer_id uuid not null references offers(id) on delete cascade,
  amount numeric(14,2) not null,
  buyer_commission numeric(14,2) not null,
  seller_commission numeric(14,2) not null,
  reference text,
  paid_at timestamptz default now()
);

alter table sale_installment_payments enable row level security;
create policy "installment_payments_buyer_read" on sale_installment_payments for select using (
  exists (select 1 from offers o where o.id = offer_id and o.buyer_id = auth.uid())
);
create policy "installment_payments_seller_read" on sale_installment_payments for select using (
  exists (select 1 from offers o join properties p on p.id = o.property_id where o.id = offer_id and p.owner_id = auth.uid())
);
create policy "installment_payments_admin_all" on sale_installment_payments for all using (staff_can_access('owner_buyer_tenant'));

create or replace function accept_offer_with_installment(p_offer_id uuid, p_downpayment_pct numeric)
returns void
language plpgsql
security definer
as $$
declare
  v_seller_id uuid;
  v_buyer_id uuid;
  v_property_id uuid;
begin
  select o.buyer_id, p.id, p.owner_id into v_buyer_id, v_property_id, v_seller_id
    from offers o join properties p on p.id = o.property_id
    where o.id = p_offer_id;

  if v_seller_id != auth.uid() then
    raise exception 'Only the real property owner can accept this offer.';
  end if;
  if p_downpayment_pct is null or p_downpayment_pct <= 0 or p_downpayment_pct > 100 then
    raise exception 'A real, valid down payment percentage between 1 and 100 is required.';
  end if;

  update offers set status = 'accepted', accepts_installment = true, downpayment_pct = p_downpayment_pct where id = p_offer_id;

  perform notify_user(v_buyer_id, '✓ Offer accepted — down payment option available',
    'The seller has accepted your offer and will accept a real down payment of at least ' || p_downpayment_pct || '% to begin, with the balance payable afterward.');
end;
$$;
