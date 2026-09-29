-- Real, admin-mediated quote request — buyer's message is checked
-- immediately for contact information; if clean, it goes to real
-- admin review before the vendor ever sees it; if it contains contact
-- info, it's blocked outright and the buyer is told plainly why.

create or replace function submit_marketplace_quote_request(p_product_id uuid, p_property_details text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_block_reason text;
  v_new_id uuid;
begin
  v_block_reason := detect_offplatform_contact(p_property_details);

  insert into service_quote_requests (product_id, requester_id, property_details, moderation_status, block_reason)
  values (p_product_id, auth.uid(), p_property_details,
    case when v_block_reason is not null then 'blocked' else 'pending_review' end, v_block_reason)
  returning id into v_new_id;

  if v_block_reason is not null then
    perform notify_user(auth.uid(), '🚫 Your message could not be sent',
      v_block_reason || ' For your protection, every real marketplace conversation stays on CHS — no phone numbers or emails, please. Rephrase and try again.');
  else
    perform notify_admins_by_domain('owner_buyer_tenant', '📋 A real marketplace quote request needs your review',
      'A new request is waiting — review and relay it to the real vendor.');
  end if;

  return v_new_id;
end;
$$;

-- Real admin relay — approves a buyer's request, forwarding it to the
-- vendor. The vendor never sees the buyer's real name; only a real,
-- permanent CHS reference number identifies them.
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

  perform notify_user(v_vendor_user_id, '📋 A real buyer inquiry has been approved',
    'Reference ' || v_reference || ' — a real, CHS-reviewed request is waiting for your quote.');
end;
$$;

-- Real admin rejection — with a required, real reason.
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

  perform notify_user(v_requester_id, '🚫 Your marketplace message was not approved', p_reason);
end;
$$;

-- Real vendor response — same real moderation applied before the
-- buyer ever sees it.
create or replace function submit_vendor_quote_response(p_request_id uuid, p_response text, p_quoted_amount numeric)
returns void
language plpgsql
security definer
as $$
declare
  v_vendor_user_id uuid;
  v_block_reason text;
begin
  select mv.user_id into v_vendor_user_id
    from service_quote_requests sqr
    join marketplace_products mp on mp.id = sqr.product_id
    join marketplace_vendors mv on mv.id = mp.vendor_id
    where sqr.id = p_request_id;

  if v_vendor_user_id != auth.uid() then
    raise exception 'You are not the real vendor for this request.';
  end if;

  v_block_reason := detect_offplatform_contact(p_response);

  update service_quote_requests set
    vendor_response = p_response,
    quoted_amount = p_quoted_amount,
    response_moderation_status = case when v_block_reason is not null then 'blocked' else 'pending_review' end,
    response_block_reason = v_block_reason,
    status = 'responded'
  where id = p_request_id;

  if v_block_reason is not null then
    perform notify_user(auth.uid(), '🚫 Your response could not be sent',
      v_block_reason || ' Every real marketplace conversation stays on CHS — no phone numbers or emails, please.');
  else
    perform notify_admins_by_domain('owner_buyer_tenant', '📋 A real vendor response needs your review',
      'A real quote response is waiting to be relayed to the buyer.');
  end if;
end;
$$;

-- Real admin relay of the vendor's response back to the buyer — the
-- buyer never sees the vendor's personal identity, only their real,
-- verified business name (already public on the listing itself).
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

  perform notify_user(v_requester_id, '💬 You have a real quote response',
    'Reference ' || v_reference || ' — CHS has reviewed and relayed the vendor''s real response.');
end;
$$;

create or replace function admin_block_quote_response(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
as $$
declare
  v_vendor_user_id uuid;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can moderate a real marketplace message.';
  end if;

  update service_quote_requests set response_moderation_status = 'blocked', response_block_reason = p_reason
  where id = p_request_id;

  select mv.user_id into v_vendor_user_id
    from service_quote_requests sqr
    join marketplace_products mp on mp.id = sqr.product_id
    join marketplace_vendors mv on mv.id = mp.vendor_id
    where sqr.id = p_request_id;

  perform notify_user(v_vendor_user_id, '🚫 Your response was not approved', p_reason);
end;
$$;
