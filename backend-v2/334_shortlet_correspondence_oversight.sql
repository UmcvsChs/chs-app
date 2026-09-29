-- Real, direct extension of the same correction just made for
-- tenant-landlord correspondence, to shortlet guest-host messaging
-- per direct client instruction. Same real principle: delivery stays
-- direct and frictionless, exactly as before -- this is genuine
-- visibility for CHS, not a new gate. Admin-only check built inside
-- the function itself this time from the start, not added as a
-- second, corrective pass.

create or replace function get_shortlet_correspondence_overview()
returns json
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Only CHS staff can view real shortlet correspondence.';
  end if;

  return (
    select coalesce(json_agg(row_to_json(t) order by t.last_message_at desc), '[]'::json) from (
      select
        sm.shortlet_booking_id as booking_id,
        p.title as property_title,
        guest.full_name as guest_name,
        guest.phone as guest_phone,
        host.full_name as host_name,
        host.phone as host_phone,
        last_msg.text as last_message_text,
        last_msg.sender_role as last_sender_role,
        (last_msg.sender_role = 'guest') as awaiting_host_reply,
        last_msg.created_at as last_message_at,
        (select count(*) from shortlet_messages where shortlet_booking_id = sm.shortlet_booking_id) as message_count
      from (select distinct shortlet_booking_id from shortlet_messages) sm
      join shortlet_bookings sb on sb.id = sm.shortlet_booking_id
      join properties p on p.id = sb.property_id
      join profiles guest on guest.id = sb.guest_id
      join profiles host on host.id = p.owner_id
      join lateral (
        select text, sender_role, created_at from shortlet_messages
        where shortlet_booking_id = sm.shortlet_booking_id order by created_at desc limit 1
      ) last_msg on true
    ) t
  );
end;
$$;
