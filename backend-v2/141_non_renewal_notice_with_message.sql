-- Real, new fix per direct client request: giving non-renewal notice
-- was a bare, single-click action with no way to actually say
-- anything — no real reason, no context, nothing. Adds a genuine
-- optional message the tenant can include, sent directly to the
-- landlord (and manager, if any) as part of the same notification.

create or replace function give_non_renewal_notice(p_tenancy_id uuid, p_message text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_landlord_id uuid;
  v_manager_id uuid;
  v_lease_end date;
  v_days_left int;
begin
  select tenant_id, landlord_id, manager_id, lease_end
    into v_tenant_id, v_landlord_id, v_manager_id, v_lease_end
    from tenancies where id = p_tenancy_id;

  if v_tenant_id != auth.uid() then
    raise exception 'Only the real tenant on this tenancy can give notice.';
  end if;

  update tenancies set notice_given_at = now() where id = p_tenancy_id;

  v_days_left := v_lease_end - current_date;

  perform notify_user(v_landlord_id, '📋 Tenant has given non-renewal notice',
    (case when v_days_left >= 90
      then 'Your tenant has notified you they will not be renewing, with ' || v_days_left || ' real days remaining on the lease — within the required 90-day window.'
      else 'Your tenant has notified you they will not be renewing, with only ' || v_days_left || ' real days remaining on the lease — this is later than the requested 90-day notice period.'
    end) || coalesce(E'\n\nTenant''s message: ' || p_message, ''));

  if v_manager_id is not null then
    perform notify_user(v_manager_id, '📋 Tenant has given non-renewal notice',
      ('A tenant on a property you manage has notified they will not be renewing, with ' || v_days_left || ' real days remaining on the lease.') || coalesce(E'\n\nTenant''s message: ' || p_message, ''));
  end if;
end;
$$;
