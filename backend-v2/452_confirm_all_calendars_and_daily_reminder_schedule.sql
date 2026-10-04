-- ============================================================================
-- 452 — one-tap "all my calendars are accurate" + the daily reminder schedule
-- ============================================================================
-- A host with several listings should not have to tap once per listing every
-- morning. One tap stamps every active shortlet / hire listing they own — the
-- host is attesting that they have recorded today's walk-ins everywhere.
--
-- The reminder job runs daily at 07:00 Nigerian time (06:00 UTC) and notifies
-- each host whose listings are unconfirmed for 24h+, at most once per 20 hours.
-- Its first run notifies the 4 hosts who currently own listings.
-- ============================================================================

create or replace function host_confirm_all_calendars()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  update properties set calendar_confirmed_at = now()
  where owner_id = auth.uid() and purpose in ('shortlet', 'hire') and status = 'active';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function host_confirm_all_calendars() from public, anon;
grant execute on function host_confirm_all_calendars() to authenticated, service_role;

select cron.schedule('chs-confirm-calendar-reminder', '0 6 * * *', $$select remind_hosts_to_confirm_calendar();$$);
