-- Real, direct fix for a genuine gap found while answering a direct
-- client question: a submitted condition report was technically
-- viewable by the owner if they knew to look, but nothing ever
-- actually told them one existed. Now notifies the real, correctly-
-- resolved responsible party too — the manager when delegated, the
-- landlord otherwise — alongside admin, the same real routing
-- principle already used throughout the rest of the app.

create or replace function notify_admins_condition_report(p_report_id uuid, p_report_type text, p_property_title text)
returns void
language plpgsql
security definer
as $$
declare
  v_tenancy_id uuid;
  v_landlord_id uuid;
  v_manager_id uuid;
  v_delegated boolean;
  v_responsible_id uuid;
begin
  insert into notifications (user_id, title, body, link)
  select id,
    case when p_report_type = 'move_out' then '📋 Real move-out condition report' else '📋 Real move-in condition report' end,
    'A real ' || replace(p_report_type, '_', '-') || ' condition report was just submitted for ' || p_property_title || '.',
    '/admin?tab=conditionreports'
  from profiles where is_super_admin = true;

  select tenancy_id into v_tenancy_id from condition_reports where id = p_report_id;
  if v_tenancy_id is not null then
    select landlord_id, manager_id, management_delegated into v_landlord_id, v_manager_id, v_delegated
      from tenancies where id = v_tenancy_id;
    v_responsible_id := case when v_delegated then v_manager_id else v_landlord_id end;
    if v_responsible_id is not null then
      perform notify_user(v_responsible_id,
        case when p_report_type = 'move_out' then '📋 Move-out condition report filed' else '📋 Move-in condition report filed' end,
        'Your tenant just filed a real ' || replace(p_report_type, '_', '-') || ' condition report for ' || p_property_title || '. Review it and address anything that needs fixing.',
        '/owner');
    end if;
  end if;
end;
$$;
