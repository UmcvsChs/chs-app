-- Real, small accuracy fix caught while testing: listings_last_30_days
-- counted every new listing regardless of status, while
-- total_active_listings only counted real, verified, active ones --
-- producing a genuinely confusing pair of numbers where the "last 30
-- days" figure could exceed the "total active" figure. Both now use
-- the same real filter, so the two numbers stay honestly comparable.
--
-- NOTE: this migration number (342) was independently reused by an
-- earlier, unrelated feature (real refund request/processing) in the
-- same session. Kept as 342b; see 342a for the other.

create or replace function get_investor_dashboard_summary()
returns json
language plpgsql
security definer
as $$
declare
  v_role text;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role != 'investor' and not is_admin() then
    raise exception 'This real summary is only available to a real investor account or CHS staff.';
  end if;

  return (
    select json_build_object(
      'as_of', now(),
      'growth', json_build_object(
        'total_active_listings', (select count(*) from properties where status = 'active' and verification_status = 'verified'),
        'listings_last_30_days', (select count(*) from properties where created_at > now() - interval '30 days' and status = 'active' and verification_status = 'verified'),
        'listings_by_purpose', (
          select coalesce(json_object_agg(purpose, cnt), '{}'::json) from (
            select purpose, count(*) as cnt from properties where verification_status = 'verified' and status = 'active' group by purpose
          ) x
        ),
        'total_real_users', (select count(*) from profiles where role not in ('admin','staff','investor')),
        'users_last_30_days', (select count(*) from profiles where created_at > now() - interval '30 days' and role not in ('admin','staff','investor'))
      ),
      'financial_health', json_build_object(
        'gross_transaction_value_all_time', (select coalesce(sum(amount), 0) from offers where status = 'accepted' and payment_status = 'paid'),
        'successful_transactions', (select count(*) from offers where status = 'accepted' and payment_status = 'paid'),
        'refunded_transactions', (select count(*) from offers where refund_status = 'refunded'),
        'success_rate_pct', (
          select case when (select count(*) from offers where payment_status = 'paid') = 0 then 100
            else round(100.0 * (select count(*) from offers where status = 'accepted' and payment_status = 'paid' and refund_status != 'refunded')
              / (select count(*) from offers where payment_status = 'paid'), 1) end
        ),
        'currently_held_in_escrow', (select coalesce(sum(amount), 0) from offers where payment_status = 'paid' and legal_transfer_confirmed = false)
      ),
      'revenue', json_build_object(
        'total_platform_earnings_all_time', (select coalesce(sum(commission_amount), 0) from transaction_commissions where status = 'paid'),
        'earnings_last_30_days', (select coalesce(sum(commission_amount), 0) from transaction_commissions where status = 'paid' and paid_at > now() - interval '30 days'),
        'earnings_by_transaction_type', (
          select coalesce(json_object_agg(transaction_type, type_total), '{}'::json) from (
            select transaction_type, sum(commission_amount) as type_total
            from transaction_commissions where status = 'paid' group by transaction_type
          ) x
        )
      ),
      'trust_and_quality', json_build_object(
        'pct_listings_verified', (
          select round(100.0 * (select count(*) from properties where verification_status = 'verified')
            / nullif((select count(*) from properties), 0), 1)
        ),
        'open_disputes', (select count(*) from disputes where status not in ('resolved','closed'))
      ),
      'geographic_reach', (
        select coalesce(json_agg(row_to_json(g)), '[]'::json) from (
          select location_state, count(*) as listing_count
          from properties where verification_status = 'verified' and status = 'active' and location_state is not null
          group by location_state order by count(*) desc limit 10
        ) g
      )
    )
  );
end;
$$;
