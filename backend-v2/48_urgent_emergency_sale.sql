-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Urgent & Emergency Sale (UES)
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql, in the same Supabase project.
--
-- A real category under Sales for genuinely urgent, discounted
-- listings — someone relocating fast, a medical emergency, or similar
-- real financial pressure, willing to sell below market for speed.
--
-- The central design risk with a category built entirely around
-- "urgent, discounted, must sell now": it is also the exact pitch used
-- in real property scams. So this is deliberately harder to list
-- under, not easier — enforced at the DATABASE level via a trigger,
-- not just a function, because `properties_owner_all` already lets an
-- owner update their own row directly through any client call, which
-- would silently bypass a check that only lived inside a function
-- nobody was forced to use.
--
-- No blocking pre-approval queue (an owner in a genuine hurry can't
-- wait on that) — instead, every activation fires an immediate,
-- real-time notification to every admin, and shows a dedicated CHS
-- hotline number on the listing so an interested buyer can reach a
-- real person fast, rather than only slower in-app messaging.

select count(*) as schema_already_set_up from properties;
-- If this errors, run 01_schema.sql first.

-- ───────────────────────────────────────────────────────────────
-- 1. Platform settings — a real, admin-editable key/value table.
-- ───────────────────────────────────────────────────────────────
-- Nothing like this existed anywhere in the app before now — every
-- other configurable value was hardcoded. This is small, general
-- purpose, and reusable well beyond just this one feature.

create table if not exists platform_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

alter table platform_settings enable row level security;

create policy "platform_settings_read_all"
  on platform_settings for select
  using (true);

create policy "platform_settings_admin_write"
  on platform_settings for all
  using (is_admin());

-- Seeded with a placeholder — the real CHS team needs to set the real
-- number from the admin dashboard before this feature is genuinely
-- usable by a buyer trying to call.
insert into platform_settings (key, value)
values ('urgent_sale_hotline', '+234-XXX-XXX-XXXX (set the real number in Admin → Settings)')
on conflict (key) do nothing;

-- ───────────────────────────────────────────────────────────────
-- 2. Urgent Sale fields — directly on properties, same pattern as
--    the existing rent_to_own_* columns for a property attribute.
-- ───────────────────────────────────────────────────────────────

alter table properties
  add column if not exists is_urgent_sale boolean not null default false,
  add column if not exists urgent_sale_original_price numeric(14,2),
  add column if not exists urgent_sale_reason text check (urgent_sale_reason in ('relocation','medical','financial','other')),
  add column if not exists urgent_sale_deadline date,
  add column if not exists urgent_sale_activated_at timestamptz;

-- ───────────────────────────────────────────────────────────────
-- 3. The real enforcement — a trigger, not just a function, so it
--    holds regardless of how the update is issued.
-- ───────────────────────────────────────────────────────────────

create or replace function enforce_urgent_sale_requirements()
returns trigger
language plpgsql
as $$
declare
  v_seller_verified boolean;
begin
  -- Only check when a row is actually turning urgent sale ON (or
  -- staying on with changed terms) — untouched rows and rows turning
  -- it off never hit these checks.
  if new.is_urgent_sale = true then

    if new.purpose != 'sale' then
      raise exception 'Urgent Sale is only available for properties listed for sale.';
    end if;

    if new.verification_status != 'verified' then
      raise exception 'Only an already-verified property can be listed as an Urgent Sale.';
    end if;

    select valid_id_verified into v_seller_verified
      from profiles where id = new.owner_id;
    if coalesce(v_seller_verified, false) != true then
      raise exception 'Your identity must be verified before listing an Urgent Sale.';
    end if;

    if new.urgent_sale_original_price is null or new.urgent_sale_original_price <= new.price then
      raise exception 'Urgent Sale requires a real discount — the original price must be higher than the listed price.';
    end if;

    if new.urgent_sale_deadline is null or new.urgent_sale_deadline < current_date then
      raise exception 'Urgent Sale requires a real deadline, today or later.';
    end if;

    if new.urgent_sale_reason is null then
      raise exception 'Please select a reason for the Urgent Sale.';
    end if;

    -- Only stamp activated_at the moment it genuinely turns on, not on
    -- every subsequent edit while it's already active. OLD isn't bound
    -- at all on INSERT (referencing it throws, not just null), so this
    -- has to branch on TG_OP before ever touching OLD.
    if TG_OP = 'INSERT' or old.is_urgent_sale is not true then
      new.urgent_sale_activated_at := now();

      -- Real-time visibility for admin, not a blocking queue — the
      -- listing is already live by the time this fires.
      insert into notifications (user_id, title, body)
      select id, '🚨 New Urgent Sale listed',
        new.title || ' — ' || new.urgent_sale_reason || ', deadline ' || new.urgent_sale_deadline::text
      from profiles where role = 'admin';
    end if;

  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_urgent_sale on properties;
create trigger trg_enforce_urgent_sale
  before insert or update on properties
  for each row
  execute function enforce_urgent_sale_requirements();

-- ───────────────────────────────────────────────────────────────
-- 4. Auto-expiry — once the real deadline passes, the badge drops
--    off automatically rather than sitting there indefinitely.
-- ───────────────────────────────────────────────────────────────

create or replace function expire_urgent_sales()
returns void
language plpgsql
security definer
as $$
begin
  update properties
    set is_urgent_sale = false
    where is_urgent_sale = true and urgent_sale_deadline < current_date;

  insert into notifications (user_id, title, body)
  select owner_id, 'Urgent Sale expired',
    title || '''s Urgent Sale deadline has passed — relist it if it''s still urgent.'
  from properties
  where is_urgent_sale = false and urgent_sale_deadline = current_date - 1;
end;
$$;

-- Folded into the same daily schedule already running for promotions
-- (see 46_geo_tiered_promotion_credits.sql) rather than a second cron
-- job doing a very similar once-a-day job.
select cron.unschedule('chs-daily-promo-charges');
select cron.schedule(
  'chs-daily-promo-charges',
  '5 23 * * *',
  $$ select run_daily_promo_charges(); select recompute_promo_rank_categories(); select expire_urgent_sales(); $$
);

select column_name from information_schema.columns
where table_name = 'properties' and column_name = 'is_urgent_sale';
-- Should return one row.
