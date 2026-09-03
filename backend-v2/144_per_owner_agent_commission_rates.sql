-- Real, new design per direct client request: an agent's commission
-- rate was only ever settable per property, one at a time — but real
-- negotiation happens per owner relationship (Owner A agreed 12%,
-- Owner B agreed 5%), and needs to be a genuine, standing rate the
-- agent can review and adjust anytime, applying automatically to
-- every property they manage for that specific owner.

create table agent_owner_commission_rates (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references profiles(id),
  owner_id uuid not null references profiles(id),
  commission_pct numeric(5,2) not null check (commission_pct > 0 and commission_pct <= 25),
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(agent_id, owner_id)
);

alter table agent_owner_commission_rates enable row level security;
create policy "agent_owner_rates_agent" on agent_owner_commission_rates for all using (auth.uid() = agent_id);
create policy "agent_owner_rates_owner_view" on agent_owner_commission_rates for select using (auth.uid() = owner_id);
create policy "agent_owner_rates_admin" on agent_owner_commission_rates for all using (staff_can_access('owner_buyer_tenant'));

create or replace function set_owner_commission_rate(p_owner_id uuid, p_pct numeric)
returns void
language plpgsql
security definer
as $$
begin
  if p_pct is null or p_pct <= 0 or p_pct > 25 then
    raise exception 'A real, valid commission percentage (up to 25%%) is required.';
  end if;

  insert into agent_owner_commission_rates (agent_id, owner_id, commission_pct)
  values (auth.uid(), p_owner_id, p_pct)
  on conflict (agent_id, owner_id) do update set commission_pct = p_pct, updated_at = now();

  update properties set agent_commission_pct = p_pct
  where managing_agent_id = auth.uid() and owner_id = p_owner_id;
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
  v_owner_id uuid;
  v_agent_id uuid;
  v_agent_pct numeric;
  v_chs_fee_pct numeric;
begin
  select amount, property_id into v_amount, v_property_id from offers where id = p_offer_id;
  select owner_id, managing_agent_id into v_owner_id, v_agent_id from properties where id = v_property_id;

  select commission_pct into v_agent_pct from agent_owner_commission_rates
  where agent_id = v_agent_id and owner_id = v_owner_id;

  if v_agent_pct is null then
    select agent_commission_pct into v_agent_pct from properties where id = v_property_id;
  end if;

  select value::numeric into v_chs_fee_pct from platform_settings where key = 'agent_platform_fee_pct';

  return query select
    v_amount, v_agent_pct,
    round(v_amount * v_agent_pct / 100, 2),
    v_chs_fee_pct,
    round(round(v_amount * v_agent_pct / 100, 2) * v_chs_fee_pct / 100, 2),
    round(v_amount * v_agent_pct / 100, 2) - round(round(v_amount * v_agent_pct / 100, 2) * v_chs_fee_pct / 100, 2),
    v_amount - round(v_amount * v_agent_pct / 100, 2),
    v_amount;
end;
$$;
