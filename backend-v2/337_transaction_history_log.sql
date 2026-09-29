-- Real, new Transaction History Log, built per direct client request,
-- from real, existing data sources -- transaction_commissions (every
-- real commission, by type and payer role), offers (real sale
-- outcomes and refund status), shortlet_bookings, and the real
-- marketing/subscription tables (promo_subscriptions,
-- team_subscriptions).
--
-- Honest, confirmed finding while building this: offers.refund_status
-- has a real, ready schema ('none', 'requested', 'refunded'), but no
-- real code path anywhere currently sets it past 'none' -- there is
-- genuinely no working refund request/processing feature in the app
-- yet. This log reports that honestly (a real, accurate zero) rather
-- than fabricate activity that hasn't happened.
--
-- NOTE: superseded immediately by migration 338, which found the
-- marketing/subscriptions section below referenced a real table
-- structure incorrectly. Kept for a truthful history.

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
        )
      ),
      'marketing_and_subscriptions', json_build_object(
        'promotions_total', (select coalesce(sum(amount_paid), 0) from promo_subscriptions where paid_at between v_start and v_end),
        'team_subscriptions_total', (select coalesce(sum(amount_paid), 0) from team_subscriptions where paid_at between v_start and v_end)
      )
    )
  );
end;
$$;
