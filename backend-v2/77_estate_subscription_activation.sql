create or replace function get_estate_subscription_price(p_tier text)
returns numeric
language sql
stable
as $$
  select case p_tier
    when 'up_to_50' then (select value::numeric from platform_settings where key = 'estate_sub_up_to_50')
    when '51_to_200' then (select value::numeric from platform_settings where key = 'estate_sub_51_to_200')
    when '201_to_500' then (select value::numeric from platform_settings where key = 'estate_sub_201_to_500')
    else null
  end;
$$;

create or replace function activate_estate_subscription(p_estate_id uuid, p_tier text)
returns void
language plpgsql
security definer
as $$
declare
  v_manager_id uuid;
  v_price numeric;
  v_balance numeric;
  v_reference text;
begin
  select manager_id into v_manager_id from estates where id = p_estate_id;
  if v_manager_id != auth.uid() then
    raise exception 'You do not manage this estate.';
  end if;
  if p_tier = 'over_500' then
    raise exception 'Estates over 500 units need a custom quote — please contact CHS directly.';
  end if;

  v_price := get_estate_subscription_price(p_tier);
  if v_price is null then
    raise exception 'Invalid subscription tier.';
  end if;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_price then
    raise exception 'Insufficient wallet balance. This tier costs %.', v_price;
  end if;

  v_reference := 'ESTSUB-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - v_price, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', v_price, 'debit', 'Estate Management subscription — ' || p_tier, v_reference);

  update estates set subscription_tier = p_tier, subscription_status = 'active', subscription_expires_at = now() + interval '30 days'
  where id = p_estate_id;

  perform notify_user(v_manager_id, '✓ Estate subscription activated',
    'Your ' || p_tier || ' subscription is active until ' || (now() + interval '30 days')::date || '.');
end;
$$;
