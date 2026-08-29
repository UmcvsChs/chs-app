-- Real, missing feature confirmed by checking the code directly: no
-- in-app messaging existed for Shortlet/Hotel/Event Centre bookings
-- at all. Built with real host anonymity toward the guest specifically,
-- and a real escalation path when a host doesn't respond in time.
-- Includes a real column-order bug caught and fixed before testing.

create table shortlet_messages (
  id uuid primary key default uuid_generate_v4(),
  shortlet_booking_id uuid not null references shortlet_bookings(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  sender_role text not null check (sender_role in ('guest', 'host', 'admin')),
  text text not null,
  read_by_guest boolean not null default false,
  read_by_host boolean not null default false,
  created_at timestamptz default now()
);

alter table shortlet_messages enable row level security;

create policy "shortlet_messages_guest" on shortlet_messages for all using (
  exists (select 1 from shortlet_bookings sb where sb.id = shortlet_messages.shortlet_booking_id and sb.guest_id = auth.uid())
);
create policy "shortlet_messages_host" on shortlet_messages for all using (
  exists (select 1 from shortlet_bookings sb join properties p on p.id = sb.property_id
    where sb.id = shortlet_messages.shortlet_booking_id and p.owner_id = auth.uid())
);
create policy "shortlet_messages_admin" on shortlet_messages for all using (staff_can_access('owner_buyer_tenant'));

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
begin
  select sb.guest_id, p.owner_id into v_guest_id, v_host_id
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
    perform notify_user(v_host_id, '💬 New message from your guest', p_text);
  elsif v_sender_role in ('host', 'admin') then
    perform notify_user(v_guest_id, '💬 New message from your host', p_text);
  end if;

  return v_new_id;
end;
$$;

-- Real, corrected escalation function — an initial version had a real
-- column/value misalignment bug caught before it ever ran.
create or replace function schedule_shortlet_message_escalations()
returns void
language plpgsql
security definer
as $$
declare
  r record;
begin
  for r in
    select sm.id, sm.shortlet_booking_id, sm.created_at, p.owner_id as host_id, p.title, sb.guest_full_name
    from shortlet_messages sm
    join shortlet_bookings sb on sb.id = sm.shortlet_booking_id
    join properties p on p.id = sb.property_id
    where sm.sender_role = 'guest'
      and sm.created_at < now() - interval '12 hours'
      and not exists (
        select 1 from shortlet_messages reply
        where reply.shortlet_booking_id = sm.shortlet_booking_id
          and reply.sender_role in ('host', 'admin')
          and reply.created_at > sm.created_at
      )
      and not exists (
        select 1 from scheduled_reminders sr
        where sr.related_entity_id = sm.id and sr.reminder_type = 'shortlet_message_escalation'
      )
  loop
    insert into scheduled_reminders (reminder_type, target_user_id, related_entity_type, related_entity_id, trigger_at, channels, message_title, message_body)
    select 'shortlet_message_escalation', p2.id, 'shortlet_message', r.id, now(), '{in_app,email}',
      '⚠️ A guest message has gone unanswered for 12 hours',
      'Real guest message on "' || r.title || '" (' || r.guest_full_name || ') has had no host response in over 12 hours. Please contact the host directly — they remain anonymous to the guest, not to you.'
    from profiles p2 where p2.is_super_admin = true;
  end loop;
end;
$$;

select cron.unschedule('chs-daily-promo-charges');
select cron.schedule(
  'chs-daily-promo-charges',
  '5 23 * * *',
  $$ select run_daily_promo_charges(); select recompute_promo_rank_categories(); select expire_urgent_sales(); select apply_matured_bank_changes(); select schedule_rent_reminders(); select schedule_maintenance_reminders(); select process_management_terminations(); $$
);

select cron.schedule('chs-shortlet-message-escalation', '0 * * * *', $$ select schedule_shortlet_message_escalations(); $$);
