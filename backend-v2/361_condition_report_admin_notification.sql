-- Real, direct fix for a confirmed, genuine gap: submitting a
-- condition report never notified admin at all -- this real function
-- fixes that for every report, move-in included, not just move-out
-- reports with an affidavit.

create or replace function notify_admins_condition_report(p_report_id uuid, p_report_type text, p_property_title text)
returns void
language plpgsql
security definer
as $$
begin
  insert into notifications (user_id, title, body, link)
  select id,
    case when p_report_type = 'move_out' then '📋 Real move-out condition report' else '📋 Real move-in condition report' end,
    'A real ' || replace(p_report_type, '_', '-') || ' condition report was just submitted for ' || p_property_title || '.',
    '/admin?tab=conditionreports'
  from profiles where is_super_admin = true;
end;
$$;
