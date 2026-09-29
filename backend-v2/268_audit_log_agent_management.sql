create or replace function link_managing_agent_by_id(p_property_id uuid, p_chs_agent_id text)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_agent_id uuid;
begin
  select owner_id into v_owner_id from properties where id = p_property_id;
  if v_owner_id != auth.uid() then
    raise exception 'Only the real property owner can link a managing agent.';
  end if;

  select id into v_agent_id from profiles where chs_agent_id = p_chs_agent_id and role = 'agent';
  if v_agent_id is null then
    raise exception 'No real, registered agent found with that CHS ID. Please double-check the ID with your agent.';
  end if;

  update properties set managing_agent_id = v_agent_id where id = p_property_id;

  perform log_audit_event('link_managing_agent', 'properties', p_property_id, 'Agent linked', jsonb_build_object('agent_id', v_agent_id, 'chs_agent_id', p_chs_agent_id));

  perform notify_user(v_agent_id, '🤝 You''ve been granted management authority',
    'A real property owner has named you as the managing agent with full authority for one of their listings.', '/agent');
end;
$$;

create or replace function revoke_managing_agent(p_property_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_old_agent_id uuid;
  v_tenant_id uuid;
begin
  select owner_id, managing_agent_id into v_owner_id, v_old_agent_id from properties where id = p_property_id;

  if v_owner_id != auth.uid() then
    raise exception 'Only the real property owner can revoke a managing agent.';
  end if;
  if v_old_agent_id is null then
    raise exception 'This property has no real managing agent to revoke.';
  end if;

  update tenancies set manager_id = null, management_delegated = false
  where property_id = p_property_id and manager_id = v_old_agent_id;

  update properties set managing_agent_id = null where id = p_property_id;

  perform log_audit_event('revoke_managing_agent', 'properties', p_property_id, 'Agent revoked', jsonb_build_object('former_agent_id', v_old_agent_id));

  perform notify_user(v_old_agent_id, '⚠️ Management authority revoked',
    'The property owner has relieved you of management duty on this property. Your access to its tenant, notices, and maintenance tools has been removed immediately.', '/agent');

  select tenant_id into v_tenant_id from tenancies where property_id = p_property_id and status = 'active' limit 1;
  if v_tenant_id is not null then
    perform notify_user(v_tenant_id, 'ℹ️ A change in property management',
      'Your landlord has changed who manages this property on their behalf. You''ll be notified directly once a new arrangement is confirmed — for now, please reach your landlord through CHS as usual.', '/tenant');
  end if;
end;
$$;

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

  perform log_audit_event('approve_agent_replacement', 'agent_change_requests', p_request_id, 'Approved', jsonb_build_object('property_id', v_property_id, 'new_agent_id', v_agent_id));

  perform notify_user(v_agent_id, '🤝 You''ve been granted management authority',
    'CHS has confirmed your identity and granted you full management authority on a real property.', '/agent');
  perform notify_user(v_owner_id, '✓ New agent confirmed',
    'CHS has verified and linked your new managing agent — they now have full access to manage this property on your behalf.', '/owner');
end;
$$;
