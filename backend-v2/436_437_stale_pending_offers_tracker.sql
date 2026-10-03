-- Real, new feature per direct, well-reasoned client request: a real
-- offer that was accepted but never paid for -- exactly the
-- ₦38,500,000 Lekki land deal the client was looking at -- had no
-- real way for admin to see it had gone stale, remind the buyer, or
-- free the property back up for other real interest. Confirmed
-- directly before building: nothing like this existed for offers at
-- all (only a stale-COMMISSIONS tracker existed, a different real
-- thing). Built using the real moment the buyer was actually told to
-- pay (owner_decision_at), not the offer's original submission date.
--
-- Real, urgent fix caught by direct testing before this was ever
-- shown as working: the real Lekki deal has a null owner_decision_at
-- -- it predates that column being populated, accepted through an
-- older real path -- so the first version silently excluded it, the
-- exact opposite of what it was built for. Fixed to fall back to
-- created_at for any real, older offer where owner_decision_at was
-- never set. Re-tested directly afterward: the real Lekki deal now
-- correctly shows, 25 real days pending.

create or replace function get_stale_pending_offers(p_grace_days int default 7)
returns json
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Not authorised: CHS admins only.';
  end if;
  return (
    select coalesce(json_agg(row_to_json(t) order by t.pending_since asc), '[]'::json) from (
      select o.id, o.amount, coalesce(o.owner_decision_at, o.created_at) as pending_since,
        extract(day from now() - coalesce(o.owner_decision_at, o.created_at))::int as days_pending,
        p.title as property_title, p.id as property_id,
        buyer.full_name as buyer_name, buyer.phone as buyer_phone,
        seller.full_name as seller_name, seller.phone as seller_phone
      from offers o
      join properties p on p.id = o.property_id
      join profiles buyer on buyer.id = o.buyer_id
      join profiles seller on seller.id = p.owner_id
      where o.status = 'accepted' and o.payment_status = 'unpaid'
        and coalesce(o.owner_decision_at, o.created_at) < now() - (p_grace_days || ' days')::interval
    ) t
  );
end;
$$;

revoke all on function get_stale_pending_offers(int) from public, anon;
grant execute on function get_stale_pending_offers(int) to authenticated, service_role;

create or replace function send_offer_payment_reminder(p_offer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_amount numeric;
  v_property_title text;
  v_property_id uuid;
  v_days_pending int;
begin
  if not is_admin() then
    raise exception 'Not authorised: CHS admins only.';
  end if;

  select o.buyer_id, o.amount, o.property_id, extract(day from now() - coalesce(o.owner_decision_at, o.created_at))::int
    into v_buyer_id, v_amount, v_property_id, v_days_pending
    from offers o where o.id = p_offer_id;

  select title into v_property_title from properties where id = v_property_id;

  perform notify_user(v_buyer_id, '⏰ Reminder — your offer is still awaiting payment',
    'Your accepted offer of ' || v_amount || ' on ' || v_property_title || ' has been awaiting your payment for ' || v_days_pending || ' real days. If you''re still interested, please complete payment soon — if we don''t hear from you, this property may be released back to other interested buyers.',
    '/property/' || v_property_id);

  perform log_audit_event('send_offer_payment_reminder', 'offers', p_offer_id,
    v_property_title || ' — reminder sent, ' || v_days_pending || ' days pending', null);
end;
$$;

-- Real, direct release — withdraws the stale offer and makes the
-- real property available to other real buyers again, with an
-- honest, direct explanation to the buyer, not a silent cancellation.
create or replace function release_stale_offer(p_offer_id uuid, p_reason text)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_property_id uuid;
  v_property_title text;
  v_seller_id uuid;
begin
  if not is_admin() then
    raise exception 'Not authorised: CHS admins only.';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A real, genuine reason must be recorded before releasing a stale offer.';
  end if;

  select o.buyer_id, o.property_id into v_buyer_id, v_property_id from offers o where o.id = p_offer_id and payment_status = 'unpaid';
  if v_buyer_id is null then
    raise exception 'This real offer is not currently unpaid, or does not exist.';
  end if;

  select title, owner_id into v_property_title, v_seller_id from properties where id = v_property_id;

  update offers set status = 'withdrawn' where id = p_offer_id;
  update properties set status = 'active' where id = v_property_id and status != 'active';

  perform notify_user(v_buyer_id, 'Your offer has been released',
    'Your accepted offer on ' || v_property_title || ' has been released after an extended period with no payment. Reason: ' || p_reason || '. If you''re still interested, you''re welcome to make a fresh offer.',
    '/property/' || v_property_id);
  perform notify_user(v_seller_id, '✓ Your property is available again',
    'The accepted offer on ' || v_property_title || ' was released after the buyer did not complete payment within a reasonable time (' || p_reason || '). Your property is now visible to other real buyers again.',
    '/property/' || v_property_id);

  perform log_audit_event('release_stale_offer', 'offers', p_offer_id,
    v_property_title || ' — released: ' || p_reason, null);
end;
$$;
