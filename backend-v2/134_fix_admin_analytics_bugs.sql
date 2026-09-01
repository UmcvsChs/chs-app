-- Two real bugs caught by testing: offers has no real "when paid"
-- timestamp at all (fixed by using transaction_commissions.paid_at as
-- the real source of truth), and shortlet_bookings' real amount
-- column is named total_price, not total_amount.

create or replace function get_admin_analytics_report(p_start_date timestamptz, p_end_date timestamptz)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can view the real platform analytics report.';
  end if;

  select json_build_object(
    'period_start', p_start_date,
    'period_end', p_end_date,
    'sold_properties_count', (
      select count(*) from transaction_commissions
      where transaction_type in ('sale', 'agent_managed_sale') and status = 'paid' and paid_at between p_start_date and p_end_date
    ),
    'sold_properties_value', (
      select coalesce(sum(o.amount), 0) from offers o
      join transaction_commissions tc on tc.offer_id = o.id
      where tc.transaction_type in ('sale', 'agent_managed_sale') and tc.status = 'paid' and tc.paid_at between p_start_date and p_end_date
    ),
    'new_tenancies_count', (select count(*) from tenancies where created_at between p_start_date and p_end_date),
    'new_tenancies_value', (select coalesce(sum(annual_rent), 0) from tenancies where created_at between p_start_date and p_end_date),
    'shortlet_bookings_count', (select count(*) from shortlet_bookings where created_at between p_start_date and p_end_date and status = 'confirmed'),
    'shortlet_bookings_value', (select coalesce(sum(total_price), 0) from shortlet_bookings where created_at between p_start_date and p_end_date and status = 'confirmed'),
    'new_listings_count', (select count(*) from properties where created_at between p_start_date and p_end_date),
    'new_users_count', (select count(*) from profiles where created_at between p_start_date and p_end_date),
    'total_commission_revenue', (select coalesce(sum(commission_amount), 0) from transaction_commissions where status = 'paid' and paid_at between p_start_date and p_end_date),
    'commission_by_type', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select transaction_type, count(*) as count, sum(commission_amount) as total
        from transaction_commissions where status = 'paid' and paid_at between p_start_date and p_end_date
        group by transaction_type
      ) t
    ),
    'service_charges_collected', (select coalesce(sum(amount), 0) from service_charges where status = 'paid' and paid_at between p_start_date and p_end_date)
  ) into v_result;

  return v_result;
end;
$$;
