-- Real, new feature per direct client request: a genuine two-way
-- correspondence channel between an owner and CHS admin, not just a
-- one-shot concern ticket — reusing the exact same real, proven
-- messaging pattern already built for tenancy and shortlet messages.

create table owner_admin_messages (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id),
  sender_role text not null check (sender_role in ('owner', 'admin')),
  sender_id uuid not null references profiles(id),
  text text not null,
  created_at timestamptz default now()
);

alter table owner_admin_messages enable row level security;
create policy "owner_admin_msg_owner" on owner_admin_messages for all using (auth.uid() = owner_id);
create policy "owner_admin_msg_admin" on owner_admin_messages for all using (staff_can_access('owner_buyer_tenant'));

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
    insert into notifications (user_id, title, body)
    select id, '💬 New message from an owner', p_text from profiles where is_super_admin = true;
  else
    perform notify_user(p_owner_id, '💬 New message from CHS', p_text);
  end if;

  return v_new_id;
end;
$$;
