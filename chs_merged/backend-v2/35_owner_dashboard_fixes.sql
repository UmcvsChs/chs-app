-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Owner Identity Privacy Toggle
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql, in the same Supabase project.
--
-- A real, per-property choice — restored, found completely missing
-- during the systematic Owner dashboard comparison against the
-- original. Lets an owner choose whether their real name shows to
-- their tenant, or stays private with only the Property Manager's
-- contact shown instead.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from properties;
-- If this errors, run 01_schema.sql first.

alter table properties add column if not exists owner_identity_visible_to_tenant boolean not null default true;

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select column_name from information_schema.columns
where table_name = 'properties' and column_name = 'owner_identity_visible_to_tenant';
-- Should return one row.

-- ═══════════════════════════════════════════════════════════════
-- Real fix: Property view tracking (for genuine analytics)
-- ═══════════════════════════════════════════════════════════════
-- The original app's "Analytics" feature showed entirely fake,
-- hardcoded numbers (a fixed "47" views, "6.4%" rate, etc., never
-- computed from anything real). Built properly here instead: a real
-- table tracking actual page visits, so every number shown is
-- genuinely real.

create table if not exists property_views (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  viewer_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table property_views enable row level security;

create policy "property_views_owner_read"
  on property_views for select
  using (exists (select 1 from properties p where p.id = property_views.property_id and p.owner_id = auth.uid()));

create policy "property_views_anyone_insert"
  on property_views for insert
  with check (true);

create policy "property_views_admin_all"
  on property_views for all
  using (is_admin());

create index if not exists property_views_property_id_idx on property_views(property_id);

select table_name from information_schema.tables where table_name = 'property_views';
-- Should return one row.

-- ═══════════════════════════════════════════════════════════════
-- Real fix: Promote a listing (genuine payment, not a fake toast)
-- ═══════════════════════════════════════════════════════════════
-- The original app's "Promote" feature never actually charged
-- anything — it just showed a success message. Built properly here:
-- a real deduction from the owner's actual wallet balance, a real
-- expiry date, enforced by an actual database function (never trusting
-- client-side math for something involving real money).

alter table properties add column if not exists promoted_until timestamptz;

create or replace function promote_listing(p_property_id uuid, p_tier_price numeric, p_tier_days integer, p_tier_name text)
returns void as $$
declare
  v_owner_id uuid;
  v_balance numeric;
begin
  select owner_id into v_owner_id from properties where id = p_property_id;
  if v_owner_id is null or v_owner_id != auth.uid() then
    raise exception 'You can only promote your own listing.';
  end if;

  select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)
  into v_balance
  from wallet_transactions
  where user_id = auth.uid() and wallet_type = 'main';

  if v_balance < p_tier_price then
    raise exception 'Insufficient wallet balance for this promotion tier.';
  end if;

  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', p_tier_price, 'debit', p_tier_name || ' listing promotion', 'PROMO-' || p_property_id);

  update properties set promoted_until = greatest(now(), coalesce(promoted_until, now())) + (p_tier_days || ' days')::interval
  where id = p_property_id;
end;
$$ language plpgsql security definer;

select routine_name from information_schema.routines where routine_name = 'promote_listing';
-- Should return one row.

-- ═══════════════════════════════════════════════════════════════
-- Real fix: Genuine listing promotion (with a real wallet debit)
-- ═══════════════════════════════════════════════════════════════
-- The original app's "Promote" feature never actually charged
-- anyone — it just updated a local variable and showed a toast, with
-- no real payment behind it at all. Built properly here: a real
-- wallet debit, a real expiry date, using the existing real wallet
-- infrastructure already in place.

alter table properties add column if not exists promoted_until timestamptz;

create or replace function promote_listing(
  p_property_id uuid,
  p_owner_id uuid,
  p_amount numeric,
  p_days integer,
  p_tier_name text
) returns boolean
language plpgsql
security definer
as $$
declare
  v_balance numeric;
begin
  select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)
    into v_balance
    from wallet_transactions
    where user_id = p_owner_id and wallet_type = 'main';

  if v_balance < p_amount then
    return false;
  end if;

  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (p_owner_id, 'main', p_amount, 'debit', p_tier_name || ' listing promotion', 'PROMO-' || substr(p_property_id::text, 1, 8));

  update properties set promoted_until = greatest(coalesce(promoted_until, now()), now()) + (p_days || ' days')::interval
    where id = p_property_id and owner_id = p_owner_id;

  return true;
end;
$$;

select column_name from information_schema.columns where table_name = 'properties' and column_name = 'promoted_until';
-- Should return one row.
