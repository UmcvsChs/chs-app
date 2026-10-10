-- 476 (Oct 10 2026) VENDOR AND SERVICE PROVIDER TEST DATA (applied live, safe to run again)
-- Adds test listings to the DEMO vendor only (phone 08070000002, "Demo Building Materials Ltd").
-- It never touches real vendors (for example Alex Group Ltd) and removes nothing.
-- Demo accounts, phone login, PIN 123456: vendor 08070000002, artisan (plumber) 08070000001.
-- Any verified-identity test guest can be the buyer (for example 08130000004, holds N100,000,000).

insert into marketplace_products(vendor_id, name, category, price, price_unit, description, status, listing_type, condition, stock_quantity, delivery_info)
select v.id, x.name, x.category, x.price, x.unit, x.descr, 'active', x.lt, case when x.lt = 'product' then 'new' end, x.stock, x.delivery
from marketplace_vendors v
join profiles p on p.id = v.user_id and p.phone = '08070000002'
cross join (values
  ('TEST Roofing Sheets (bundle of 10)', 'building_materials', 95000::numeric, 'per bundle', 'Long-span aluminium roofing sheets, test listing.', 'product', 40, 'Delivered within Kaduna in 3 days'),
  ('TEST Floor Tiles 60x60 (per carton)', 'building_materials', 18500::numeric, 'per carton', 'Porcelain tiles, test listing.', 'product', 120, 'Delivered within Kaduna in 3 days'),
  ('TEST Site Delivery and Offloading', 'building_materials', null::numeric, null, 'Quote-based service: tell us the site and quantity.', 'service', null::int, null)
) as x(name, category, price, unit, descr, lt, stock, delivery)
where not exists (select 1 from marketplace_products mp where mp.vendor_id = v.id and mp.name = x.name);

-- Checks to run after a test pass (read-only):
-- select status, payment_status, count(*) from service_quote_requests group by 1, 2;
-- select payment_status, count(*) from marketplace_direct_orders group by 1;
-- select name, stock_quantity from marketplace_products where name like 'TEST %';   -- stock should fall after a direct order
