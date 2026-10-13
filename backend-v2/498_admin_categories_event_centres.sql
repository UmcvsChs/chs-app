-- 498 ADMIN: BOOKING CATEGORIES AND AN EVENT CENTRES VIEW (Oct 13 2026)
-- The admin booking queue and host-replies list covered shortlets, hotels and event centres together but never said which
-- was which. Every row now carries its category, and a new Event Centres view lists event bookings with their services,
-- quotation and service money.

create or replace function public._property_cat(p_property uuid) returns text
language sql stable security definer set search_path to 'public' as $$
  select case when p.hire_category = 'event_centre' or p.property_type ilike '%event%' then 'event'
              when p.hire_category = 'hotel_lodge' then 'hotel'
              when p.purpose = 'shortlet' then 'shortlet' else 'other' end
  from properties p where p.id = p_property $$;
revoke execute on function public._property_cat(uuid) from public, anon;
grant execute on function public._property_cat(uuid) to authenticated;

do $do$
declare v_def text; v_new text;
begin
  v_def := pg_get_functiondef('public.get_admin_booking_queue()'::regprocedure);
  v_new := replace(v_def, 'p.title as property_title,', 'p.title as property_title, public._property_cat(p.id) as cat, b.event_type, b.reply_pending,');
  if v_new = v_def then raise exception 'queue patch failed'; end if;
  execute v_new;
  v_def := pg_get_functiondef('public.admin_get_host_replies()'::regprocedure);
  v_new := replace(v_def, 'p.title as property_title, o.full_name as host_name,', 'p.title as property_title, public._property_cat(p.id) as cat, o.full_name as host_name,');
  if v_new = v_def then raise exception 'replies patch failed'; end if;
  execute v_new;
end $do$;

create or replace function public.admin_get_event_centres() returns json
language plpgsql security definer set search_path to 'public' as $$
declare v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  return coalesce((select json_agg(x order by x.check_in) from (
    select b.id, 'REQ-' || substr(b.id::text, 1, 8) as ref, p.title as property_title, o.full_name as host_name, b.guest_full_name as guest_name,
      b.event_type, b.guests, b.selected_tier_label as tier, b.check_in, b.check_out, b.status, b.payment_status, b.time_slots, b.reply_pending,
      (b.total_price + coalesce(b.guest_commission_amount, 0)) as amount, b.hold_expires_at,
      (select count(*) from booking_services s where s.booking_id = b.id and s.status <> 'cancelled') as services_total,
      (select count(*) from booking_services s where s.booking_id = b.id and s.status = 'requested') as services_waiting_host,
      (select count(*) from booking_services s where s.booking_id = b.id and s.status in ('sourcing', 'quoted')) as services_with_chs,
      (select count(*) from booking_services s where s.booking_id = b.id and not s.relayed) as services_to_relay,
      (select count(*) from booking_services s where s.booking_id = b.id and s.status = 'supplied' and coalesce(s.price, 0) > 0 and s.paid_at is null) as services_unpaid,
      (select q.status from event_quotes q where q.booking_id = b.id and q.status in ('sent', 'accepted') order by q.created_at desc limit 1) as quote_status,
      (select q.total from event_quotes q where q.booking_id = b.id and q.status in ('sent', 'accepted') order by q.created_at desc limit 1) as quote_total,
      coalesce((select sum(sp.amount + sp.guest_fee) from service_payments sp where sp.booking_id = b.id and sp.status = 'held'), 0) as service_money_held,
      (select count(*) from booking_change_requests c where c.booking_id = b.id and c.status in ('pending', 'awaiting_topup')) as changes_open
    from shortlet_bookings b join properties p on p.id = b.property_id join profiles o on o.id = p.owner_id
    where public._property_cat(p.id) = 'event'
      and (b.status in ('awaiting_admin_relay', 'pending_host_review', 'awaiting_payment') or (b.status = 'confirmed' and b.check_out >= v_today))) x), '[]'::json);
end $$;
revoke execute on function public.admin_get_event_centres() from public, anon;
grant execute on function public.admin_get_event_centres() to authenticated;
