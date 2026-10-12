-- 479: management fee REPLACES the owner-side platform commission on CHS-managed properties; documents and capacity are
-- required with a request; hotel and commercial management added, with agreed commercial terms recorded at approval.
-- Rent: landlord side was 4% of annual rent; for a CHS-managed rent listing it is now the management fee (10%, no minimum for properties enrolled in the app).
-- Sale: seller side was 6%; for a CHS-managed sale listing it is now the tiered sale-negotiation fee. Tenant and buyer fees are unchanged.
-- NOT covered yet: rent renewal commission and shortlet host commission on managed properties.

insert into platform_settings (key, value) values ('managed_rent_fee_pct', '10'), ('managed_rent_fee_min', '0')
  on conflict (key) do nothing;

create or replace function chs_landlord_fee_pct(p_property uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select case when p.chs_service = 'chs_managed' and p.purpose = 'rent'
              then coalesce((select value::numeric from platform_settings where key = 'managed_rent_fee_pct'), 10)
              else (select value::numeric from platform_settings where key = 'rental_commission_landlord_percentage') end
    from properties p where p.id = p_property;
$$;

create or replace function chs_seller_fee_pct(p_property uuid, p_amount numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select case when p.chs_service = 'chs_managed' and p.purpose = 'sale' then
           case when p_amount <= 50000000 then 8 when p_amount <= 200000000 then 6 when p_amount <= 500000000 then 5
                when p_amount <= 1000000000 then 4 else 3 end
         else (select value::numeric from platform_settings where key = 'sale_commission_seller_percentage') end
    from properties p where p.id = p_property;
$$;

create or replace function approve_rental_application(p_application_id uuid) returns uuid
language plpgsql security definer as $function$
declare
  v_property_id uuid; v_tenant_id uuid; v_owner_id uuid; v_annual_rent numeric; v_move_in date; v_new_tenancy_id uuid;
  v_tenant_pct numeric; v_landlord_pct numeric; v_tenant_commission numeric; v_landlord_commission numeric; v_managed boolean; v_min numeric;
begin
  select property_id, tenant_id, move_in_date into v_property_id, v_tenant_id, v_move_in from rental_applications where id = p_application_id;
  select owner_id, price, (chs_service = 'chs_managed') into v_owner_id, v_annual_rent, v_managed from properties where id = v_property_id;

  if v_owner_id != auth.uid() and not is_admin() then
    raise exception 'Only the property owner can approve this application.';
  end if;

  update rental_applications set status = 'approved' where id = p_application_id;

  insert into tenancies (property_id, tenant_id, landlord_id, lease_start, lease_end, annual_rent, status)
  values (v_property_id, v_tenant_id, v_owner_id, coalesce(v_move_in, current_date), coalesce(v_move_in, current_date) + interval '1 year', v_annual_rent, 'active')
  returning id into v_new_tenancy_id;

  update properties set status = 'rented' where id = v_property_id;

  select value::numeric into v_tenant_pct from platform_settings where key = 'rental_commission_tenant_percentage';
  v_landlord_pct := chs_landlord_fee_pct(v_property_id);
  v_tenant_commission := round(v_annual_rent * v_tenant_pct / 100, 2);
  v_landlord_commission := round(v_annual_rent * v_landlord_pct / 100, 2);
  if v_managed then
    select coalesce(value::numeric, 150000) into v_min from platform_settings where key = 'managed_rent_fee_min';
    v_landlord_commission := greatest(v_landlord_commission, coalesce(v_min, 150000));
    v_landlord_pct := round(v_landlord_commission * 100 / v_annual_rent, 2);
  end if;

  insert into transaction_commissions (transaction_type, tenancy_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount)
  values
    ('rental', v_new_tenancy_id, v_property_id, v_tenant_id, 'tenant', v_annual_rent, v_tenant_pct, v_tenant_commission),
    ('rental', v_new_tenancy_id, v_property_id, v_owner_id, 'landlord', v_annual_rent, v_landlord_pct, v_landlord_commission)
  on conflict do nothing;

  perform notify_user(v_tenant_id, '🏠 Your rental application was approved!',
    'Your rent is ' || v_annual_rent || '. A ' || v_tenant_pct || '% CHS service fee of ' || v_tenant_commission || ' also applies, for a combined total of ' || (v_annual_rent + v_tenant_commission) || ', payable together from your CHS wallet.',
    '/my-applications');
  perform notify_user(v_owner_id,
    case when v_managed then '💰 Your CHS management fee is due' else '💰 Your CHS service fee is due' end,
    case when v_managed
      then 'The CHS management fee of ' || v_landlord_commission || ' is due on this new tenancy. It replaces the standard landlord service fee, so nothing else is charged to you.'
      else 'A ' || v_landlord_pct || '% CHS service fee of ' || v_landlord_commission || ' is due on this new tenancy — CHS''s fee for facilitating this rental, separate from your rent income.' end,
    '/owner');
  return v_new_tenancy_id;
end;
$function$;

create or replace function generate_sale_commissions(p_offer_id uuid) returns void
language plpgsql security definer as $function$
declare
  v_amount numeric; v_property_id uuid; v_buyer_id uuid; v_seller_id uuid; v_buyer_pct numeric; v_seller_pct numeric;
begin
  if not is_admin() then raise exception 'Only CHS staff can finalize sale commissions.'; end if;
  select amount, property_id, buyer_id into v_amount, v_property_id, v_buyer_id from offers where id = p_offer_id;
  select owner_id into v_seller_id from properties where id = v_property_id;
  select value::numeric into v_buyer_pct from platform_settings where key = 'sale_commission_buyer_percentage';
  v_seller_pct := chs_seller_fee_pct(v_property_id, v_amount);

  insert into transaction_commissions (transaction_type, offer_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount)
  values
    ('sale', p_offer_id, v_property_id, v_buyer_id, 'buyer', v_amount, v_buyer_pct, round(v_amount * v_buyer_pct / 100, 2)),
    ('sale', p_offer_id, v_property_id, v_seller_id, 'seller', v_amount, v_seller_pct, round(v_amount * v_seller_pct / 100, 2))
  on conflict do nothing;

  perform notify_user(v_buyer_id, '💰 Sale commission invoice generated',
    'A real ' || v_buyer_pct || '% commission (' || round(v_amount * v_buyer_pct / 100, 2) || ') is due on your recent purchase. Please settle it from your CHS wallet.',
    '/property/' || v_property_id);
  perform notify_user(v_seller_id, '💰 Sale commission invoice generated',
    'A real ' || v_seller_pct || '% commission (' || round(v_amount * v_seller_pct / 100, 2) || ') is due on your recent sale. Please settle it from your CHS wallet.',
    '/property/' || v_property_id);
end;
$function$;

create or replace function sale_seller_net(p_offer_id uuid) returns numeric
language plpgsql stable as $function$
declare v_amount numeric; v_comm numeric; v_pct numeric; v_prop uuid;
begin
  select amount, property_id into v_amount, v_prop from offers where id = p_offer_id;
  select commission_amount into v_comm from transaction_commissions where offer_id = p_offer_id and payer_role = 'seller' limit 1;
  if v_comm is null then
    v_pct := chs_seller_fee_pct(v_prop, coalesce(v_amount, 0));
    v_comm := round(coalesce(v_amount, 0) * coalesce(v_pct, 0) / 100, 2);
  end if;
  return coalesce(v_amount, 0) - v_comm;
end;
$function$;

-- Mandates: capacity, documents, agreed terms, hotel purpose.
alter table management_mandates drop constraint if exists management_mandates_purposes_check;
alter table management_mandates add constraint management_mandates_purposes_check
  check (cardinality(purposes) > 0 and purposes <@ array['rent','shortlet','sale','hotel']);
alter table management_mandates
  add column if not exists capacity text,
  add column if not exists documents jsonb not null default '[]'::jsonb,
  add column if not exists agreed_terms jsonb,
  add column if not exists documents_checked_by uuid references profiles(id),
  add column if not exists documents_checked_at timestamptz;

-- The first version of the request and decision functions is retired: it skipped documents.
create or replace function request_chs_management(p_property uuid, p_purposes text[], p_note text, p_fee_terms text, p_terms_version text, p_accept boolean)
returns json language plpgsql security definer set search_path = public as $$
begin raise exception 'This form has been replaced. Please refresh the page.'; end $$;
create or replace function admin_decide_management_mandate(p_id uuid, p_decision text, p_note text default null)
returns json language plpgsql security definer set search_path = public as $$
begin raise exception 'This screen has been replaced. Please refresh the page.'; end $$;

create or replace function request_chs_management_v2(p_property uuid, p_purposes text[], p_capacity text, p_documents jsonb,
  p_note text, p_fee_terms text, p_terms_version text, p_accept boolean)
returns json language plpgsql security definer set search_path = public as $$
declare v_p properties%rowtype; v_id uuid; v_verified boolean;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if not coalesce(p_accept, false) then raise exception 'You must accept the CHS management terms.'; end if;
  select * into v_p from properties where id = p_property and owner_id = auth.uid();
  if not found then raise exception 'You can only hand over a property you own.'; end if;
  select coalesce(valid_id_verified, false) into v_verified from profiles where id = auth.uid();
  if not v_verified then raise exception 'Verify your identity first, then ask CHS to manage your property.'; end if;
  if p_purposes is null or cardinality(p_purposes) = 0 or not (p_purposes <@ array['rent','shortlet','sale','hotel']) then
    raise exception 'Choose what CHS should manage the property for.'; end if;
  if p_capacity not in ('owner','co_owned','attorney','company') then raise exception 'Say in what capacity you are handing this property over.'; end if;
  if p_documents is null or jsonb_typeof(p_documents) <> 'array' or jsonb_array_length(p_documents) < 1 then
    raise exception 'Upload the required documents first.'; end if;
  if v_p.chs_service = 'chs_managed' then raise exception 'This property is already managed by CHS.'; end if;
  if exists (select 1 from management_mandates where property_id = p_property and status in ('pending','approved','end_requested')) then
    raise exception 'There is already an open management request for this property.'; end if;
  insert into management_mandates (property_id, owner_id, purposes, capacity, documents, owner_note, fee_terms, terms_text_version)
    values (p_property, auth.uid(), p_purposes, p_capacity, p_documents, nullif(trim(p_note), ''), coalesce(p_fee_terms, ''), coalesce(p_terms_version, '1'))
    returning id into v_id;
  perform log_audit_event('management_requested', 'management_mandates', v_id, v_p.title, jsonb_build_object('purposes', p_purposes, 'capacity', p_capacity));
  perform notify_admins_by_domain('owner_buyer_tenant', 'New request: CHS to manage a property',
    '"' || v_p.title || '" (' || array_to_string(p_purposes, ', ') || ') — review in Admin → CHS stamp.', '/admin');
  perform notify_user(auth.uid(), 'Request received', 'CHS will review your request to manage "' || v_p.title || '" and reply here.', '/owner');
  return json_build_object('id', v_id, 'status', 'pending');
end $$;

create or replace function admin_decide_management_v2(p_id uuid, p_decision text, p_note text default null,
  p_documents_checked boolean default false, p_agreed_terms jsonb default null)
returns json language plpgsql security definer set search_path = public as $$
declare v_m management_mandates%rowtype; v_p properties%rowtype; v_tag text;
begin
  if not is_admin() then raise exception 'admin_only'; end if;
  if p_decision not in ('approve','decline','end') then raise exception 'invalid_decision'; end if;
  select * into v_m from management_mandates where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  select * into v_p from properties where id = v_m.property_id;

  if p_decision = 'approve' then
    if v_m.status <> 'pending' then raise exception 'Only a pending request can be approved.'; end if;
    if v_p.verification_status <> 'verified' then raise exception 'Verify the listing first.'; end if;
    if not coalesce(p_documents_checked, false) then raise exception 'Confirm that you have checked the ownership or authority documents.'; end if;
    if 'hotel' = any (v_m.purposes) and (p_agreed_terms is null or p_agreed_terms->>'base_pct' is null or p_agreed_terms->>'incentive_pct' is null or p_agreed_terms->>'term_months' is null) then
      raise exception 'Record the agreed hotel terms (base fee, incentive fee and term) before approving.'; end if;
    perform set_config('chs.svc_ok', 'on', true);
    update properties set chs_service = 'chs_managed' where id = v_m.property_id returning chs_tag into v_tag;
    update management_mandates set status = 'approved', admin_note = p_note, decided_by = auth.uid(), decided_at = now(),
      agreed_terms = p_agreed_terms, documents_checked_by = auth.uid(), documents_checked_at = now() where id = p_id;
    perform notify_user(v_m.owner_id, 'CHS now manages "' || v_p.title || '"',
      'Your property now carries the Managed & Advertised by CHS stamp. Tag: ' || v_tag || '.', '/property/' || v_m.property_id);
  elsif p_decision = 'decline' then
    if v_m.status <> 'pending' then raise exception 'Only a pending request can be declined.'; end if;
    if coalesce(length(trim(p_note)), 0) < 5 then raise exception 'Give the owner a reason.'; end if;
    update management_mandates set status = 'declined', admin_note = p_note, decided_by = auth.uid(), decided_at = now() where id = p_id;
    perform notify_user(v_m.owner_id, 'CHS cannot manage "' || v_p.title || '" now', trim(p_note), '/owner');
  else
    if v_m.status not in ('approved','end_requested') then raise exception 'This arrangement is not active.'; end if;
    perform set_config('chs.svc_ok', 'on', true);
    update properties set chs_service = 'independent' where id = v_m.property_id;
    update management_mandates set status = 'ended', ended_at = now(), admin_note = coalesce(p_note, admin_note), decided_by = auth.uid() where id = p_id;
    perform notify_user(v_m.owner_id, 'CHS management ended', 'CHS no longer manages "' || v_p.title || '". The CHS stamp has been removed.', '/owner');
  end if;
  perform log_audit_event('management_' || p_decision, 'management_mandates', p_id, v_p.title, jsonb_build_object('note', p_note, 'terms', p_agreed_terms));
  return json_build_object('id', p_id, 'decision', p_decision);
end $$;

create or replace function admin_list_management_mandates(p_status text default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare r json;
begin
  if not is_admin() then raise exception 'admin_only'; end if;
  select coalesce(json_agg(x order by x.created_at desc), '[]'::json) into r from (
    select m.id, m.property_id, p.title, p.location_area, p.verification_status, p.purpose as listed_as, m.purposes, m.owner_note,
           m.fee_terms, m.terms_text_version, m.accepted_at, m.status, m.admin_note, m.end_reason, m.created_at,
           m.capacity, m.documents, m.agreed_terms,
           pr.full_name as owner_name, pr.valid_id_verified as owner_id_verified, p.chs_tag
      from management_mandates m join properties p on p.id = m.property_id join profiles pr on pr.id = m.owner_id
     where (p_status is null and m.status in ('pending','end_requested')) or m.status = p_status) x;
  return r;
end $$;

-- Owner earnings screen: show the fee that really applies to each property.
create or replace function get_owner_earnings_detailed() returns json
language sql stable security definer as $function$
select coalesce(json_agg(row_to_json(t) order by t.paid_at desc), '[]'::json) from (
  select 'rent' as category, rp.amount as gross_amount,
    round(rp.amount * chs_landlord_fee_pct(prop.id) / 100, 2) as commission_amount,
    rp.amount - round(rp.amount * chs_landlord_fee_pct(prop.id) / 100, 2) as net_amount,
    rp.created_at as paid_at, p_tenant.full_name as payer_name, prop.title as property_title, prop.location_area as property_location, 'Rent payment' as detail_label, rp.reference
  from rent_payments rp join tenancies t on t.id = rp.tenancy_id join properties prop on prop.id = t.property_id join profiles p_tenant on p_tenant.id = rp.tenant_id where t.landlord_id = auth.uid()
  union all
  select 'sale', o.amount,
    round(o.amount * chs_seller_fee_pct(prop.id, o.amount) / 100, 2),
    o.amount - round(o.amount * chs_seller_fee_pct(prop.id, o.amount) / 100, 2),
    o.created_at, public_display_name(o.buyer_full_name), prop.title, prop.location_area, 'Property sale', null
  from offers o join properties prop on prop.id = o.property_id where prop.owner_id = auth.uid() and o.legal_transfer_confirmed = true
  union all
  select 'rent_to_own', rtp.amount,
    coalesce((select sum(c.commission_amount) from transaction_commissions c where c.rent_to_own_payment_id = rtp.id and c.payer_role = 'seller'), 0),
    rtp.amount - coalesce((select sum(c.commission_amount) from transaction_commissions c where c.rent_to_own_payment_id = rtp.id and c.payer_role = 'seller'), 0),
    rtp.paid_at, public_display_name(coalesce(a.applicant_full_name, b.full_name)), prop.title, prop.location_area,
    case when rtp.held then 'Mortgage final payment (held until documents are handed over)'
         when rtp.pending_release then 'Mortgage payment (received by CHS, being released to you)'
         else 'Mortgage payment (Rent to Own)' end, rtp.reference
  from rent_to_own_payments rtp join rent_to_own_agreements a on a.id = rtp.agreement_id join properties prop on prop.id = a.property_id join profiles b on b.id = a.buyer_id
  where a.seller_id = auth.uid()
  union all
  select 'shortlet', sb.total_price, sb.host_commission_amount, sb.total_price - sb.host_commission_amount, sb.created_at, sb.guest_full_name, prop.title, prop.location_area,
    'Booking, ' || sb.check_in || ' to ' || sb.check_out, null
  from shortlet_bookings sb join properties prop on prop.id = sb.property_id where prop.owner_id = auth.uid() and sb.payment_status = 'released'
) t $function$;
