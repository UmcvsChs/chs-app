-- Real, new feature per direct client request: a genuine, date-range
-- filterable record of sold properties, rentals, and other real
-- transactions, for proper accounting and record-keeping — not just a
-- live snapshot of current totals, which is all that existed before.
-- Also builds the same real reporting ability for owners, estate
-- managers, and agents to generate their own activity records.

create or replace function get_owner_activity_report(p_owner_id uuid, p_start_date timestamptz, p_end_date timestamptz)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  if p_owner_id != auth.uid() and not is_admin() then
    raise exception 'You can only generate your own real activity report.';
  end if;

  select json_build_object(
    'period_start', p_start_date, 'period_end', p_end_date,
    'properties_sold', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select p.title, o.amount, tc.paid_at from transaction_commissions tc
        join offers o on o.id = tc.offer_id join properties p on p.id = o.property_id
        where p.owner_id = p_owner_id and tc.status = 'paid' and tc.transaction_type in ('sale','agent_managed_sale') and tc.paid_at between p_start_date and p_end_date
      ) t
    ),
    'new_tenancies', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select p.title, tn.annual_rent, tn.created_at from tenancies tn join properties p on p.id = tn.property_id
        where p.owner_id = p_owner_id and tn.created_at between p_start_date and p_end_date
      ) t
    ),
    'total_earned_this_period', (
      select coalesce(sum(wt.amount), 0) from wallet_transactions wt
      where wt.user_id = p_owner_id and wt.direction = 'credit' and wt.created_at between p_start_date and p_end_date
    ),
    'offers_received', (select count(*) from offers o join properties p on p.id = o.property_id where p.owner_id = p_owner_id and o.created_at between p_start_date and p_end_date)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function get_manager_activity_report(p_manager_id uuid, p_start_date timestamptz, p_end_date timestamptz)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  if p_manager_id != auth.uid() and not is_admin() then
    raise exception 'You can only generate your own real activity report.';
  end if;

  select json_build_object(
    'period_start', p_start_date, 'period_end', p_end_date,
    'new_tenancies_count', (
      select count(*) from tenancies tn join properties p on p.id = tn.property_id join estates e on e.id = p.estate_id
      where e.manager_id = p_manager_id and tn.created_at between p_start_date and p_end_date
    ),
    'service_charges_billed', (select coalesce(sum(amount), 0) from service_charges where estate_id in (select id from estates where manager_id = p_manager_id) and created_at between p_start_date and p_end_date),
    'service_charges_collected', (select coalesce(sum(amount), 0) from service_charges where estate_id in (select id from estates where manager_id = p_manager_id) and status = 'paid' and paid_at between p_start_date and p_end_date),
    'maintenance_resolved', (
      select count(*) from fault_reports fr join properties p on p.id = fr.property_id
      where p.estate_id in (select id from estates where manager_id = p_manager_id) and fr.status = 'resolved' and fr.updated_at between p_start_date and p_end_date
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function get_agent_activity_report(p_agent_id uuid, p_start_date timestamptz, p_end_date timestamptz)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  if p_agent_id != auth.uid() and not is_admin() then
    raise exception 'You can only generate your own real activity report.';
  end if;

  select json_build_object(
    'period_start', p_start_date, 'period_end', p_end_date,
    'real_commission_earned', (
      select coalesce(sum(wt.amount), 0) from wallet_transactions wt
      where wt.user_id = p_agent_id and wt.direction = 'credit' and wt.description ilike '%commission%'
      and wt.created_at between p_start_date and p_end_date
    ),
    'deals_closed', (
      select count(*) from transaction_commissions where payer_id = p_agent_id and payer_role = 'agent'
      and status = 'paid' and paid_at between p_start_date and p_end_date
    ),
    'new_tenancies_managed', (
      select count(*) from tenancies where manager_id = p_agent_id and created_at between p_start_date and p_end_date
    )
  ) into v_result;

  return v_result;
end;
$$;
