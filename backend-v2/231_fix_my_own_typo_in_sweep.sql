create or replace function approve_rent_to_own_request(p_agreement_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_seller_id uuid;
  v_buyer_id uuid;
  v_monthly numeric;
  v_property_id uuid;
begin
  select seller_id, buyer_id, monthly_amount, property_id into v_seller_id, v_buyer_id, v_monthly, v_property_id from rent_to_own_agreements where id = p_agreement_id;

  if v_seller_id != auth.uid() and not is_admin() then
    raise exception 'Only the real property owner can approve this request.';
  end if;

  update rent_to_own_agreements set status = 'active', started_at = now() where id = p_agreement_id and status = 'requested';

  perform notify_user(v_buyer_id, '✓ Rent-to-Own agreement approved!',
    'Your agreement is now active — real monthly payments of ' || v_monthly || ' begin now.',
    '/property/' || v_property_id);
end;
$$;
