-- Real, direct fix per a direct, repeated client complaint: Platform
-- Earnings under Transaction History has never actually shown
-- individual dated entries -- the original build (337/338) only ever
-- returned rolled-up totals (by role, by type), with no real list of
-- WHEN each commission was actually collected. Confirmed directly:
-- there was genuinely nothing to regress from -- this is the honest
-- first time real itemized entries are added, not a re-fix of
-- something that broke.
--
-- Also adds real, direct visibility into commissions that have been
-- INVOICED but not yet actually paid -- the exact question behind
-- the client's Kakuri warehouse report: the real notification was
-- sent correctly at approval, with a correct link, but the landlord
-- (a test account) simply had not yet clicked to pay it. Confirmed
-- directly against the real data. This section makes that state
-- visible to admin directly, rather than requiring a manual database
-- check to explain.

create or replace function get_transaction_history_log(p_start timestamptz default null, p_end timestamptz default null)
returns json
language plpgsql
security definer
as $$
declare
  v_start timestamptz := coalesce(p_start, '2000-01-01'::timestamptz);
  v_end timestamptz := coalesce(p_end, now());
begin
  if not is_admin() then
    raise exception 'Only CHS staff can view the real transaction history log.';
  end if;

  return (
    select json_build_object(
      'processed_count', (
        select count(*) from transaction_commissions
        where status = 'paid' and paid_at between v_start and v_end
      ),
      'successful', json_build_object(
        'count', (select count(*) from offers where status = 'accepted' and payment_status = 'paid' and created_at between v_start and v_end),
        'total_value', (select coalesce(sum(amount), 0) from offers where status = 'accepted' and payment_status = 'paid' and created_at between v_start and v_end)
      ),
      'refunded', json_build_object(
        'count', (select count(*) from offers where refund_status = 'refunded' and created_at between v_start and v_end),
        'total_value', (select coalesce(sum(amount), 0) from offers where refund_status = 'refunded' and created_at between v_start and v_end)
      ),
      'in_escrow', json_build_object(
        'count', (select count(*) from offers where payment_status = 'paid' and legal_transfer_confirmed = false),
        'total_value', (select coalesce(sum(amount), 0) from offers where payment_status = 'paid' and legal_transfer_confirmed = false)
      ),
      'platform_earnings', json_build_object(
        'total', (select coalesce(sum(commission_amount), 0) from transaction_commissions where status = 'paid' and paid_at between v_start and v_end),
        'by_payer_role', (
          select coalesce(json_object_agg(payer_role, role_total), '{}'::json) from (
            select payer_role, sum(commission_amount) as role_total
            from transaction_commissions where status = 'paid' and paid_at between v_start and v_end
            group by payer_role
          ) x
        ),
        'by_transaction_type', (
          select coalesce(json_object_agg(transaction_type, type_total), '{}'::json) from (
            select transaction_type, sum(commission_amount) as type_total
            from transaction_commissions where status = 'paid' and paid_at between v_start and v_end
            group by transaction_type
          ) x
        ),
        'items', (
          select coalesce(json_agg(row_to_json(item) order by item.paid_at desc), '[]'::json) from (
            select tc.id, tc.paid_at, tc.transaction_type, tc.payer_role, tc.commission_amount,
              tc.base_amount, tc.commission_percentage, tc.reference,
              payer.full_name as payer_name,
              coalesce(prop.title, prop2.title) as property_title
            from transaction_commissions tc
            join profiles payer on payer.id = tc.payer_id
            left join properties prop on prop.id = tc.property_id
            left join offers o on o.id = tc.offer_id
            left join properties prop2 on prop2.id = o.property_id
            where tc.status = 'paid' and tc.paid_at between v_start and v_end
            order by tc.paid_at desc
            limit 300
          ) item
        ),
        'pending_items', (
          select coalesce(json_agg(row_to_json(item) order by item.created_at desc), '[]'::json) from (
            select tc.id, tc.created_at, tc.transaction_type, tc.payer_role, tc.commission_amount,
              tc.base_amount, tc.commission_percentage,
              payer.full_name as payer_name, payer.phone as payer_phone,
              coalesce(prop.title, prop2.title) as property_title
            from transaction_commissions tc
            join profiles payer on payer.id = tc.payer_id
            left join properties prop on prop.id = tc.property_id
            left join offers o on o.id = tc.offer_id
            left join properties prop2 on prop2.id = o.property_id
            where tc.status = 'pending'
            order by tc.created_at desc
            limit 100
          ) item
        )
      ),
      'marketing_and_subscriptions', json_build_object(
        'promotions_total', (
          select coalesce(sum(pp.monthly_price_naira), 0) from property_promotions p
          join promotion_packages pp on pp.id = p.package_id
          where p.last_charged_date between v_start::date and v_end::date
        ),
        'team_subscriptions_total', (
          select coalesce(sum(amount_paid), 0) from team_subscriptions where created_at between v_start and v_end
        )
      )
    )
  );
end;
$$;
