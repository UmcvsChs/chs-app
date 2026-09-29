-- Real, new function checking whether a just-submitted move-in report
-- is genuinely clean (every real item rated "good", nothing "fair" or
-- "poor") -- if so, the tenant's held rent releases to the landlord
-- immediately, rather than waiting out the full grace period for a
-- property that's already confirmed fine.

create or replace function check_and_release_on_clean_report(p_report_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_tenancy_id uuid;
  v_report_type text;
  v_rooms jsonb;
  v_has_issue boolean := false;
  v_rent_payment_id uuid;
begin
  select tenancy_id, report_type, rooms into v_tenancy_id, v_report_type, v_rooms
    from condition_reports where id = p_report_id;

  if v_report_type != 'move_in' or v_tenancy_id is null then
    return;
  end if;

  select exists(
    select 1 from jsonb_array_elements(v_rooms) as room,
      jsonb_array_elements(room->'items') as item
    where item->>'condition' != 'good'
  ) into v_has_issue;

  if v_has_issue then
    return;
  end if;

  select id into v_rent_payment_id from rent_payments
    where tenancy_id = v_tenancy_id and released_at is null
    order by created_at desc limit 1;

  if v_rent_payment_id is not null then
    perform release_rent_to_landlord(v_rent_payment_id, 'clean_report');
  end if;
end;
$$;
