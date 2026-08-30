-- Real, strategic requirement per direct client instruction: before a
-- buyer has committed real funds, any real message between an owner
-- and that buyer must be reviewed and approved by CHS before
-- delivery — a real deterrent against taking a deal off-platform.
-- Messages containing a phone number or email address are
-- automatically flagged and blocked outright, with the sender
-- immediately told why. Once a buyer has genuinely paid, this
-- restriction lifts — matching the already-proven principle that a
-- tenant who already occupies a property can message their landlord
-- freely.

create table precommit_messages (
  id uuid primary key default uuid_generate_v4(),
  offer_id uuid not null references offers(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  sender_role text not null check (sender_role in ('buyer', 'seller')),
  recipient_id uuid not null references profiles(id),
  text text not null,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'blocked')),
  block_reason text,
  reviewed_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table precommit_messages enable row level security;
create policy "precommit_sender_read" on precommit_messages for select using (auth.uid() = sender_id);
create policy "precommit_recipient_read_approved" on precommit_messages for select using (auth.uid() = recipient_id and status = 'approved');
create policy "precommit_admin_all" on precommit_messages for all using (staff_can_access('owner_buyer_tenant'));

create or replace function detect_offplatform_contact(p_text text)
returns text
language plpgsql
immutable
as $$
declare
  v_digits_only text;
begin
  if p_text ~* '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' then
    return 'This message appears to contain an email address.';
  end if;

  v_digits_only := regexp_replace(p_text, '[^0-9]', '', 'g');
  if length(v_digits_only) >= 7 then
    return 'This message appears to contain a phone number.';
  end if;

  return null;
end;
$$;

create or replace function send_precommit_message(p_offer_id uuid, p_text text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_payment_status text;
  v_sender_role text;
  v_recipient_id uuid;
  v_block_reason text;
  v_new_id uuid;
begin
  select o.buyer_id, o.payment_status, p.owner_id
    into v_buyer_id, v_payment_status, v_seller_id
    from offers o join properties p on p.id = o.property_id
    where o.id = p_offer_id;

  if v_payment_status = 'paid' then
    raise exception 'This deal has already been paid for — real messaging is now unrestricted between the two parties directly.';
  end if;

  if auth.uid() = v_buyer_id then
    v_sender_role := 'buyer';
    v_recipient_id := v_seller_id;
  elsif auth.uid() = v_seller_id then
    v_sender_role := 'seller';
    v_recipient_id := v_buyer_id;
  else
    raise exception 'You are not part of this negotiation.';
  end if;

  v_block_reason := detect_offplatform_contact(p_text);

  insert into precommit_messages (offer_id, sender_id, sender_role, recipient_id, text, status, block_reason)
  values (p_offer_id, auth.uid(), v_sender_role, v_recipient_id, p_text,
    case when v_block_reason is not null then 'blocked' else 'pending_review' end, v_block_reason)
  returning id into v_new_id;

  if v_block_reason is not null then
    perform notify_user(auth.uid(), '🚫 Message could not be delivered',
      v_block_reason || ' For your protection and the buyer''s, all negotiation must stay on CHS until final payment is made. Please rephrase without direct contact details.');
  else
    insert into notifications (user_id, title, body)
    select id, '📋 A real negotiation message needs your review', p_text
    from profiles where is_super_admin = true;
  end if;

  return v_new_id;
end;
$$;

create or replace function approve_precommit_message(p_message_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_recipient_id uuid;
  v_text text;
  v_sender_role text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can approve a real negotiation message.';
  end if;

  select recipient_id, text, sender_role into v_recipient_id, v_text, v_sender_role from precommit_messages where id = p_message_id;

  update precommit_messages set status = 'approved', reviewed_by = auth.uid() where id = p_message_id;

  perform notify_user(v_recipient_id, '💬 New message from the ' || (case when v_sender_role = 'seller' then 'seller' else 'buyer' end), v_text);
end;
$$;

create or replace function reject_precommit_message(p_message_id uuid, p_reason text)
returns void
language plpgsql
security definer
as $$
declare
  v_sender_id uuid;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can reject a real negotiation message.';
  end if;

  select sender_id into v_sender_id from precommit_messages where id = p_message_id;
  update precommit_messages set status = 'blocked', block_reason = p_reason, reviewed_by = auth.uid() where id = p_message_id;

  perform notify_user(v_sender_id, '🚫 Your message was not approved', p_reason);
end;
$$;
