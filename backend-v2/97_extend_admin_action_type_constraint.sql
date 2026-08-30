-- Real fixes caught by testing the buyer ID verification flow
-- end-to-end: request_admin_action's internal domain mapping, and the
-- separate admin_action_requests check constraint, both needed the
-- new 'review_buyer_id' action type added before it could ever work.

create or replace function request_admin_action(p_action_type text, p_target_id uuid, p_proposed_changes jsonb, p_note text default null)
returns uuid
language plpgsql
security definer
as $$
declare
  v_domain text;
  v_id uuid;
  v_requester_name text;
  v_is_super boolean;
begin
  v_domain := case p_action_type
    when 'verify_property' then 'owner_buyer_tenant'
    when 'clear_sale' then 'owner_buyer_tenant'
    when 'approve_profile' then 'registration_setup'
    when 'review_liveness' then 'registration_setup'
    when 'review_buyer_id' then 'registration_setup'
    when 'verify_artisan' then 'artisan_dev_pm_vendor'
    when 'verify_vendor' then 'artisan_dev_pm_vendor'
    when 'review_developer' then 'artisan_dev_pm_vendor'
    when 'freeze_wallet' then 'finance'
    when 'mark_referral_paid' then 'agent_relations'
  end;

  select is_super_admin into v_is_super from profiles where id = auth.uid();

  if not coalesce(v_is_super, false) then
    if not exists (select 1 from profiles where id = auth.uid() and staff_role = v_domain) then
      raise exception 'This action is outside your assigned admin role.';
    end if;
  end if;

  if coalesce(v_is_super, false) then
    v_id := uuid_generate_v4();
    insert into admin_action_requests (id, requested_by, domain, action_type, target_id, proposed_changes, note, status, resolved_at, resolved_by)
    values (v_id, auth.uid(), v_domain, p_action_type, p_target_id, p_proposed_changes, p_note, 'approved', now(), auth.uid());
    perform apply_admin_action(v_id);
    return v_id;
  end if;

  select full_name into v_requester_name from profiles where id = auth.uid();

  insert into admin_action_requests (requested_by, domain, action_type, target_id, proposed_changes, note)
  values (auth.uid(), v_domain, p_action_type, p_target_id, p_proposed_changes, p_note)
  returning id into v_id;

  insert into notifications (user_id, title, body)
  select id, '⚠️ Approval needed: ' || p_action_type,
    v_requester_name || ' is requesting ' || p_action_type || ' — review before it takes effect.'
  from profiles where is_super_admin = true;

  return v_id;
end;
$$;

alter table admin_action_requests drop constraint admin_action_requests_action_type_check;
alter table admin_action_requests add constraint admin_action_requests_action_type_check
  check (action_type = ANY (ARRAY['verify_property', 'approve_profile', 'verify_artisan', 'verify_vendor', 'review_developer', 'clear_sale', 'freeze_wallet', 'review_liveness', 'mark_referral_paid', 'review_buyer_id']));
