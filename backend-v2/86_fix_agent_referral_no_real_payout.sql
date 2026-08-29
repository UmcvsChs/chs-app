-- Real fix, more incomplete than prior ones: nothing anywhere
-- computed or paid an agent's real referral commission. Built per the
-- real, documented split logic — 35%/30% single-agent share, genuine
-- 50/50 for co-broker deals.

create or replace function complete_agent_referral(p_referral_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_chs_commission numeric;
  v_agent_share_pct numeric;
  v_split_50_50 boolean;
  v_listing_agent_id uuid;
  v_referring_agent_id uuid;
  v_payout numeric;
  v_half numeric;
  v_reference text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can complete a referral and trigger payout.';
  end if;

  select chs_commission, agent_share_pct, split_50_50, listing_agent_id, referring_agent_id
    into v_chs_commission, v_agent_share_pct, v_split_50_50, v_listing_agent_id, v_referring_agent_id
    from agent_referrals where id = p_referral_id;

  if v_chs_commission is null then
    raise exception 'This referral has no real commission amount set.';
  end if;

  if v_split_50_50 and v_listing_agent_id is not null and v_referring_agent_id is not null and v_listing_agent_id != v_referring_agent_id then
    v_half := round(v_chs_commission * 0.5, 2);
    v_reference := 'AGREF-' || substr(gen_random_uuid()::text, 1, 8);

    update wallets set main_balance = main_balance + v_half, updated_at = now() where user_id = v_listing_agent_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (v_listing_agent_id, 'main', v_half, 'credit', 'Agent referral payout (co-broker split)', v_reference);

    update wallets set main_balance = main_balance + v_half, updated_at = now() where user_id = v_referring_agent_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (v_referring_agent_id, 'main', v_half, 'credit', 'Agent referral payout (co-broker split)', v_reference);

    update agent_referrals set stage = 'completed', agent_payout = v_half where id = p_referral_id;

    perform notify_user(v_listing_agent_id, '💰 Referral payout received', 'You have been paid ' || v_half || ' for a completed co-broker referral.');
    perform notify_user(v_referring_agent_id, '💰 Referral payout received', 'You have been paid ' || v_half || ' for a completed co-broker referral.');
  else
    v_payout := round(v_chs_commission * coalesce(v_agent_share_pct, 0) / 100, 2);
    v_reference := 'AGREF-' || substr(gen_random_uuid()::text, 1, 8);

    update wallets set main_balance = main_balance + v_payout, updated_at = now() where user_id = v_referring_agent_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (v_referring_agent_id, 'main', v_payout, 'credit', 'Agent referral payout', v_reference);

    update agent_referrals set stage = 'completed', agent_payout = v_payout where id = p_referral_id;

    perform notify_user(v_referring_agent_id, '💰 Referral payout received', 'You have been paid ' || v_payout || ' for a completed referral.');
  end if;
end;
$$;
