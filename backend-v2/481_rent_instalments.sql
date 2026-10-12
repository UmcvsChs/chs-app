-- 481: Rent by instalments (monthly / quarterly) for CHS-managed rental properties.
-- Owner chooses which plans to allow (annual always allowed). Tenant picks at first
-- payment or at the renewal window. Each instalment is escrowed like annual rent.
-- CHS does NOT guarantee unpaid instalments: the owner carries that risk.

alter table public.properties
  add column if not exists rent_plans_allowed text[] not null default array['annual']::text[];
alter table public.properties drop constraint if exists properties_rent_plans_check;
alter table public.properties add constraint properties_rent_plans_check
  check (rent_plans_allowed <@ array['annual','quarterly','monthly']::text[] and 'annual' = any(rent_plans_allowed));

alter table public.tenancies
  add column if not exists pay_plan text not null default 'annual';
alter table public.tenancies drop constraint if exists tenancies_pay_plan_check;
alter table public.tenancies add constraint tenancies_pay_plan_check
  check (pay_plan in ('annual','quarterly','monthly'));

create table if not exists public.tenancy_installments (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies(id) on delete cascade,
  seq int not null,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  amount numeric not null check (amount > 0),
  deduction numeric not null default 0,
  is_renewal boolean not null default false,
  status text not null default 'due' check (status in ('due','paid')),
  paid_at timestamptz,
  rent_payment_id uuid references public.rent_payments(id),
  reminded_stage int not null default 0,
  created_at timestamptz not null default now(),
  unique (tenancy_id, period_start)
);
alter table public.tenancy_installments enable row level security;
revoke all on public.tenancy_installments from anon, authenticated;

-- helper: is caller a party / admin
create or replace function public._inst_party(p_tenancy uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from tenancies t where t.id = p_tenancy and (t.tenant_id = auth.uid() or t.landlord_id = auth.uid()))
         or coalesce(is_admin(), false);
$$;

create or replace function public.get_rent_plan(p_tenancy uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  t tenancies%rowtype; p properties%rowtype; v_allowed text[]; v_has_pay boolean; v_unpaid int; v_total int;
  v_renewal boolean; v_eligible boolean := false; v_reason text; v_fee numeric := 0; v_pct numeric; v_opts json; v_list json;
begin
  if not _inst_party(p_tenancy) then raise exception 'Not allowed.'; end if;
  select * into t from tenancies where id = p_tenancy;
  if not found then raise exception 'Tenancy not found.'; end if;
  select * into p from properties where id = t.property_id;
  v_allowed := coalesce(p.rent_plans_allowed, array['annual']);
  select exists(select 1 from rent_payments where tenancy_id = p_tenancy) into v_has_pay;
  select count(*) filter (where status = 'due'), count(*) into v_unpaid, v_total from tenancy_installments where tenancy_id = p_tenancy;
  v_renewal := v_has_pay;
  if t.status <> 'active' then v_reason := 'Tenancy is not active.';
  elsif p.chs_service is distinct from 'chs_managed' then v_reason := 'Instalments are offered on CHS-managed properties only.';
  elsif array_length(v_allowed, 1) < 2 then v_reason := 'The landlord has not enabled instalments.';
  elsif v_unpaid > 0 then v_reason := 'A plan is already running.';
  elsif not v_has_pay and v_total = 0 then v_eligible := true;
  elsif v_has_pay and (t.lease_end - current_date) <= 30 then v_eligible := true; v_renewal := true;
  else v_reason := 'You can change your plan within 30 days of your lease end.';
  end if;
  if not v_has_pay and v_total = 0 then
    select coalesce(sum(commission_amount),0) into v_fee from transaction_commissions where tenancy_id = p_tenancy and payer_role = 'tenant' and status <> 'paid';
  end if;
  select json_agg(json_build_object('plan', pl, 'count', n,
      'per', round(t.annual_rent / n), 'first_payment', round(t.annual_rent / n) + v_fee) order by n)
    into v_opts from (select unnest(v_allowed) pl) a,
    lateral (select case pl when 'annual' then 1 when 'quarterly' then 4 else 12 end n) b;
  select json_agg(json_build_object('seq', seq, 'period_start', period_start, 'period_end', period_end, 'due_date', due_date,
      'amount', amount, 'status', status, 'paid_at', paid_at, 'is_renewal', is_renewal) order by period_start)
    into v_list from tenancy_installments where tenancy_id = p_tenancy and (status = 'due' or period_start >= t.lease_end - interval '1 year' - interval '1 day');
  return json_build_object('eligible', v_eligible, 'reason', v_reason, 'pay_plan', t.pay_plan, 'allowed', v_allowed,
    'is_renewal', v_renewal, 'annual_rent', t.annual_rent, 'agency_fee_first', v_fee,
    'options', coalesce(v_opts, '[]'::json), 'installments', coalesce(v_list, '[]'::json));
end $$;

create or replace function public.start_rent_plan(p_tenancy uuid, p_plan text) returns json
language plpgsql security definer set search_path = public as $$
declare
  t tenancies%rowtype; p properties%rowtype; n int; v_has_pay boolean; v_unpaid int; v_total int;
  v_start date; v_pct numeric; v_each numeric; v_ded_total numeric := 0; v_ded_each numeric; i int; v_amt numeric; v_ded numeric;
  v_step interval; v_rent_basis numeric;
begin
  select * into t from tenancies where id = p_tenancy;
  if not found or t.tenant_id <> auth.uid() then raise exception 'Only the tenant on this tenancy can choose a rent plan.'; end if;
  if p_plan not in ('annual','quarterly','monthly') then raise exception 'Unknown plan.'; end if;
  select * into p from properties where id = t.property_id;
  if t.status <> 'active' then raise exception 'Tenancy is not active.'; end if;
  select exists(select 1 from rent_payments where tenancy_id = p_tenancy) into v_has_pay;
  select count(*) filter (where status = 'due'), count(*) into v_unpaid, v_total from tenancy_installments where tenancy_id = p_tenancy;
  if v_unpaid > 0 then raise exception 'A plan is already running; finish it first.'; end if;
  if v_has_pay and (t.lease_end - current_date) > 30 then raise exception 'You can change your plan within 30 days of your lease end.'; end if;
  if p_plan = 'annual' then
    update tenancies set pay_plan = 'annual' where id = p_tenancy;
    return json_build_object('plan', 'annual');
  end if;
  if p.chs_service is distinct from 'chs_managed' or not (p_plan = any(p.rent_plans_allowed)) then
    raise exception 'The landlord has not enabled this plan.';
  end if;
  n := case p_plan when 'quarterly' then 4 else 12 end;
  v_step := case p_plan when 'quarterly' then interval '3 months' else interval '1 month' end;
  v_each := round(t.annual_rent / n);
  if not v_has_pay then
    v_start := t.lease_start;
    select coalesce(sum(commission_amount),0) into v_ded_total from transaction_commissions
      where tenancy_id = p_tenancy and payer_role = 'landlord' and status <> 'paid';
  else
    v_start := t.lease_end;
    select coalesce(nullif(value,'')::numeric,0) into v_pct from platform_settings where key = 'rental_renewal_commission_landlord_pct';
    v_ded_total := round(t.annual_rent * coalesce(v_pct,0) / 100, 2);
  end if;
  v_ded_each := round(v_ded_total / n, 2);
  for i in 1..n loop
    v_amt := case when i = n then t.annual_rent - v_each * (n - 1) else v_each end;
    v_ded := case when i = n then v_ded_total - v_ded_each * (n - 1) else v_ded_each end;
    insert into tenancy_installments (tenancy_id, seq, period_start, period_end, due_date, amount, deduction, is_renewal)
    values (p_tenancy, i, (v_start + v_step * (i - 1))::date,
            case when i = n then (v_start + interval '1 year')::date else (v_start + v_step * i)::date end,
            (v_start + v_step * (i - 1))::date, v_amt, v_ded, v_has_pay);
  end loop;
  update tenancies set pay_plan = p_plan where id = p_tenancy;
  perform notify_user(t.landlord_id, 'Tenant chose to pay rent by instalments',
    'Your tenant chose ' || p_plan || ' rent for ' || p.title || '. Each instalment is paid into escrow and released to you as usual. CHS does not guarantee unpaid instalments.', '/owner');
  return json_build_object('plan', p_plan, 'count', n, 'per', v_each);
end $$;

create or replace function public.pay_rent_installment(p_tenancy uuid, p_wallet_source text default 'main') returns json
language plpgsql security definer set search_path = public as $$
declare
  t tenancies%rowtype; ins tenancy_installments%rowtype; p properties%rowtype;
  v_fee numeric := 0; v_total numeric; v_bal numeric; v_ref text; v_grace int; v_net numeric; v_pid uuid; v_first_year boolean;
  v_pct numeric; v_orig record; v_remaining int;
begin
  if p_wallet_source not in ('main','rent_savings') then raise exception 'A real payment source must be chosen.'; end if;
  select * into t from tenancies where id = p_tenancy;
  if not found or t.tenant_id <> auth.uid() then raise exception 'Only the tenant on this tenancy can pay this rent.'; end if;
  select * into p from properties where id = t.property_id;
  select * into ins from tenancy_installments where tenancy_id = p_tenancy and status = 'due' order by period_start limit 1;
  if not found then raise exception 'No instalment is due on this tenancy.'; end if;
  if ins.seq > 1 and ins.due_date > current_date + 14 then
    raise exception 'not_yet_due: Your next instalment opens on %.', ins.due_date - 14;
  end if;
  v_first_year := not ins.is_renewal and not exists(select 1 from rent_payments where tenancy_id = p_tenancy);
  if v_first_year then
    select coalesce(sum(commission_amount),0) into v_fee from transaction_commissions where tenancy_id = p_tenancy and payer_role = 'tenant' and status <> 'paid';
  end if;
  if p_wallet_source = 'rent_savings' and v_fee > 0 then
    raise exception 'Your CHS agency fee (%) must be paid from your main wallet. Please pay this first instalment from your main wallet.', v_fee;
  end if;
  v_total := ins.amount + v_fee;
  if p_wallet_source = 'rent_savings' then select rent_savings into v_bal from wallets where user_id = t.tenant_id;
  else select main_balance into v_bal from wallets where user_id = t.tenant_id; end if;
  if v_bal is null or v_bal < v_total then raise exception 'insufficient_balance'; end if;
  v_ref := 'RENT-' || substr(gen_random_uuid()::text, 1, 8);
  if p_wallet_source = 'rent_savings' then
    update wallets set rent_savings = rent_savings - v_total, updated_at = now() where user_id = t.tenant_id;
  else
    update wallets set main_balance = main_balance - v_total, updated_at = now() where user_id = t.tenant_id;
  end if;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (t.tenant_id, p_wallet_source, v_total, 'debit',
    'Rent instalment ' || ins.seq || ' (' || ins.amount || case when v_fee > 0 then ' + CHS agency fee ' || v_fee else '' end || ')', v_ref);
  select coalesce(nullif(value,'')::int, 14) into v_grace from platform_settings where key = 'rental_grace_period_days';
  v_net := ins.amount - ins.deduction;
  update wallets set escrow_held = escrow_held + v_net, updated_at = now() where user_id = t.landlord_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (t.landlord_id, 'escrow_held', v_net, 'credit',
    'Rent instalment ' || ins.seq || ' received, net of your CHS management fee (' || ins.deduction || ' deducted) — held for the grace period', v_ref);
  insert into rent_payments (tenancy_id, tenant_id, landlord_id, amount, covers_period_start, covers_period_end, reference, release_deadline)
  values (p_tenancy, t.tenant_id, t.landlord_id, v_net, ins.period_start, ins.period_end, v_ref, now() + (v_grace || ' days')::interval)
  returning id into v_pid;
  update tenancy_installments set status = 'paid', paid_at = now(), rent_payment_id = v_pid where id = ins.id;
  if v_fee > 0 then
    update transaction_commissions set status = 'paid', paid_at = now() where tenancy_id = p_tenancy and payer_role = 'tenant' and status <> 'paid';
  end if;
  -- landlord commission ledger: one paid row per instalment
  select * into v_orig from transaction_commissions where tenancy_id = p_tenancy and payer_role = 'landlord' and status <> 'paid' limit 1;
  if v_first_year and found then
    update transaction_commissions set status = 'paid', paid_at = now(), base_amount = ins.amount, commission_amount = ins.deduction, rent_payment_id = v_pid where id = v_orig.id;
  else
    select coalesce(nullif(value,'')::numeric,0) into v_pct from platform_settings where key = 'rental_renewal_commission_landlord_pct';
    insert into transaction_commissions (transaction_type, tenancy_id, rent_payment_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount, status, paid_at)
    values ('rental', p_tenancy, v_pid, t.property_id, t.landlord_id, 'landlord', ins.amount,
            case when ins.is_renewal then v_pct else coalesce((select commission_percentage from transaction_commissions where tenancy_id = p_tenancy and payer_role = 'landlord' order by created_at limit 1), 0) end,
            ins.deduction, 'paid', now());
  end if;
  if ins.is_renewal and ins.seq = 1 then
    update tenancies set lease_end = (lease_end + interval '1 year')::date where id = p_tenancy;
  end if;
  select count(*) into v_remaining from tenancy_installments where tenancy_id = p_tenancy and status = 'due';
  perform notify_user(t.tenant_id, '✓ Rent instalment ' || ins.seq || ' paid',
    'You paid ' || v_total || ' for ' || p.title || '. ' || v_remaining || ' instalment(s) remain in this plan.', '/my-receipts');
  perform notify_user(t.landlord_id, '💰 Rent instalment received',
    'Instalment ' || ins.seq || ' of ' || ins.amount || ' for ' || p.title || ' was paid. ' || v_net || ' is held in your wallet and released after the grace period.', '/my-receipts');
  perform notify_admins_by_domain('owner_buyer_tenant', '💰 Rent instalment paid',
    'Instalment ' || ins.seq || ' (' || ins.amount || ') for ' || p.title || '. Tenant agency fee: ' || v_fee || '. Management fee deducted: ' || ins.deduction || '. Net escrowed: ' || v_net || '.', '/admin?tab=escrowoversight');
  return json_build_object('reference', v_ref, 'seq', ins.seq, 'paid', v_total, 'amount', ins.amount, 'agency_fee', v_fee,
    'deduction', ins.deduction, 'net_held_in_escrow', v_net, 'remaining', v_remaining);
end $$;

create or replace function public.set_rent_plans(p_property uuid, p_plans text[]) returns json
language plpgsql security definer set search_path = public as $$
declare p properties%rowtype; v_plans text[];
begin
  select * into p from properties where id = p_property;
  if not found or (p.owner_id <> auth.uid() and not is_admin()) then raise exception 'Only the property owner can change this.'; end if;
  if p.chs_service is distinct from 'chs_managed' then raise exception 'Instalment rent is available on CHS-managed properties only.'; end if;
  if p.purpose <> 'rent' then raise exception 'Only rental properties can offer instalments.'; end if;
  select array(select distinct x from unnest(p_plans || array['annual']) x where x in ('annual','quarterly','monthly')) into v_plans;
  perform set_config('chs.svc_ok', 'on', true);
  update properties set rent_plans_allowed = v_plans where id = p_property;
  perform log_audit_event('rent_plans_set', 'property', p_property, 'Rent plans: ' || array_to_string(v_plans, ','), jsonb_build_object('plans', v_plans));
  return json_build_object('plans', v_plans);
end $$;

-- block annual pay while a plan is chosen
create or replace function public.pay_rent_plan_guard(p_tenancy uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if exists(select 1 from tenancies where id = p_tenancy and pay_plan <> 'annual') then
    raise exception 'This tenancy is on an instalment plan. Please pay the next instalment instead.';
  end if;
end $$;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.pay_rent(uuid,text)'::regprocedure);
  if d not like '%pay_rent_plan_guard%' then
    d := replace(d, E'begin\n  if p_wallet_source not in', E'begin\n  perform pay_rent_plan_guard(p_tenancy_id);\n  if p_wallet_source not in');
    execute d;
  end if;
  d := pg_get_functiondef('public.process_auto_pay_rents()'::regprocedure);
  if d not like '%pay_plan%' then
    d := replace(d, E'and t.status = ''active''', E'and t.status = ''active''\n    and t.pay_plan = ''annual''');
    execute d;
  end if;
end $$;

-- daily reminders: stage 1 = due within 3 days, 2 = due today, 3 = overdue 3+ days
create or replace function public.chs_instalment_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_stage int; n int := 0; v_title text;
begin
  for r in select i.*, t.tenant_id, t.landlord_id, p.title from tenancy_installments i
           join tenancies t on t.id = i.tenancy_id join properties p on p.id = t.property_id
           where i.status = 'due' and t.status = 'active' and i.due_date <= current_date + 3 loop
    v_stage := case when current_date - r.due_date >= 3 then 3 when r.due_date <= current_date then 2 else 1 end;
    if v_stage > r.reminded_stage then
      perform notify_user(r.tenant_id, case v_stage when 1 then 'Rent instalment due soon' when 2 then 'Rent instalment due today' else '⚠️ Rent instalment overdue' end,
        'Instalment ' || r.seq || ' of ' || r.amount || ' for ' || r.title || ' is ' ||
        case v_stage when 1 then 'due on ' || r.due_date else 'due since ' || r.due_date end || '.', '/tenant');
      if v_stage = 3 then
        perform notify_user(r.landlord_id, 'Tenant instalment overdue', 'Instalment ' || r.seq || ' for ' || r.title || ' (due ' || r.due_date || ') is unpaid. CHS does not guarantee instalments.', '/owner');
        perform notify_admins_by_domain('owner_buyer_tenant', 'Overdue rent instalment', r.title || ': instalment ' || r.seq || ' due ' || r.due_date || ' unpaid.', '/admin');
      end if;
      update tenancy_installments set reminded_stage = v_stage where id = r.id;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

select cron.schedule('chs-instalment-reminders', '20 7 * * *', 'select public.chs_instalment_reminders()');

-- extend move-in cost with instalment info
do $$
declare d text;
begin
  d := pg_get_functiondef('public.get_move_in_cost(uuid)'::regprocedure);
  if d not like '%rent_plans%' then
    d := replace(d, E'''total'', v_p.price + v_comm + v_extra);',
      E'''total'', v_p.price + v_comm + v_extra,\n    ''rent_plans'', case when v_p.chs_service = ''chs_managed'' then v_p.rent_plans_allowed else array[''annual''] end,\n    ''monthly_first_payment'', round(v_p.price / 12) + v_comm,\n    ''quarterly_first_payment'', round(v_p.price / 4) + v_comm);');
    execute d;
  end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array['get_rent_plan(uuid)','start_rent_plan(uuid,text)','pay_rent_installment(uuid,text)','set_rent_plans(uuid,text[])','pay_rent_plan_guard(uuid)','chs_instalment_reminders()','_inst_party(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  revoke execute on function public.chs_instalment_reminders() from authenticated;
  revoke execute on function public.pay_rent_plan_guard(uuid) from authenticated;
end $$;
