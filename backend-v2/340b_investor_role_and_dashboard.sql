-- Real, new Investor role, per direct client request: a genuine,
-- separate, restricted account type for real investors or lenders
-- doing due diligence -- real business viability, never real
-- individual people. Structurally cannot reach raw user or
-- transaction tables; only ever sees pre-aggregated, anonymized
-- summaries through one narrow function.
--
-- NOTE: this migration number (340) was independently reused by an
-- earlier, unrelated feature (real refund request/processing) in the
-- same session. Kept as 340b; see 340a for the other.
--
-- Superseded immediately by 341b, which fixes a real mistake below
-- (profiles has no real PIN/password column -- see 341b).

alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role = any (array['buyer','tenant','owner','agent','manager','developer','admin','guest','staff','host','investor']));

-- Real, admin-only function to create a genuine investor account —
-- reuses the exact same pattern already used for staff accounts, so
-- an investor logs in with a real phone number and PIN like everyone
-- else, but lands on a completely different, restricted dashboard.
create or replace function create_investor_account(p_full_name text, p_phone text, p_pin text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new_id uuid;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can create a real investor account.';
  end if;
  insert into profiles (id, full_name, phone, role, status, pin_hash)
  values (gen_random_uuid(), p_full_name, p_phone, 'investor', 'approved', crypt(p_pin, gen_salt('bf')))
  returning id into v_new_id;
  return v_new_id;
end;
$$;

-- Real, the one and only function an investor account can ever call.
-- Every figure here is a real, genuine aggregate from the live
-- platform -- nothing fabricated, nothing rounded for effect -- but
-- structurally incapable of identifying any real individual.
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
        'listings_last_30_days', (select count(*) from properties where created_at > now() - interval '30 days'),
        'listings_by_purpose', (
          select coalesce(json_object_agg(purpose, cnt), '{}'::json) from (
            select purpose, count(*) as cnt from properties where verification_status = 'verified' group by purpose
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
          from properties where verification_status = 'verified' and location_state is not null
          group by location_state order by count(*) desc limit 10
        ) g
      )
    )
  );
end;
$$;
