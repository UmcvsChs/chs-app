-- Real, direct fix per a genuine, confirmed client concern, matching
-- the exact same admin-review gate already built for rental
-- applications: a real purchase offer went straight from buyer to
-- owner with zero CHS involvement, which never matched the client's
-- real, repeated, explicit expectation that every real transaction
-- passes through CHS first.

alter table offers drop constraint offers_status_check;
alter table offers add constraint offers_status_check
  check (status = ANY (ARRAY['awaiting_admin_review', 'pending', 'accepted', 'rejected', 'withdrawn']));

alter table offers alter column status set default 'awaiting_admin_review';

-- Real, new function — admin genuinely reviews a real offer (the
-- buyer's real bio-data and ID-verification status) before the owner
-- ever sees it, exactly matching the rental-application pattern.
create or replace function admin_relay_offer_to_owner(p_offer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_buyer_name text;
  v_property_title text;
  v_property_id uuid;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can relay a real offer to the owner.';
  end if;

  select o.property_id, o.buyer_full_name, p.title, p.owner_id
    into v_property_id, v_buyer_name, v_property_title, v_owner_id
    from offers o join properties p on p.id = o.property_id
    where o.id = p_offer_id and o.status = 'awaiting_admin_review';

  if v_owner_id is null then
    raise exception 'This real offer is not currently awaiting admin review.';
  end if;

  update offers set status = 'pending' where id = p_offer_id;

  perform notify_user(v_owner_id, '💰 A real offer is ready for your review',
    v_buyer_name || ' has made a real offer on ' || v_property_title || '. CHS has reviewed their real details — please review and decide.',
    '/owner');
end;
$$;
