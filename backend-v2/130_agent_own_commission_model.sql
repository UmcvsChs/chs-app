-- Real, new commission model per direct client design: a third-party
-- agent with full authority over a property keeps charging their own
-- real market rate (10-15%, whatever they've agreed with their
-- client) — CHS does not add its own standard commission on top for
-- the buyer or seller at all in this model. Instead, CHS takes a
-- real, capped 3% cut directly from the agent's own commission
-- earnings, as a platform usage fee — never more than 3%, regardless
-- of how much the agent charges their client.

alter table properties add column if not exists agent_commission_pct numeric(5,2);

insert into platform_settings (key, value) values ('agent_platform_fee_pct', '3')
on conflict (key) do nothing;

create or replace function set_agent_commission_rate(p_property_id uuid, p_pct numeric)
returns void
language plpgsql
security definer
as $$
declare
  v_managing_agent_id uuid;
begin
  select managing_agent_id into v_managing_agent_id from properties where id = p_property_id;
  if v_managing_agent_id != auth.uid() then
    raise exception 'Only the real managing agent for this property can set its commission rate.';
  end if;
  if p_pct is null or p_pct <= 0 or p_pct > 25 then
    raise exception 'A real, valid commission percentage (up to 25%%) is required.';
  end if;

  update properties set agent_commission_pct = p_pct where id = p_property_id;
end;
$$;

create or replace function get_agent_commission_breakdown(p_offer_id uuid)
returns table(offer_amount numeric, agent_pct numeric, agent_commission numeric, chs_fee_pct numeric, chs_fee_amount numeric, agent_net numeric, seller_net numeric, buyer_total numeric)
language plpgsql
stable
as $$
declare
  v_amount numeric;
  v_property_id uuid;
  v_agent_pct numeric;
  v_chs_fee_pct numeric;
begin
  select amount, property_id into v_amount, v_property_id from offers where id = p_offer_id;
  select agent_commission_pct into v_agent_pct from properties where id = v_property_id;
  select value::numeric into v_chs_fee_pct from platform_settings where key = 'agent_platform_fee_pct';

  return query select
    v_amount,
    v_agent_pct,
    round(v_amount * v_agent_pct / 100, 2),
    v_chs_fee_pct,
    round(round(v_amount * v_agent_pct / 100, 2) * v_chs_fee_pct / 100, 2),
    round(v_amount * v_agent_pct / 100, 2) - round(round(v_amount * v_agent_pct / 100, 2) * v_chs_fee_pct / 100, 2),
    v_amount - round(v_amount * v_agent_pct / 100, 2),
    v_amount;
end;
$$;

create or replace function pay_for_property_agent_managed(p_offer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_agent_id uuid;
  v_property_id uuid;
  v_status text;
  v_payment_status text;
  v_breakdown record;
  v_buyer_balance numeric;
  v_reference text;
  v_deadline_days int;
begin
  select buyer_id, property_id, status, payment_status
    into v_buyer_id, v_property_id, v_status, v_payment_status
    from offers where id = p_offer_id;

  select owner_id, managing_agent_id into v_seller_id, v_agent_id from properties where id = v_property_id;

  if v_buyer_id != auth.uid() then
    raise exception 'Only the real buyer on this offer can make this payment.';
  end if;
  if v_status != 'accepted' then
    raise exception 'This offer has not been accepted yet.';
  end if;
  if v_payment_status = 'paid' then
    raise exception 'This property has already been paid for.';
  end if;

  select * into v_breakdown from get_agent_commission_breakdown(p_offer_id);
  if v_breakdown.agent_pct is null then
    raise exception 'This property has no real agent commission rate set — use the standard payment instead.';
  end if;

  select main_balance into v_buyer_balance from wallets where user_id = v_buyer_id;
  if v_buyer_balance is null or v_buyer_balance < v_breakdown.buyer_total then
    raise exception 'Insufficient wallet balance. Total due is %.', v_breakdown.buyer_total;
  end if;

  v_reference := 'AGENTSALE-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - v_breakdown.buyer_total, updated_at = now() where user_id = v_buyer_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_buyer_id, 'main', v_breakdown.buyer_total, 'debit', 'Property purchase (agent-managed, real agreed price)', v_reference);

  update wallets set escrow_held = escrow_held + v_breakdown.seller_net, updated_at = now() where user_id = v_seller_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_seller_id, 'escrow_held', v_breakdown.seller_net, 'credit', 'Property sale proceeds, net of real agent commission — held pending legal transfer', v_reference);

  update wallets set main_balance = main_balance + v_breakdown.agent_net, updated_at = now() where user_id = v_agent_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_agent_id, 'main', v_breakdown.agent_net, 'credit', 'Real agent commission earned, net of CHS platform fee', v_reference);

  insert into transaction_commissions (transaction_type, offer_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount, status, paid_at)
  values ('agent_managed_sale', p_offer_id, v_property_id, v_agent_id, 'agent', v_breakdown.agent_commission, v_breakdown.chs_fee_pct, v_breakdown.chs_fee_amount, 'paid', now());

  select value::int into v_deadline_days from platform_settings where key = 'sale_document_deadline_days';
  update offers set payment_status = 'paid', chs_cleared = true, document_deadline = now() + (coalesce(v_deadline_days, 14) || ' days')::interval where id = p_offer_id;
  update properties set status = 'sold' where id = v_property_id;

  perform notify_user(v_seller_id, '💰 Property sold and paid!', 'The buyer has paid in full. ' || v_breakdown.seller_net || ' is now held in your wallet pending legal document transfer.');
  perform notify_user(v_agent_id, '💰 Your real commission has been paid', 'You earned ' || v_breakdown.agent_net || ' (your ' || v_breakdown.agent_commission || ' commission, net of CHS''s ' || v_breakdown.chs_fee_pct || '% platform fee).');
  perform notify_user(v_buyer_id, '🎉 Payment successful!', 'You paid ' || v_breakdown.buyer_total || ' — the real agreed price for this property.');
end;
$$;

alter table transaction_commissions drop constraint if exists transaction_commissions_transaction_type_check;
alter table transaction_commissions add constraint transaction_commissions_transaction_type_check
  check (transaction_type = ANY (ARRAY['sale', 'rental', 'shortlet', 'hire', 'rent_to_own', 'agent_managed_sale']));
