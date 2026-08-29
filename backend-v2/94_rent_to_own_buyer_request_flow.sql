-- Real fix found while wiring the frontend: a buyer browsing a real
-- Rent-to-Own listing had no way to actually start anything — the
-- original function only let the owner initiate, for a buyer they'd
-- already specify directly. Adds the real, natural request → approve
-- flow, matching the same pattern already proven for rental
-- applications.

alter table rent_to_own_agreements drop constraint rent_to_own_agreements_status_check;
alter table rent_to_own_agreements add constraint rent_to_own_agreements_status_check
  check (status in ('requested', 'active', 'completed', 'defaulted', 'cancelled', 'declined'));

create or replace function request_rent_to_own(p_property_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_seller_id uuid;
  v_price numeric;
  v_monthly numeric;
  v_portion_pct numeric;
  v_new_id uuid;
begin
  select owner_id, price, rent_to_own_monthly, rent_to_own_portion_pct
    into v_seller_id, v_price, v_monthly, v_portion_pct
    from properties where id = p_property_id and purpose = 'rent_to_own';

  if v_monthly is null or v_price is null then
    raise exception 'This property has no real rent-to-own terms configured.';
  end if;
  if v_seller_id = auth.uid() then
    raise exception 'You cannot request your own property.';
  end if;

  insert into rent_to_own_agreements (property_id, buyer_id, seller_id, total_price, monthly_amount, portion_pct, status)
  values (p_property_id, auth.uid(), v_seller_id, v_price, v_monthly, coalesce(v_portion_pct, 100), 'requested')
  returning id into v_new_id;

  perform notify_user(v_seller_id, '🏠 New Rent-to-Own request',
    'A real buyer wants to start a Rent-to-Own agreement on your property. Review and approve to begin.');

  return v_new_id;
end;
$$;

create or replace function approve_rent_to_own_request(p_agreement_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_seller_id uuid;
  v_buyer_id uuid;
  v_monthly numeric;
begin
  select seller_id, buyer_id, monthly_amount into v_seller_id, v_buyer_id, v_monthly from rent_to_own_agreements where id = p_agreement_id;

  if v_seller_id != auth.uid() and not is_admin() then
    raise exception 'Only the real property owner can approve this request.';
  end if;

  update rent_to_own_agreements set status = 'active', started_at = now() where id = p_agreement_id and status = 'requested';

  perform notify_user(v_buyer_id, '✓ Rent-to-Own agreement approved!',
    'Your agreement is now active — real monthly payments of ' || v_monthly || ' begin now.');
end;
$$;
