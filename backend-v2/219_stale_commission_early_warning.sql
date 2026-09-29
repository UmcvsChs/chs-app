-- Real, concrete safeguard per direct client request to prevent this
-- exact regression from recurring silently: a real, visible admin
-- alert for any commission that was invoiced but genuinely never
-- collected within a reasonable window. If a bug like the one just
-- found and fixed (a real payment charging the base amount but
-- silently skipping its own commission) ever happens again, real
-- money would start piling up here immediately, visible to admin,
-- instead of staying invisible for days.

create or replace function get_stale_uncollected_commissions()
returns json
language sql
security definer
stable
as $$
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
    select tc.id, tc.transaction_type, tc.payer_role, tc.commission_amount,
      tc.base_amount, tc.created_at, p.full_name as payer_name, p.phone as payer_phone
    from transaction_commissions tc
    join profiles p on p.id = tc.payer_id
    where tc.status = 'pending' and tc.created_at < now() - interval '2 hours'
    order by tc.created_at asc
    limit 100
  ) t;
$$;
