-- 499 ADMIN: CATEGORY TAGS ON DEPOSITS / PAYOUT / MESSAGE LISTS, AND A HOTELS & LODGES VIEW (Oct 13 2026)
do $do$
declare f text; v_def text; v_new text;
begin
  foreach f in array array['get_held_shortlet_deposits()', 'get_pending_shortlet_messages()', 'get_shortlet_correspondence_overview()', 'get_shortlet_release_attention()'] loop
    v_def := pg_get_functiondef(('public.' || f)::regprocedure);
    v_new := replace(v_def, 'p.title as property_title', 'p.title as property_title, public._property_cat(p.id) as cat');
    if v_new = v_def then raise exception 'tag patch failed for %', f; end if;
    execute v_new;
  end loop;
end $do$;

create or replace function public.admin_get_hotels() returns json
language plpgsql security definer set search_path to 'public' as $$
declare v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  return coalesce((select json_agg(x order by x.attention desc, x.title) from (
    select p.id, p.title, o.full_name as host_name, o.phone as host_phone,
      (select count(*) from property_units u where u.property_id = p.id and u.active) as rooms,
      p.calendar_confirmed_at,
      case when p.calendar_confirmed_at is null then null else (v_today - (p.calendar_confirmed_at at time zone 'Africa/Lagos')::date) end as days_since_calendar,
      (select count(*) from shortlet_bookings b where b.property_id = p.id and b.status = 'awaiting_admin_relay') as to_relay,
      (select count(*) from shortlet_bookings b where b.property_id = p.id and b.status = 'pending_host_review') as with_host,
      (select count(*) from shortlet_bookings b where b.property_id = p.id and b.status = 'pending_host_review' and b.reply_pending is not null) as replies_to_release,
      (select count(*) from shortlet_bookings b where b.property_id = p.id and b.status = 'awaiting_payment') as guest_to_pay,
      (select count(*) from shortlet_bookings b where b.property_id = p.id and b.status = 'confirmed' and b.check_in = v_today) as arriving_today,
      (select count(*) from shortlet_bookings b where b.property_id = p.id and b.status = 'confirmed' and b.check_in <= v_today and b.check_out > v_today) as in_house,
      (select count(*) from shortlet_bookings b where b.property_id = p.id and b.status = 'confirmed' and b.check_in > v_today and b.check_in <= v_today + 7) as arriving_7d,
      (select count(*) from shortlet_bookings b where b.property_id = p.id and b.status = 'confirmed' and b.payment_status = 'held_escrow') as payouts_held,
      coalesce((select sum(b.total_price) from shortlet_bookings b where b.property_id = p.id and b.status = 'confirmed' and b.payment_status = 'held_escrow'), 0) as amount_held,
      (select count(*) from shortlet_bookings b where b.property_id = p.id and b.status in ('awaiting_admin_relay', 'pending_host_review', 'awaiting_payment')
         and coalesce(b.booking_lane, 'standard') in ('express', 'soon')) as urgent,
      ((select count(*) from shortlet_bookings b where b.property_id = p.id and b.status = 'awaiting_admin_relay')
        + (select count(*) from shortlet_bookings b where b.property_id = p.id and b.status = 'pending_host_review' and b.reply_pending is not null)
        + case when p.calendar_confirmed_at is null or p.calendar_confirmed_at < now() - interval '3 days' then 1 else 0 end) as attention
    from properties p join profiles o on o.id = p.owner_id
    where public._property_cat(p.id) = 'hotel') x), '[]'::json);
end $$;
revoke execute on function public.admin_get_hotels() from public, anon;
grant execute on function public.admin_get_hotels() to authenticated;
