-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Sale Commission (Invoice-Based) + Shortlet Digital
-- Check-In/Check-Out
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from offers;

-- ───────────────────────────────────────────────────────────────
-- 1. Sale commission — real, admin-editable percentage. Since actual
--    sale proceeds never move through CHS's own wallet (confirmed by
--    checking the real schema — offers.chs_cleared is just an
--    approval flag), this is a real, separate, invoiced charge to the
--    seller, paid through their own CHS wallet — not a silent cut
--    taken from money CHS never actually touches.
-- ───────────────────────────────────────────────────────────────

insert into platform_settings (key, value) values ('sale_commission_percentage', '5')
on conflict (key) do nothing;

create table if not exists sale_commissions (
  id uuid primary key default uuid_generate_v4(),
  offer_id uuid not null references offers(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  sale_amount numeric(14,2) not null,
  commission_percentage numeric(5,2) not null,
  commission_amount numeric(14,2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'waived')),
  paid_at timestamptz,
  reference text,
  created_at timestamptz default now(),
  unique (offer_id)
);

alter table sale_commissions enable row level security;
create policy "sale_commissions_seller_own" on sale_commissions for select using (auth.uid() = seller_id);
create policy "sale_commissions_admin_all" on sale_commissions for all using (staff_can_access('finance'));

-- Real, one-time generation — called the moment CHS clears an offer,
-- using whatever the real, current admin-set percentage is at that
-- moment (never hardcoded, always reads the live setting).
create or replace function generate_sale_commission(p_offer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_amount numeric;
  v_property_id uuid;
  v_seller_id uuid;
  v_percentage numeric;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can finalize a sale commission.';
  end if;

  select amount, property_id into v_amount, v_property_id from offers where id = p_offer_id;
  select owner_id into v_seller_id from properties where id = v_property_id;
  select value::numeric into v_percentage from platform_settings where key = 'sale_commission_percentage';

  insert into sale_commissions (offer_id, property_id, seller_id, sale_amount, commission_percentage, commission_amount)
  values (p_offer_id, v_property_id, v_seller_id, v_amount, v_percentage, round(v_amount * v_percentage / 100, 2))
  on conflict (offer_id) do nothing;

  perform notify_user(v_seller_id, '💰 Sale commission invoice generated',
    'A real ' || v_percentage || '% commission (' || round(v_amount * v_percentage / 100, 2) || ') is due on your recent sale. Please settle it from your CHS wallet.');
end;
$$;

create or replace function pay_sale_commission(p_commission_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_amount numeric;
  v_seller_id uuid;
  v_status text;
  v_balance numeric;
  v_reference text;
begin
  select commission_amount, seller_id, status into v_amount, v_seller_id, v_status from sale_commissions where id = p_commission_id;

  if v_seller_id != auth.uid() then
    raise exception 'This commission invoice does not belong to you.';
  end if;
  if v_status = 'paid' then
    raise exception 'This commission has already been paid.';
  end if;

  select main_balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_amount then
    raise exception 'Insufficient wallet balance to settle this commission.';
  end if;

  v_reference := 'COMM-' || substr(gen_random_uuid()::text, 1, 8);

  update wallets set main_balance = main_balance - v_amount, updated_at = now() where user_id = auth.uid();
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (auth.uid(), 'main', v_amount, 'debit', 'Sale commission payment', v_reference);

  update sale_commissions set status = 'paid', paid_at = now(), reference = v_reference where id = p_commission_id;
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 2. Shortlet digital check-in / check-out — genuinely reuses the
--    exact Property Condition Report mechanism already built and
--    trusted for tenancies, rather than building a second, parallel
--    system. The single biggest real source of shortlet disputes
--    ("the place wasn't as described" / "the guest damaged
--    something") gets the same real evidence-based fix already
--    proven for long-term tenancies.
-- ───────────────────────────────────────────────────────────────

alter table condition_reports alter column tenancy_id drop not null;
alter table condition_reports add column if not exists shortlet_booking_id uuid references shortlet_bookings(id) on delete cascade;
alter table condition_reports add column if not exists report_type text not null default 'move_in' check (report_type in ('move_in', 'check_in', 'check_out'));

alter table condition_reports add constraint condition_reports_one_context_check
  check ((tenancy_id is not null and shortlet_booking_id is null) or (tenancy_id is null and shortlet_booking_id is not null));

-- Real, necessary fix caught before it ever shipped: the existing
-- policies above only ever check tenancy_id — a shortlet report
-- (tenancy_id null by design) would otherwise be completely invisible
-- to both the real host and the real guest, visible only to admin.
create policy "condition_shortlet_host" on condition_reports for all using (
  exists (select 1 from shortlet_bookings sb join properties p on p.id = sb.property_id
    where sb.id = condition_reports.shortlet_booking_id and p.owner_id = auth.uid())
);
create policy "condition_shortlet_guest" on condition_reports for select using (
  exists (select 1 from shortlet_bookings sb where sb.id = condition_reports.shortlet_booking_id and sb.guest_id = auth.uid())
);
create policy "condition_shortlet_guest_confirm" on condition_reports for update using (
  exists (select 1 from shortlet_bookings sb where sb.id = condition_reports.shortlet_booking_id and sb.guest_id = auth.uid())
);

create or replace function submit_shortlet_condition_report(p_booking_id uuid, p_report_type text, p_rooms jsonb)
returns uuid
language plpgsql
security definer
as $$
declare
  v_host_id uuid;
  v_new_id uuid;
begin
  select owner_id into v_host_id from properties p join shortlet_bookings sb on sb.property_id = p.id where sb.id = p_booking_id;

  if v_host_id != auth.uid() and not is_admin() then
    raise exception 'Only the host can submit a condition report for this booking.';
  end if;
  if p_report_type not in ('check_in', 'check_out') then
    raise exception 'Invalid report type for a shortlet booking.';
  end if;

  insert into condition_reports (shortlet_booking_id, report_type, rooms, status, submitted_at)
  values (p_booking_id, p_report_type, p_rooms, 'pending_confirmation', now())
  returning id into v_new_id;

  return v_new_id;
end;
$$;

create or replace function confirm_shortlet_condition_report(p_report_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_guest_id uuid;
begin
  select sb.guest_id into v_guest_id
    from condition_reports cr join shortlet_bookings sb on sb.id = cr.shortlet_booking_id
    where cr.id = p_report_id;

  if v_guest_id != auth.uid() then
    raise exception 'Only the real guest on this booking can confirm this report.';
  end if;

  update condition_reports set tenant_confirmed = true, status = 'confirmed', approved_at = now() where id = p_report_id;
end;
$$;

select column_name from information_schema.columns where table_name = 'condition_reports' and column_name = 'shortlet_booking_id';
-- Should return one row.
