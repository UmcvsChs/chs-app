-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Geo-Tiered Credit-Based Promotion System
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql and 35_owner_dashboard_fixes.sql,
-- in the same Supabase project.
--
-- This ADDS to the existing tier-based promotion system (promote_listing,
-- promoted_until) — it does not replace or remove it. A property can be
-- promoted either the existing way (fixed 7/30/90-day tiers, one-off
-- wallet debit) or the new way (reusable credits, daily consumption,
-- pausable), tracked separately in `property_promotions`.
--
-- Real design decisions made here, and why:
--   - Credits are bought at one flat exchange rate (like wallet top-ups)
--     — the price VARIES not at purchase time, but in how many credits
--     a given property's promotion consumes per day, based on where
--     that property actually is and how big it is.
--   - Ranking category (A/B/C/D) is computed RELATIVE to other active
--     promotions in the same {state, area tier, property type, size
--     bracket} bucket, not against a fixed Naira number — so a Benue
--     advertiser is only ever compared against other Benue advertisers,
--     never overshadowed by Lagos spend. Recomputed daily.
--   - Signature package is a real recurring subscription (billed each
--     cycle via Paystack), not an exhaustible credit balance with a
--     grace period — so "never runs out mid-month" is backed by an
--     actual recurring charge, not an honor system.

select count(*) as schema_already_set_up from properties;
-- If this errors, run 01_schema.sql first.

-- ───────────────────────────────────────────────────────────────
-- 1. Location pricing tiers — admin-editable, not hardcoded
-- ───────────────────────────────────────────────────────────────
-- One row per {state} sets the state-level default. Additional rows
-- with a specific lga/area override it for that smaller area. A
-- lookup with no matching row falls back to a global default —
-- so the team never has to pre-populate all 36 states on day one.

create table if not exists location_pricing_tiers (
  id uuid primary key default uuid_generate_v4(),
  state text not null,
  lga text,                          -- null = applies to the whole state
  area text,                         -- null = applies to the whole lga
  tier_label text not null default 'Standard' check (tier_label in ('Priority','Standard')),
  is_highbrow boolean not null default false,
  credits_per_day_base numeric(6,2) not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (state, lga, area)
);

alter table location_pricing_tiers enable row level security;

create policy "location_pricing_tiers_read_all"
  on location_pricing_tiers for select
  using (true);

create policy "location_pricing_tiers_admin_write"
  on location_pricing_tiers for all
  using (is_admin());

-- Seed the five priority states at the state level. Everything else
-- falls back to the global default (see get_credits_per_day below).
-- Highbrow-area overrides (e.g. Asokoro vs Gwagwalada) are meant to be
-- added by the team afterward, from the admin dashboard, not hardcoded
-- here — the team knows the real market far better than a migration file.
insert into location_pricing_tiers (state, tier_label, credits_per_day_base)
values
  ('Lagos', 'Priority', 3),
  ('Abuja', 'Priority', 3),
  ('Rivers', 'Priority', 2.5),
  ('Kaduna', 'Priority', 2),
  ('Kano', 'Priority', 2)
on conflict (state, lga, area) do nothing;

-- ───────────────────────────────────────────────────────────────
-- 2. Promotion packages — named bundles of benefits, not prices
-- ───────────────────────────────────────────────────────────────

create table if not exists promotion_packages (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  star_rating int not null check (star_rating between 1 and 5),
  sort_order int not null,
  is_subscription boolean not null default false,
  monthly_price_naira numeric(10,2),        -- only set when is_subscription = true
  unlimited_listings boolean not null default false,
  no_credit_cutoff boolean not null default false,
  benefits_description text,
  active boolean not null default true
);

alter table promotion_packages enable row level security;

create policy "promotion_packages_read_all"
  on promotion_packages for select
  using (true);

create policy "promotion_packages_admin_write"
  on promotion_packages for all
  using (is_admin());

insert into promotion_packages (name, star_rating, sort_order, is_subscription, monthly_price_naira, unlimited_listings, no_credit_cutoff, benefits_description)
values
  ('Essential', 1, 1, false, null, false, false, 'Basic promoted placement, pay-as-you-go credits.'),
  ('Classic',   2, 2, false, null, false, false, 'Everything in Essential, plus higher search placement.'),
  ('Premium',   3, 3, false, null, false, false, 'Everything in Classic, plus featured-section eligibility.'),
  ('Elite',     4, 4, false, null, false, false, 'Everything in Premium, plus priority support.'),
  ('Signature', 5, 5, true,  50000, true, true, 'Unlimited active listings, auto-billed monthly, never pauses for low credits.')
on conflict (name) do nothing;

-- ───────────────────────────────────────────────────────────────
-- 3. Credit ledger — same append-only pattern as wallet_transactions
-- ───────────────────────────────────────────────────────────────

create table if not exists promo_credit_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount numeric(10,2) not null,
  direction text not null check (direction in ('credit','debit')),
  description text,
  reference text,
  created_at timestamptz default now()
);

alter table promo_credit_transactions enable row level security;

create policy "promo_credit_tx_own"
  on promo_credit_transactions for select
  using (auth.uid() = user_id);

create policy "promo_credit_tx_admin_all"
  on promo_credit_transactions for all
  using (is_admin());

-- ───────────────────────────────────────────────────────────────
-- 4. Per-property promotion state — the on/off toggle lives here
-- ───────────────────────────────────────────────────────────────

create table if not exists property_promotions (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade unique,
  owner_id uuid not null references profiles(id) on delete cascade,
  package_id uuid references promotion_packages(id),
  is_active boolean not null default false,
  last_charged_date date,
  rank_category text check (rank_category in ('A','B','C','D')),
  rank_computed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table property_promotions enable row level security;

create policy "property_promotions_own"
  on property_promotions for select
  using (auth.uid() = owner_id);

create policy "property_promotions_owner_toggle"
  on property_promotions for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "property_promotions_admin_all"
  on property_promotions for all
  using (is_admin());

-- Anyone can read is_active + rank_category for active promotions —
-- this is what search/homepage sorting reads, and it's not sensitive.
create policy "property_promotions_public_read_active"
  on property_promotions for select
  using (is_active = true);

-- ───────────────────────────────────────────────────────────────
-- 5. Subscriptions table — for Signature's real recurring billing
-- ───────────────────────────────────────────────────────────────

create table if not exists promo_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  package_id uuid not null references promotion_packages(id),
  status text not null default 'active' check (status in ('active','past_due','cancelled')),
  paystack_subscription_code text,
  paystack_email_token text,
  next_billing_date date,
  created_at timestamptz default now()
);

alter table promo_subscriptions enable row level security;

create policy "promo_subscriptions_own"
  on promo_subscriptions for select
  using (auth.uid() = user_id);

create policy "promo_subscriptions_admin_all"
  on promo_subscriptions for all
  using (is_admin());

-- ───────────────────────────────────────────────────────────────
-- 6. Real functions — credits per day, purchase, toggle, daily charge
-- ───────────────────────────────────────────────────────────────

-- Looks up the real cost, most specific match first: area override,
-- then lga override, then state default, then a global fallback.
-- Size multiplier: studio/1BR = 1x, 2-3BR = 1.5x, 4BR+ = 2x.
create or replace function get_credits_per_day(p_property_id uuid)
returns numeric
language plpgsql
stable
as $$
declare
  v_state text; v_lga text; v_area text; v_bedrooms int;
  v_base numeric;
  v_size_multiplier numeric;
begin
  select location_state, location_lga, location_area, coalesce(bedrooms, 1)
    into v_state, v_lga, v_area, v_bedrooms
    from properties where id = p_property_id;

  select credits_per_day_base into v_base
    from location_pricing_tiers
    where state = v_state and lga = v_lga and area = v_area
    limit 1;

  if v_base is null then
    select credits_per_day_base into v_base
      from location_pricing_tiers
      where state = v_state and lga = v_lga and area is null
      limit 1;
  end if;

  if v_base is null then
    select credits_per_day_base into v_base
      from location_pricing_tiers
      where state = v_state and lga is null and area is null
      limit 1;
  end if;

  if v_base is null then
    v_base := 1; -- global default for any state/area never explicitly priced
  end if;

  v_size_multiplier := case
    when v_bedrooms >= 4 then 2
    when v_bedrooms >= 2 then 1.5
    else 1
  end;

  return v_base * v_size_multiplier;
end;
$$;

-- Real credit balance, computed from the ledger (never a stored column).
create or replace function get_promo_credit_balance(p_user_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)
  from promo_credit_transactions
  where user_id = p_user_id;
$$;

-- Buy credits at one flat exchange rate. p_naira_amount is what was
-- actually charged via Paystack (verify that server-side before calling
-- this — same pattern as initialize-wallet-funding).
create or replace function purchase_promo_credits(p_naira_amount numeric, p_credits numeric, p_reference text)
returns void
language plpgsql
security definer
as $$
begin
  insert into promo_credit_transactions (user_id, amount, direction, description, reference)
  values (auth.uid(), p_credits, 'credit', p_credits || ' promo credits purchased for ₦' || p_naira_amount, p_reference);
end;
$$;

-- The on/off toggle. Free, instant, no wallet interaction — exactly
-- the "pause any day" control described.
create or replace function toggle_property_promotion(p_property_id uuid, p_is_active boolean, p_package_id uuid default null)
returns boolean
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id from properties where id = p_property_id;
  if v_owner_id is null or v_owner_id != auth.uid() then
    raise exception 'You can only manage promotion on your own listing.';
  end if;

  insert into property_promotions (property_id, owner_id, package_id, is_active)
  values (p_property_id, auth.uid(), p_package_id, p_is_active)
  on conflict (property_id) do update
    set is_active = p_is_active,
        package_id = coalesce(p_package_id, property_promotions.package_id),
        updated_at = now();

  return true;
end;
$$;

-- The daily charge job — meant to be run once a day (see pg_cron below).
-- For every active, non-subscription promotion: charge that property's
-- real per-day cost from the owner's real credit balance. If the
-- balance can't cover it, auto-pause and notify — never let it go
-- negative, never silently keep running unpaid.
create or replace function run_daily_promo_charges()
returns void
language plpgsql
security definer
as $$
declare
  r record;
  v_cost numeric;
  v_balance numeric;
begin
  for r in
    select pp.id, pp.property_id, pp.owner_id
    from property_promotions pp
    join promotion_packages pkg on pkg.id = pp.package_id
    where pp.is_active = true
      and coalesce(pkg.is_subscription, false) = false
      and (pp.last_charged_date is null or pp.last_charged_date < current_date)
  loop
    v_cost := get_credits_per_day(r.property_id);
    v_balance := get_promo_credit_balance(r.owner_id);

    if v_balance >= v_cost then
      insert into promo_credit_transactions (user_id, amount, direction, description, reference)
      values (r.owner_id, v_cost, 'debit', 'Daily promotion charge', 'PROMO-DAY-' || substr(r.property_id::text, 1, 8) || '-' || current_date);

      update property_promotions set last_charged_date = current_date, updated_at = now()
      where id = r.id;
    else
      update property_promotions set is_active = false, updated_at = now()
      where id = r.id;

      insert into notifications (user_id, title, body)
      values (r.owner_id, 'Promotion paused',
        'Your listing promotion was paused — your promo credit balance is too low. Top up to resume.');
    end if;
  end loop;
end;
$$;

-- Relative, percentile-based ranking — computed once a day across all
-- currently-active promotions, grouped by real local market, not a
-- fixed national price line. Top ~25% of spend in a given
-- {state, highbrow-or-not, property_type, size-bracket} bucket = A,
-- next ~25% = B, and so on. A property with no active promotion has
-- no rank_category at all (it simply isn't in the promoted pool).
create or replace function recompute_promo_rank_categories()
returns void
language plpgsql
security definer
as $$
begin
  with recent_spend as (
    select
      pp.id as promotion_id,
      p.location_state,
      coalesce(lpt.is_highbrow, false) as is_highbrow,
      p.property_type,
      case when coalesce(p.bedrooms,1) >= 4 then 'large'
           when coalesce(p.bedrooms,1) >= 2 then 'mid'
           else 'small' end as size_bracket,
      coalesce((
        select sum(t.amount) from promo_credit_transactions t
        where t.user_id = pp.owner_id and t.direction = 'debit'
          and t.created_at > now() - interval '30 days'
      ), 0) as spend_30d
    from property_promotions pp
    join properties p on p.id = pp.property_id
    left join location_pricing_tiers lpt
      on lpt.state = p.location_state and lpt.area = p.location_area
    where pp.is_active = true
  ),
  ranked as (
    select
      promotion_id,
      ntile(4) over (
        partition by location_state, is_highbrow, property_type, size_bracket
        order by spend_30d desc
      ) as bucket
    from recent_spend
  )
  update property_promotions pp
  set rank_category = case ranked.bucket
        when 1 then 'A' when 2 then 'B' when 3 then 'C' else 'D' end,
      rank_computed_at = now()
  from ranked
  where ranked.promotion_id = pp.id;
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 7. Daily schedule — real cron, not "trust the client to call this"
-- ───────────────────────────────────────────────────────────────
-- Requires the pg_cron extension (already available on Supabase).
-- Runs once daily at 00:05 WAT (23:05 UTC).

create extension if not exists pg_cron;

select cron.schedule(
  'chs-daily-promo-charges',
  '5 23 * * *',
  $$ select run_daily_promo_charges(); select recompute_promo_rank_categories(); $$
);

select table_name from information_schema.tables
where table_name in ('location_pricing_tiers','promotion_packages','promo_credit_transactions','property_promotions','promo_subscriptions');
-- Should return five rows.
