create or replace function admin_relay_quote_request(p_request_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_vendor_user_id uuid;
  v_reference text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can relay a real marketplace message.';
  end if;

  update service_quote_requests set moderation_status = 'approved' where id = p_request_id
  returning reference_number into v_reference;

  select mv.user_id into v_vendor_user_id
    from service_quote_requests sqr
    join marketplace_products mp on mp.id = sqr.product_id
    join marketplace_vendors mv on mv.id = mp.vendor_id
    where sqr.id = p_request_id;

  perform log_audit_event('relay_marketplace_quote_request', 'service_quote_requests', p_request_id, v_reference, null);

  perform notify_user(v_vendor_user_id, '📋 A real buyer inquiry has been approved',
    'Reference ' || v_reference || ' — a real, CHS-reviewed request is waiting for your quote.');
end;
$$;

create or replace function admin_relay_quote_response(p_request_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_requester_id uuid;
  v_reference text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can relay a real marketplace message.';
  end if;

  update service_quote_requests set response_moderation_status = 'approved' where id = p_request_id
  returning requester_id, reference_number into v_requester_id, v_reference;

  perform log_audit_event('relay_marketplace_quote_response', 'service_quote_requests', p_request_id, v_reference, null);

  perform notify_user(v_requester_id, '💬 You have a real quote response',
    'Reference ' || v_reference || ' — CHS has reviewed and relayed the vendor''s real response.');
end;
$$;
