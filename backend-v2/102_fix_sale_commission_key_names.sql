-- Real bug caught by testing before delivery: the commission
-- breakdown function used guessed platform_settings key names that
-- didn't match the real, actual keys already in use.

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
