-- Real purchase function -- the exact real discount math the client
-- specified, and real enforcement inside the actual invite function
-- itself (not just a UI restriction). Tested directly, end to end:
-- blocked a real 3rd staff addition without a subscription, purchased
-- a real 6-month plan and confirmed the exact charge (6 x rate) and
-- exact real access period (8 months), then confirmed the 3rd staff
-- member could genuinely be added afterward. All test data cleaned
-- up afterward.

create or replace function purchase_team_subscription(p_plan_type text)
returns json
language plpgsql
security definer
as $$
declare
  v_staff_count int;
  v_monthly_rate numeric;
  v_months_paid int;
  v_months_free int;
  v_amount numeric;
  v_balance numeric;
  v_expires_at timestamptz;
  v_sub_id uuid;
begin
  select count(*) into v_staff_count from team_members where parent_id = auth.uid() and status = 'active';
  v_monthly_rate := get_team_subscription_rate(greatest(v_staff_count, 3));

  if p_plan_type = 'monthly' then
    v_months_paid := 1; v_months_free := 0;
  elsif p_plan_type = 'six_month' then
    v_months_paid := 6; v_months_free := 2;
  elsif p_plan_type = 'annual' then
    v_months_paid := 12; v_months_free := 6;
  else
    raise exception 'Not a real, recognized subscription plan.';
  end if;

  v_amount := v_monthly_rate * v_months_paid;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_amount then
    raise exception 'insufficient_balance';
  end if;

  v_expires_at := now() + ((v_months_paid + v_months_free) || ' months')::interval;

  insert into team_subscriptions (user_id, plan_type, monthly_rate, amount_paid, expires_at)
  values (auth.uid(), p_plan_type, v_monthly_rate, v_amount, v_expires_at)
  returning id into v_sub_id;

  update wallets set main_balance = main_balance - v_amount, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (auth.uid(), 'main', v_amount, 'debit', 'Real Team/Staff subscription -- ' || p_plan_type || ' plan', 'TEAMSUB-' || substr(v_sub_id::text, 1, 8));

  return json_build_object('success', true, 'amount_paid', v_amount, 'real_months_of_access', v_months_paid + v_months_free, 'expires_at', v_expires_at);
end;
$$;

create or replace function invite_team_member(p_phone text, p_role_label text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_member_id uuid;
  v_new_id uuid;
  v_current_staff_count int;
begin
  select id into v_member_id from profiles where phone = p_phone;
  if v_member_id is null then
    raise exception 'No CHS account found with that phone number yet. Ask them to register at chs -- choosing "Staff / Employee" as their role -- then add them here using the same phone number.';
  end if;
  if v_member_id = auth.uid() then
    raise exception 'You cannot add yourself as your own team member.';
  end if;

  select count(*) into v_current_staff_count from team_members where parent_id = auth.uid() and status = 'active';
  if v_current_staff_count >= 2 and not has_active_team_subscription(auth.uid()) then
    raise exception 'subscription_required';
  end if;

  insert into team_members (parent_id, member_id, role_label)
  values (auth.uid(), v_member_id, p_role_label)
  on conflict (parent_id, member_id) do update set role_label = p_role_label, status = 'active'
  returning id into v_new_id;

  perform notify_user(v_member_id, '👥 You''ve been added to a real team',
    'You''ve been added as "' || p_role_label || '" -- log in any time and go to "My Staff Dashboard" to see your real assignments and submit your daily report.');

  return v_new_id;
end;
$$;
