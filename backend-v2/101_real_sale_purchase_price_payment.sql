-- Real, fundamental gap found through direct client testing: this
-- entire engagement thoroughly tested and proved commission math for
-- sales, but never actually built the mechanism for a buyer to pay
-- the seller the real purchase price itself. Every "sale commission"
-- test this whole audit ran was correct in isolation, sitting on top
-- of a transaction that never actually had a real payment button.
--
-- Built as one real, transparent checkout: the buyer's total includes
-- their own commission automatically, the seller receives their real
-- net (price minus their commission) automatically — nothing shrouded,
-- both sides see the real breakdown before paying.

alter table offers add column if not exists payment_status text default 'unpaid' check (payment_status in ('unpaid', 'paid'));

create or replace function get_sale_commission_breakdown(p_offer_id uuid)
returns table(offer_amount numeric, buyer_pct numeric, seller_pct numeric, buyer_commission numeric, seller_commission numeric, buyer_total numeric, seller_net numeric)
language plpgsql
stable
as $$
declare
  v_amount numeric;
  v_buyer_pct numeric;
  v_seller_pct numeric;
begin
  select amount into v_amount from offers where id = p_offer_id;
  select value::numeric into v_buyer_pct from platform_settings where key = 'sale_commission_buyer_percentage';
  select value::numeric into v_seller_pct from platform_settings where key = 'sale_commission_seller_percentage';

  return query select
    v_amount,
    v_buyer_pct,
    v_seller_pct,
    round(v_amount * v_buyer_pct / 100, 2),
    round(v_amount * v_seller_pct / 100, 2),
    v_amount + round(v_amount * v_buyer_pct / 100, 2),
    v_amount - round(v_amount * v_seller_pct / 100, 2);
end;
$$;

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

  select * into v_breakdown from get_sale_commission_breakdown(p_offer_id);

  select main_balance into v_buyer_balance from wallets where user_id = v_buyer_id;
  if v_buyer_balance is null or v_buyer_balance < v_breakdown.buyer_total then
    raise exception 'Insufficient wallet balance. Total due (including your commission) is %.', v_breakdown.buyer_total;
  end if;

  v_reference := 'SALEPAY-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - v_breakdown.buyer_total, updated_at = now() where user_id = v_buyer_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_buyer_id, 'main', v_breakdown.buyer_total, 'debit', 'Property purchase (price + commission)', v_reference);

  update wallets set main_balance = main_balance + v_breakdown.seller_net, updated_at = now() where user_id = v_seller_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_seller_id, 'main', v_breakdown.seller_net, 'credit', 'Property sale proceeds (net of commission)', v_reference);

  insert into transaction_commissions (transaction_type, offer_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount, status, paid_at)
  values
    ('sale', p_offer_id, v_property_id, v_buyer_id, 'buyer', v_breakdown.offer_amount, v_breakdown.buyer_pct, v_breakdown.buyer_commission, 'paid', now()),
    ('sale', p_offer_id, v_property_id, v_seller_id, 'seller', v_breakdown.offer_amount, v_breakdown.seller_pct, v_breakdown.seller_commission, 'paid', now());

  update offers set payment_status = 'paid', chs_cleared = true where id = p_offer_id;
  update properties set status = 'sold' where id = v_property_id;

  perform notify_user(v_seller_id, '💰 Property sold and paid!',
    'The buyer has paid in full. You received ' || v_breakdown.seller_net || ' (your ' || v_breakdown.offer_amount || ' sale price, minus your ' || v_breakdown.seller_commission || ' commission).');
  perform notify_user(v_buyer_id, '🎉 Payment successful — property is now yours!',
    'You paid ' || v_breakdown.buyer_total || ' total (' || v_breakdown.offer_amount || ' purchase price + ' || v_breakdown.buyer_commission || ' commission).');
end;
$$;
