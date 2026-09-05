-- Real, new revenue feature per direct client decision: free for up
-- to 2 real staff members, a real subscription required from the
-- 3rd staff member onward, with real, specific discounts for longer
-- commitments -- pay 6 months, get 2 free (8 months of real access);
-- pay 12 months, get 6 free (18 months of real access). Tiered by
-- real staff count, matching the same pricing shape already used for
-- Estate Management in CHS's own Terms & Conditions.

insert into platform_settings (key, value) values
  ('team_sub_tier_3_5', '5000'),
  ('team_sub_tier_6_15', '12000'),
  ('team_sub_tier_16_plus', '25000')
on conflict (key) do nothing;

create table if not exists team_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  plan_type text not null check (plan_type in ('monthly', 'six_month', 'annual')),
  monthly_rate numeric not null,
  amount_paid numeric not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  created_at timestamptz default now()
);

alter table team_subscriptions enable row level security;
create policy team_subscriptions_own on team_subscriptions for select using (user_id = auth.uid());
create policy team_subscriptions_admin on team_subscriptions for all using (staff_can_access('owner_buyer_tenant'));

create or replace function get_team_subscription_rate(p_staff_count int)
returns numeric
language sql
stable
as $$
  select case
    when p_staff_count <= 5 then (select value::numeric from platform_settings where key = 'team_sub_tier_3_5')
    when p_staff_count <= 15 then (select value::numeric from platform_settings where key = 'team_sub_tier_6_15')
    else (select value::numeric from platform_settings where key = 'team_sub_tier_16_plus')
  end;
$$;

create or replace function has_active_team_subscription(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from team_subscriptions
    where user_id = p_user_id and status = 'active' and expires_at > now()
  );
$$;
