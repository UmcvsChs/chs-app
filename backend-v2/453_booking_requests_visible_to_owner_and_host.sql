-- ============================================================================
-- 453 — FIX: a paid hotel / venue booking request was invisible to its owner
-- ============================================================================
-- Reported: Philips Edward paid for a hotel room. Admin could see it; the owner
-- (08120000002) received the notification, but tapping it landed on the owner's
-- dashboard, where the request appeared nowhere (not under Recent Applications,
-- Recent Property Quotation or Transaction History). Reproduced across three
-- browsers by the client; reproduced here against the live system as the owner.
--
-- ROOT CAUSES (each confirmed before fixing):
--  1. The owner dashboard loaded shortlet/venue bookings with
--     status IN ('confirmed','active') — it deliberately EXCLUDED
--     'pending_host_review', the exact state of a paid, unanswered request.
--     The notification said "review and accept or decline" and linked to a page
--     that could not show the request. Accept/Decline existed only on /host,
--     which an owner has no reason to open. (Through the real web API as the
--     owner: the owner-dashboard query returned only the confirmed booking; the
--     host-dashboard query returned the pending request as well.)
--  2. Every booking-request notification linked to /owner. /owner redirects
--     anyone without the owner role to the home page, so a pure HOST account
--     tapping it would land on the homepage with nothing there.
--  3. A guest cancelling a booking notified neither the host nor admin.
--  4. (front end) The property name was read as a list element
--     (properties?.[0]?.title) although the server returns a single object, so
--     the name fell back to the generic word "Property" and the location came
--     out blank in 24 places — including Recent Applications, Recent Property
--     Quotation, My Applications and the guest's own My Bookings. Fixed with a
--     shared helper, lib/embedded.ts.
--
-- WHAT THIS MIGRATION DOES
--   booking_request_link(user)   '/owner' for anyone with the owner role,
--                                '/host' for a pure host.
--   get_my_booking_requests()    the signed-in owner's / host's paid requests that
--                                are still waiting: hotel, guest, dates, what they
--                                would receive, room, 24h deadline, event extras.
--                                Settles anything already expired first.
--   Notification links           request_shortlet_booking, request_event_booking
--                                and system_decline_booking now use
--                                booking_request_link() instead of a fixed '/owner'.
--                                Done as a CHECKED TEXT REPLACEMENT on each function's
--                                stored definition (the migration aborts if a
--                                replacement does not apply), so no money logic was
--                                retyped.
--   cancel_shortlet_booking      now tells the host and admin when a guest cancels,
--                                with the refund and the amount retained. Same checked
--                                replacement; refund maths untouched.
--   Existing notifications       already-sent booking-request notifications are given a
--                                working link, including ones that had none at all.
--
-- The front end shows these requests in a red panel at the very top of BOTH the
-- Owner and Host dashboards (components/PendingBookingRequests.tsx).
--
-- VERIFIED (all database tests rolled back): the owner sees Philips Edward's request
-- (with its 24h deadline) both directly and through the real web API; a different hotel
-- owner, an ordinary user and a signed-out visitor see none; a new request notifies the
-- owner with '/owner' and a pure host with '/host'; the expiry notice links correctly;
-- a guest cancelling 48h+ ahead is refunded exactly and the host and admin are told;
-- there is one version of each function and no leftover hard-coded link.
-- ============================================================================

create or replace function booking_request_link(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when exists (
    select 1 from profiles where id = p_user and (role = 'owner' or 'owner' = any(coalesce(secondary_roles, '{}')))
  ) then '/owner' else '/host' end;
$$;
revoke all on function booking_request_link(uuid) from public, anon;
grant execute on function booking_request_link(uuid) to authenticated, service_role;

create or replace function get_my_booking_requests()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;

  -- Settle anything already past its 24h deadline first, so the host is never
  -- shown a request that has in fact expired and been refunded.
  for r in select id from properties where owner_id = auth.uid() and purpose in ('shortlet', 'hire') loop
    perform purge_expired_holds(r.id);
  end loop;

  return (
    select coalesce(json_agg(row_to_json(t) order by t.expires_at nulls last, t.created_at), '[]'::json) from (
      select b.id, b.property_id, p.title as property_title,
        b.guest_full_name, b.guest_phone, coalesce(b.guest_verified, false) as guest_verified,
        b.check_in, b.check_out, (b.check_out - b.check_in) as nights, b.guests,
        b.total_price, b.guest_commission_amount, b.host_commission_amount,
        (b.total_price - b.host_commission_amount) as net_if_accepted,
        b.created_at,
        (select max(c.expires_at) from unit_calendar c where c.booking_id = b.id and c.state = 'held') as expires_at,
        u.label as room_label, rt.name as room_type_name,
        b.wants_music_band, b.wants_caterer, b.wants_ushers, b.number_of_ushers, b.additional_event_requests,
        b.event_type, b.selected_tier_label, b.facilities_total
      from shortlet_bookings b
      join properties p on p.id = b.property_id
      left join property_units u on u.id = b.unit_id
      left join room_types rt on rt.id = b.room_type_id
      where p.owner_id = auth.uid() and b.status = 'pending_host_review'
    ) t
  );
end;
$$;
revoke all on function get_my_booking_requests() from public, anon;
grant execute on function get_my_booking_requests() to authenticated, service_role;

-- Re-point the notification links by a checked text replacement on each function's
-- stored definition (aborts if a replacement does not apply).
do $$
declare v_def text; v_new text; v_oid oid;
begin
  select oid into v_oid from pg_proc where pronamespace = 'public'::regnamespace and proname = 'request_shortlet_booking';
  v_def := pg_get_functiondef(v_oid);
  v_new := replace(v_def,
    E'    ''/owner'');\n  perform notify_admins_by_domain(''owner_buyer_tenant'', ''📋 Real new shortlet/hire booking request''',
    E'    booking_request_link(v_host_id));\n  perform notify_admins_by_domain(''owner_buyer_tenant'', ''📋 Real new shortlet/hire booking request''');
  if v_new = v_def then raise exception 'patch did not apply: request_shortlet_booking'; end if;
  execute v_new;

  select oid into v_oid from pg_proc where pronamespace = 'public'::regnamespace and proname = 'request_event_booking';
  v_def := pg_get_functiondef(v_oid);
  v_new := replace(v_def,
    E'    ''/owner'');\n  perform notify_admins_by_domain(''owner_buyer_tenant'', ''📋 Real new event booking request''',
    E'    booking_request_link(v_host_id));\n  perform notify_admins_by_domain(''owner_buyer_tenant'', ''📋 Real new event booking request''');
  if v_new = v_def then raise exception 'patch did not apply: request_event_booking'; end if;
  execute v_new;

  select oid into v_oid from pg_proc where pronamespace = 'public'::regnamespace and proname = 'system_decline_booking';
  v_def := pg_get_functiondef(v_oid);
  v_new := replace(v_def,
    E'      ''/owner'');\n    perform notify_admins_by_domain(''owner_buyer_tenant'', ''⏱ Booking request expired unanswered''',
    E'      booking_request_link(v_host));\n    perform notify_admins_by_domain(''owner_buyer_tenant'', ''⏱ Booking request expired unanswered''');
  if v_new = v_def then raise exception 'patch did not apply: system_decline_booking'; end if;
  execute v_new;

  select oid into v_oid from pg_proc where pronamespace = 'public'::regnamespace and proname = 'cancel_shortlet_booking';
  v_def := pg_get_functiondef(v_oid);
  v_new := replace(v_def,
    E'  return json_build_object(''refund_pct'', v_refund_pct, ''refund_amount'', v_refund_amount);',
    E'  perform notify_user((select owner_id from properties where id = v_property_id), ''❌ A guest cancelled a booking'',
    coalesce((select full_name from profiles where id = v_guest_id), ''A guest'') || '' cancelled their '' ||
    case when v_status = ''pending_host_review'' then ''request'' else ''confirmed booking'' end || '' for '' || v_property_title ||
    '' (check-in '' || v_check_in || ''). Refund to the guest: '' || v_refund_amount || '' ('' || v_refund_pct || ''% of the stay, plus any deposit). The dates are open again on your calendar.'',
    booking_request_link((select owner_id from properties where id = v_property_id)));
  perform notify_admins_by_domain(''owner_buyer_tenant'', ''❌ Guest cancelled a booking'',
    coalesce((select full_name from profiles where id = v_guest_id), ''A guest'') || '' cancelled '' || v_property_title || '' (check-in '' || v_check_in || ''). '' ||
    ''Paid: '' || (v_total_price + v_guest_commission + v_deposit) || ''; refunded: '' || v_refund_amount || ''; retained under the cancellation policy: '' ||
    ((v_total_price + v_guest_commission + v_deposit) - v_refund_amount) || ''.'',
    ''/admin?tab=shortletbookings'');
  return json_build_object(''refund_pct'', v_refund_pct, ''refund_amount'', v_refund_amount);');
  if v_new = v_def then raise exception 'patch did not apply: cancel_shortlet_booking'; end if;
  execute v_new;
end $$;

-- Correct the notifications ALREADY sent.
update notifications n set link = booking_request_link(n.user_id)
where n.link = '/owner'
  and n.title in ('🔔 Real new booking request', '🔔 Real new event booking request', 'A booking request expired');

-- Older ones had no link at all, so tapping them did nothing.
update notifications n set link = booking_request_link(n.user_id)
where n.link is null
  and n.title in ('🔔 Real new booking request', '🔔 Real new event booking request', 'A booking request expired');
