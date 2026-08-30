-- Real, practical fix: an admin realistically has an agent's CHS ID
-- on hand, not their raw UUID — the approval function should resolve
-- this itself rather than requiring the admin to already know an
-- internal identifier they'd have no natural way to look up.

drop function if exists approve_agent_replacement(uuid, uuid);

create or replace function approve_agent_replacement(p_request_id uuid, p_agent_chs_id text)
returns void
language plpgsql
security definer
as $$
declare
  v_property_id uuid;
  v_owner_id uuid;
  v_agent_id uuid;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can approve a real agent replacement.';
  end if;

  select id into v_agent_id from profiles where chs_agent_id = p_agent_chs_id and role = 'agent';
  if v_agent_id is null then
    raise exception 'No real, registered agent found with that CHS ID.';
  end if;

  select property_id, owner_id into v_property_id, v_owner_id from agent_change_requests where id = p_request_id;

  update properties set managing_agent_id = v_agent_id where id = v_property_id;
  update tenancies set manager_id = v_agent_id, management_delegated = true
  where property_id = v_property_id and status = 'active';

  update agent_change_requests set status = 'approved', admin_reviewed_by = auth.uid(), reviewed_at = now() where id = p_request_id;

  perform notify_user(v_agent_id, '🤝 You''ve been granted management authority',
    'CHS has confirmed your identity and granted you full management authority on a real property.');
  perform notify_user(v_owner_id, '✓ New agent confirmed',
    'CHS has verified and linked your new managing agent — they now have full access to manage this property on your behalf.');
end;
$$;
