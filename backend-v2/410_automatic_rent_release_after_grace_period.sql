-- The rent-escrow build (migration 396) promised that held rent is
-- released when the grace period passes with no unresolved issue --
-- and the admin screen said "days to auto-release" -- but only the
-- manual and clean-report releases were ever built. Nothing released
-- rent when the deadline passed. Found while writing the Terms.
--
-- Daily job: for every held rent payment whose grace period has ended:
--   * nothing wrong on record  -> release to the landlord
--   * an open fault, or a move-in report that flagged an item
--     -> keep it held and ask an admin to decide (once)

alter table rent_payments add column if not exists hold_flagged_at timestamptz;

create or replace function release_due_rent() returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_released int := 0;
  v_problem boolean;
begin
  for r in
    select rp.id, rp.tenancy_id, rp.amount, rp.hold_flagged_at
    from rent_payments rp
    where rp.released_at is null and rp.release_deadline is not null and rp.release_deadline <= now()
  loop
    v_problem :=
      exists (select 1 from fault_reports f where f.tenancy_id = r.tenancy_id and f.status <> 'resolved')
      or exists (
        select 1 from condition_reports c
        where c.tenancy_id = r.tenancy_id and c.report_type = 'move_in'
          and exists (
            select 1 from jsonb_array_elements(c.rooms) as room, jsonb_array_elements(room->'items') as item
            where item->>'condition' <> 'good'));

    if v_problem then
      if r.hold_flagged_at is null then
        update rent_payments set hold_flagged_at = now() where id = r.id;
        perform notify_admins_by_domain('owner_buyer_tenant', '⚖️ Held rent needs your decision',
          'A tenant''s rent has passed its grace period but an issue is still open on that tenancy (a reported fault, or a flagged item on the move-in report). It has NOT been released automatically. Review it in Escrow Oversight and decide.',
          '/admin?tab=escrowoversight');
      end if;
    else
      perform release_rent_to_landlord_impl(r.id, 'grace_period');
      v_released := v_released + 1;
    end if;
  end loop;
  return v_released;
end $$;

revoke all on function release_due_rent() from public, anon, authenticated;
grant execute on function release_due_rent() to service_role;

select cron.schedule('chs-release-due-rent', '30 6 * * *', $$select release_due_rent()$$);
