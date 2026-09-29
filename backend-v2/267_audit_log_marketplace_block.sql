create or replace function admin_block_quote_request(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
as $$
declare
  v_requester_id uuid;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can moderate a real marketplace message.';
  end if;

  update service_quote_requests set moderation_status = 'blocked', block_reason = p_reason
  where id = p_request_id
  returning requester_id into v_requester_id;

  perform log_audit_event('block_marketplace_quote_request', 'service_quote_requests', p_request_id, p_reason, null);

  perform notify_user(v_requester_id, '🚫 Your marketplace message was not approved', p_reason);
end;
$$;
