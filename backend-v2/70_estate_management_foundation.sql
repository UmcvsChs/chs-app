-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Estate Management: Estates as a Real, First-Class Entity
-- ═══════════════════════════════════════════════════════════════
-- The foundation everything else (service charges, bulk onboarding,
-- the manager dashboard, periodic owner reports) attaches to. An
-- Estate is a real, bounded collection of units under one manager's
-- subscription — not just a bigger version of individual property
-- delegation, which only works once a tenancy already exists.

select count(*) as schema_already_set_up from properties;

-- ───────────────────────────────────────────────────────────────
-- 1. Estates — the real entity your tester described: "we buy a
--    slot... all our tenants and everybody in our property can be
--    bundled under it."
-- ───────────────────────────────────────────────────────────────

create table if not exists estates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text not null,
  state text not null,
  lga text,
  manager_id uuid not null references profiles(id) on delete cascade,
  total_units_declared int,  -- what the manager says they have, for real planning (e.g. 500) — not enforced, just informational until units are actually added
  subscription_tier text not null default 'trial' check (subscription_tier in ('trial', 'up_to_50', '51_to_200', '201_to_500', 'over_500')),
  subscription_status text not null default 'pending' check (subscription_status in ('pending', 'active', 'expired', 'cancelled')),
  subscription_expires_at timestamptz,
  created_at timestamptz default now()
);

alter table estates enable row level security;

create policy "estates_manager_own" on estates for all using (auth.uid() = manager_id);
create policy "estates_admin_all" on estates for all using (staff_can_access('artisan_dev_pm_vendor'));

-- ───────────────────────────────────────────────────────────────
-- 2. Real linkage — a property either belongs to a real estate, or
--    it doesn't (the current, standalone owner-managed model keeps
--    working exactly as before). This deliberately reuses the
--    existing properties/tenancies/wallet/maintenance system rather
--    than building a second, parallel one — an estate unit is a real
--    property, just one that belongs to a bounded, subscribed estate.
-- ───────────────────────────────────────────────────────────────

alter table properties add column if not exists estate_id uuid references estates(id) on delete set null;
alter table properties add column if not exists unit_label text;  -- e.g. "Block C, Flat 4" — real, human-readable identity within a 500-unit estate, since "title" alone won't scale

create index if not exists idx_properties_estate on properties(estate_id) where estate_id is not null;

-- ───────────────────────────────────────────────────────────────
-- 3. Service charges — a genuinely distinct concept from rent, per
--    direct instruction. Covers common-area maintenance, security,
--    facilities — billed separately, tracked separately.
-- ───────────────────────────────────────────────────────────────

create table if not exists service_charges (
  id uuid primary key default uuid_generate_v4(),
  estate_id uuid not null references estates(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid references profiles(id),
  amount numeric(12,2) not null,
  description text not null default 'Estate service charge',
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'waived')),
  paid_at timestamptz,
  reference text,
  created_at timestamptz default now()
);

alter table service_charges enable row level security;

create policy "service_charges_tenant_own" on service_charges for select using (auth.uid() = tenant_id);
create policy "service_charges_manager_own" on service_charges for all using (
  exists (select 1 from estates e where e.id = service_charges.estate_id and e.manager_id = auth.uid())
);
create policy "service_charges_admin_all" on service_charges for all using (staff_can_access('artisan_dev_pm_vendor'));

-- Real payment — same real wallet system already built and tested,
-- not a separate, parallel money-handling mechanism.
create or replace function pay_service_charge(p_charge_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_amount numeric;
  v_tenant_id uuid;
  v_status text;
  v_balance numeric;
  v_reference text;
begin
  select amount, tenant_id, status into v_amount, v_tenant_id, v_status from service_charges where id = p_charge_id;

  if v_tenant_id != auth.uid() then
    raise exception 'This service charge does not belong to you.';
  end if;
  if v_status = 'paid' then
    raise exception 'This service charge has already been paid.';
  end if;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_amount then
    raise exception 'Insufficient wallet balance for this service charge.';
  end if;

  v_reference := 'SVC-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - v_amount, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', v_amount, 'debit', 'Service charge payment', v_reference);

  update service_charges set status = 'paid', paid_at = now(), reference = v_reference where id = p_charge_id;
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 4. Real estate manager dashboard data — one function returning the
--    actual aggregate picture: occupancy, pending complaints,
--    pending maintenance, and collection status across the WHOLE
--    estate at once. This is the real "check our dashboard, see
--    pending activities, and we know what to do" your tester
--    described — not scattered across many separate screens.
-- ───────────────────────────────────────────────────────────────

create or replace function get_estate_overview(p_estate_id uuid)
returns json
language plpgsql
stable
security definer
as $$
declare
  v_manager_id uuid;
  v_result json;
begin
  select manager_id into v_manager_id from estates where id = p_estate_id;
  if v_manager_id != auth.uid() and not is_admin() then
    raise exception 'You do not manage this estate.';
  end if;

  select json_build_object(
    'total_units', (select count(*) from properties where estate_id = p_estate_id),
    'occupied_units', (select count(distinct t.property_id) from tenancies t join properties p on p.id = t.property_id where p.estate_id = p_estate_id and t.status = 'active'),
    'vacant_units', (select count(*) from properties p where p.estate_id = p_estate_id and not exists (select 1 from tenancies t where t.property_id = p.id and t.status = 'active')),
    'pending_disputes', (select count(*) from disputes d join tenancies t on t.id = d.tenancy_id join properties p on p.id = t.property_id where p.estate_id = p_estate_id and d.status = 'open'),
    'pending_maintenance', (select count(*) from fault_reports fr join tenancies t on t.id = fr.tenancy_id join properties p on p.id = t.property_id where p.estate_id = p_estate_id and fr.status != 'resolved'),
    'service_charges_pending', (select count(*) from service_charges where estate_id = p_estate_id and status = 'pending'),
    'service_charges_overdue', (select count(*) from service_charges where estate_id = p_estate_id and status = 'pending' and due_date < current_date),
    'total_collected_this_month', (select coalesce(sum(amount), 0) from service_charges where estate_id = p_estate_id and status = 'paid' and paid_at >= date_trunc('month', now()))
  ) into v_result;

  return v_result;
end;
$$;

select column_name from information_schema.columns where table_name = 'properties' and column_name = 'estate_id';
-- Should return one row.
