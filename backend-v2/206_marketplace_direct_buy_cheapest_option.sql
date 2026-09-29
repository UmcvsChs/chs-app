-- Real, new feature completing the marketplace redesign: a genuine
-- "skip the conversation" option. A buyer can sort real products by
-- price and buy the cheapest one directly, at its own real, fixed,
-- listed price -- no quote, no negotiation, no messages to moderate,
-- since there's nothing being negotiated. The vendor sees only a real
-- CHS reference number, never the buyer's identity. Same real 6%/4%
-- commission split and escrow protection as the quote-based path.

create table if not exists marketplace_direct_orders (
  id uuid primary key default gen_random_uuid(),
  reference_number text unique,
  product_id uuid not null references marketplace_products(id),
  buyer_id uuid not null references profiles(id),
  amount numeric not null,
  buyer_commission_amount numeric not null,
  vendor_commission_amount numeric not null,
  payment_status text not null default 'held_escrow' check (payment_status in ('held_escrow', 'released', 'refunded')),
  escrow_reference text,
  created_at timestamptz default now()
);

create sequence if not exists marketplace_direct_order_seq start 1;
alter table marketplace_direct_orders alter column reference_number set default ('CHS-BUY-' || lpad(nextval('marketplace_direct_order_seq')::text, 6, '0'));

alter table marketplace_direct_orders enable row level security;
create policy marketplace_direct_orders_buyer on marketplace_direct_orders for select using (buyer_id = auth.uid());
create policy marketplace_direct_orders_vendor on marketplace_direct_orders for select using (
  exists (select 1 from marketplace_products mp join marketplace_vendors mv on mv.id = mp.vendor_id where mp.id = product_id and mv.user_id = auth.uid())
);
create policy marketplace_direct_orders_admin on marketplace_direct_orders for all using (staff_can_access('owner_buyer_tenant'));

-- Real, direct purchase — charges the buyer the product's own real,
-- current price plus a real 6% commission, held in escrow immediately.
create or replace function buy_product_direct(p_product_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_price numeric;
  v_buyer_pct numeric;
  v_vendor_pct numeric;
  v_buyer_commission numeric;
  v_vendor_commission numeric;
  v_real_total numeric;
  v_balance numeric;
  v_new_id uuid;
  v_reference text;
  v_escrow_ref text;
  v_vendor_user_id uuid;
begin
  select mp.price, mv.user_id into v_price, v_vendor_user_id
    from marketplace_products mp join marketplace_vendors mv on mv.id = mp.vendor_id
    where mp.id = p_product_id and mp.status = 'active';

  if v_price is null then
    raise exception 'This real product is not currently available.';
  end if;

  select value::numeric into v_buyer_pct from platform_settings where key = 'marketplace_buyer_commission_pct';
  select value::numeric into v_vendor_pct from platform_settings where key = 'marketplace_vendor_commission_pct';

  v_buyer_commission := round(v_price * v_buyer_pct / 100, 2);
  v_vendor_commission := round(v_price * v_vendor_pct / 100, 2);
  v_real_total := v_price + v_buyer_commission;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_real_total then
    raise exception 'insufficient_balance';
  end if;

  v_escrow_ref := 'BUYPAY-' || substr(gen_random_uuid()::text, 1, 8);

  insert into marketplace_direct_orders (product_id, buyer_id, amount, buyer_commission_amount, vendor_commission_amount, escrow_reference)
  values (p_product_id, auth.uid(), v_price, v_buyer_commission, v_vendor_commission, v_escrow_ref)
  returning id, reference_number into v_new_id, v_reference;

  update wallets set main_balance = main_balance - v_real_total, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', v_real_total, 'debit', 'Real direct marketplace purchase, ref ' || v_reference || ' (price + your ' || v_buyer_pct || '% commission), held in escrow', v_escrow_ref);

  perform notify_user(v_vendor_user_id, '🛒 A real direct order was placed',
    'Reference ' || v_reference || ' — a real buyer has paid in full for this item. CHS is holding the funds until delivery is confirmed.');
  perform notify_admins_by_domain('owner_buyer_tenant', '🛒 A real direct marketplace order needs fulfillment tracking',
    'Reference ' || v_reference || ' — ' || v_real_total || ' held in escrow.');

  return json_build_object('success', true, 'reference_number', v_reference, 'real_total_paid', v_real_total);
end;
$$;

create or replace function release_direct_order_to_vendor(p_order_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_vendor_user_id uuid;
  v_amount numeric;
  v_vendor_commission numeric;
  v_vendor_net numeric;
  v_payment_status text;
  v_reference text;
  v_escrow_ref text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can release a real direct order.';
  end if;

  select o.amount, o.vendor_commission_amount, o.payment_status, o.reference_number, o.escrow_reference, mv.user_id
    into v_amount, v_vendor_commission, v_payment_status, v_reference, v_escrow_ref, v_vendor_user_id
    from marketplace_direct_orders o
    join marketplace_products mp on mp.id = o.product_id
    join marketplace_vendors mv on mv.id = mp.vendor_id
    where o.id = p_order_id;

  if v_payment_status != 'held_escrow' then
    raise exception 'This real order is not currently held in escrow.';
  end if;

  v_vendor_net := v_amount - v_vendor_commission;

  update wallets set main_balance = main_balance + v_vendor_net, updated_at = now() where user_id = v_vendor_user_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_vendor_user_id, 'main', v_vendor_net, 'credit', 'Real direct marketplace sale, ref ' || v_reference || ', net of your real commission', v_escrow_ref);

  update marketplace_direct_orders set payment_status = 'released' where id = p_order_id;

  perform notify_user(v_vendor_user_id, '💰 Real payment released', 'Your real net proceeds have been credited to your wallet.');
end;
$$;

create or replace function refund_direct_order_to_buyer(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_amount numeric;
  v_buyer_commission numeric;
  v_payment_status text;
  v_reference text;
  v_escrow_ref text;
  v_real_refund numeric;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can authorize a real refund.';
  end if;

  select buyer_id, amount, buyer_commission_amount, payment_status, reference_number, escrow_reference
    into v_buyer_id, v_amount, v_buyer_commission, v_payment_status, v_reference, v_escrow_ref
    from marketplace_direct_orders where id = p_order_id;

  if v_payment_status != 'held_escrow' then
    raise exception 'This real order is not currently held in escrow.';
  end if;

  v_real_refund := v_amount + v_buyer_commission;

  update wallets set main_balance = main_balance + v_real_refund, updated_at = now() where user_id = v_buyer_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_buyer_id, 'main', v_real_refund, 'credit', 'Real direct order refund, ref ' || v_reference || ' — ' || p_reason, v_escrow_ref);

  update marketplace_direct_orders set payment_status = 'refunded' where id = p_order_id;

  perform notify_user(v_buyer_id, '✓ Your real refund has been issued', 'Your full ' || v_real_refund || ' has been returned. Reason: ' || p_reason);
end;
$$;
