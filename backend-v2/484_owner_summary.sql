-- 484: One-screen summary across all of an owner's properties (what needs doing, money, each property at a glance).
-- Read-only. Counts are for the signed-in owner's own properties only.
create or replace function public.get_owner_summary() returns json
language plpgsql stable security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_props json; v_attention json; v_money json; v_counts json;
begin
  if v_me is null then raise exception 'Please sign in.'; end if;
  select json_build_object(
    'total', count(*),
    'live', count(*) filter (where status = 'active'),
    'rented_or_sold', count(*) filter (where status in ('rented','sold')),
    'awaiting_verification', count(*) filter (where verification_status <> 'verified'),
    'chs_managed', count(*) filter (where chs_service = 'chs_managed'))
  into v_counts from properties where owner_id = v_me;

  select json_build_object(
    'offers', (select count(*) from offers o join properties p on p.id = o.property_id where p.owner_id = v_me and o.status = 'pending'),
    'applications', (select count(*) from rental_applications a join properties p on p.id = a.property_id where p.owner_id = v_me and a.status = 'awaiting_owner_decision'),
    'questions', (select count(*) from media_requests m join properties p on p.id = m.property_id where p.owner_id = v_me and m.status = 'pending')
                 + (select count(*) from video_requests v join properties p on p.id = v.property_id where p.owner_id = v_me and v.status = 'pending'),
    'visits_this_week', (select count(*) from inspections i join properties p on p.id = i.property_id
                         where p.owner_id = v_me and i.status in ('pending','awaiting_payment','confirmed')
                           and inspection_visit_time(i.requested_date, i.requested_time) between now() and now() + interval '7 days'),
    'visits_to_mark', (select count(*) from inspections i join properties p on p.id = i.property_id
                       where p.owner_id = v_me and i.status in ('pending','confirmed') and inspection_visit_time(i.requested_date, i.requested_time) < now()),
    'rent_ending_soon', (select count(*) from tenancies t where t.landlord_id = v_me and t.status = 'active' and t.lease_end <= current_date + 60),
    'notices_received', (select count(*) from tenancies t where t.landlord_id = v_me and t.status = 'notice_given'),
    'overdue_instalments', (select count(*) from tenancy_installments i join tenancies t on t.id = i.tenancy_id
                            where t.landlord_id = v_me and i.status = 'due' and i.due_date < current_date),
    'service_charges_due', (select coalesce(sum(commission_amount), 0) from transaction_commissions c where c.payer_id = v_me and c.payer_role = 'landlord' and c.status = 'pending'))
  into v_attention;

  select json_build_object(
    'wallet', (select coalesce(main_balance, 0) from wallets where user_id = v_me),
    'held_in_escrow', (select coalesce(escrow_held, 0) from wallets where user_id = v_me),
    'rent_awaiting_release', (select coalesce(sum(amount), 0) from rent_payments where landlord_id = v_me and released_at is null and refunded_at is null),
    'rent_released_30d', (select coalesce(sum(amount), 0) from rent_payments where landlord_id = v_me and released_at > now() - interval '30 days'),
    'annual_rent_under_lease', (select coalesce(sum(annual_rent), 0) from tenancies where landlord_id = v_me and status in ('active','notice_given')))
  into v_money;

  select coalesce(json_agg(x order by x.created_at desc), '[]'::json) into v_props from (
    select p.id, p.title, p.status, p.verification_status, p.purpose, p.price, p.chs_service, p.chs_tag, p.created_at,
      (select count(*) from offers o where o.property_id = p.id and o.status = 'pending') as offers,
      (select count(*) from rental_applications a where a.property_id = p.id and a.status = 'awaiting_owner_decision') as applications,
      (select min(inspection_visit_time(i.requested_date, i.requested_time)) from inspections i
         where i.property_id = p.id and i.status in ('pending','awaiting_payment','confirmed') and inspection_visit_time(i.requested_date, i.requested_time) > now()) as next_visit,
      (select t.lease_end from tenancies t where t.property_id = p.id and t.status in ('active','notice_given') order by t.lease_end limit 1) as lease_end
    from properties p where p.owner_id = v_me order by p.created_at desc limit 100) x;

  return json_build_object('properties', v_counts, 'attention', v_attention, 'money', v_money, 'list', v_props);
end $$;
revoke all on function public.get_owner_summary() from public, anon;
grant execute on function public.get_owner_summary() to authenticated;
