-- Real, systemic gap found through direct client testing: multiple
-- real messaging systems across the platform (sale negotiation,
-- owner-admin correspondence, shortlet guest/host messaging) sent
-- real notifications with no link at all. Clicking one simply marked
-- it read and went nowhere — the recipient had no way to actually
-- reach the conversation. Fixed across all three, not just the one
-- the client happened to notice.

create or replace function approve_precommit_message(p_message_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_recipient_id uuid;
  v_text text;
  v_sender_role text;
  v_property_id uuid;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can approve a real negotiation message.';
  end if;

  select recipient_id, text, sender_role into v_recipient_id, v_text, v_sender_role from precommit_messages where id = p_message_id;
  select property_id into v_property_id from offers where id = (select offer_id from precommit_messages where id = p_message_id);

  update precommit_messages set status = 'approved', reviewed_by = auth.uid() where id = p_message_id;

  perform notify_user(v_recipient_id, '💬 New message from the ' || (case when v_sender_role = 'seller' then 'seller' else 'buyer' end), v_text, '/property/' || v_property_id);
end;
$$;

create or replace function send_owner_admin_message(p_owner_id uuid, p_text text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_sender_role text;
  v_new_id uuid;
begin
  if auth.uid() = p_owner_id then
    v_sender_role := 'owner';
  elsif is_admin() then
    v_sender_role := 'admin';
  else
    raise exception 'You are not part of this conversation.';
  end if;

  insert into owner_admin_messages (owner_id, sender_role, sender_id, text)
  values (p_owner_id, v_sender_role, auth.uid(), p_text)
  returning id into v_new_id;

  if v_sender_role = 'owner' then
    insert into notifications (user_id, title, body, link)
    select id, '💬 New message from an owner', p_text, '/admin' from profiles where is_super_admin = true;
  else
    perform notify_user(p_owner_id, '💬 New message from CHS', p_text, '/owner');
  end if;

  return v_new_id;
end;
$$;

create or replace function send_shortlet_message(p_booking_id uuid, p_text text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_guest_id uuid;
  v_host_id uuid;
  v_sender_role text;
  v_new_id uuid;
  v_property_id uuid;
begin
  select sb.guest_id, p.owner_id, p.id into v_guest_id, v_host_id, v_property_id
    from shortlet_bookings sb join properties p on p.id = sb.property_id
    where sb.id = p_booking_id;

  if auth.uid() = v_guest_id then
    v_sender_role := 'guest';
  elsif auth.uid() = v_host_id then
    v_sender_role := 'host';
  elsif is_admin() then
    v_sender_role := 'admin';
  else
    raise exception 'You are not part of this booking.';
  end if;

  insert into shortlet_messages (shortlet_booking_id, sender_id, sender_role, text, read_by_guest, read_by_host)
  values (p_booking_id, auth.uid(), v_sender_role, p_text, v_sender_role = 'guest', v_sender_role in ('host', 'admin'))
  returning id into v_new_id;

  if v_sender_role = 'guest' then
    perform notify_user(v_host_id, '💬 New message from your guest', p_text, '/owner');
  elsif v_sender_role in ('host', 'admin') then
    perform notify_user(v_guest_id, '💬 New message from your host', p_text, '/my-bookings');
  end if;

  return v_new_id;
end;
$$;
