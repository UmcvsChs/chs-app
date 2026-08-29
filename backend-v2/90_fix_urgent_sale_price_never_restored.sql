-- Real bug found and fixed: when an Urgent Sale's deadline passed,
-- the property's actual price stayed permanently discounted forever
-- — the real, original price was never restored. Also fixes a
-- second, subtler bug: the notification only fired for listings
-- expiring exactly yesterday, meaning any backlog never got notified.

create or replace function expire_urgent_sales()
returns void
language plpgsql
security definer
as $$
begin
  insert into notifications (user_id, title, body)
  select owner_id, 'Urgent Sale expired',
    title || '''s Urgent Sale deadline has passed — the real price has been restored to ' || urgent_sale_original_price || '. Relist it if it''s still urgent.'
  from properties
  where is_urgent_sale = true and urgent_sale_deadline < current_date;

  update properties
    set is_urgent_sale = false, price = coalesce(urgent_sale_original_price, price)
    where is_urgent_sale = true and urgent_sale_deadline < current_date;
end;
$$;
