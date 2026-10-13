-- 491 GUEST HOME: one call for the numbers and the bills (Oct 13 2026)
create or replace function public.get_guest_home() returns json
language plpgsql stable security definer set search_path to 'public' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'You must be signed in.'; end if;
  return json_build_object(
    'balance', coalesce((select main_balance from wallets where user_id = u), 0),
    'awaiting_host', (select count(*) from shortlet_bookings where guest_id = u and status in ('awaiting_admin_relay', 'pending_host_review')),
    'to_pay', (select count(*) from shortlet_bookings where guest_id = u and status = 'awaiting_payment'),
    'confirmed_upcoming', (select count(*) from shortlet_bookings where guest_id = u and status = 'confirmed' and check_out >= current_date),
    'bills_open', (select count(*) from event_quotes q join shortlet_bookings b on b.id = q.booking_id where b.guest_id = u and (q.status = 'sent' or (q.status = 'accepted' and exists (select 1 from event_quote_milestones m where m.quote_id = q.id and m.paid_at is null)))),
    'topups_due', (select count(*) from booking_change_requests r join shortlet_bookings b on b.id = r.booking_id where b.guest_id = u and r.status = 'awaiting_topup'),
    'changes_pending', (select count(*) from booking_change_requests r join shortlet_bookings b on b.id = r.booking_id where b.guest_id = u and r.status = 'pending'),
    'saved', (select count(*) from saved_properties where user_id = u),
    'next_stay', (select json_build_object('id', b.id, 'title', p.title, 'check_in', b.check_in, 'check_out', b.check_out, 'status', b.status)
      from shortlet_bookings b join properties p on p.id = b.property_id
      where b.guest_id = u and b.status in ('confirmed', 'awaiting_payment') and b.check_out >= current_date order by b.check_in limit 1)
  );
end $$;

create or replace function public.get_my_bills() returns json
language plpgsql stable security definer set search_path to 'public' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'You must be signed in.'; end if;
  return coalesce((select json_agg(x order by x.created_at desc) from (
    select q.id as quote_id, q.booking_id, p.title, b.check_in, q.status, q.total, q.valid_until, q.created_at,
      coalesce((select sum(m.amount) from event_quote_milestones m where m.quote_id = q.id and m.paid_at is not null), 0) as paid,
      (select json_build_object('id', m.id, 'label', m.label, 'amount', m.amount, 'due_date', m.due_date) from event_quote_milestones m where m.quote_id = q.id and m.paid_at is null order by m.sort_order, m.due_date limit 1) as next_due
    from event_quotes q join shortlet_bookings b on b.id = q.booking_id join properties p on p.id = b.property_id
    where b.guest_id = u and q.status in ('sent', 'accepted', 'declined', 'expired')) x), '[]'::json);
end $$;

grant execute on function public.get_guest_home(), public.get_my_bills() to authenticated;
