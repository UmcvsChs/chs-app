-- 478: owners hand a property to CHS to manage (rent, shortlet and/or sale), without CHS having to list it.
-- Flow: owner lists the property (or picks an existing one) -> "Ask CHS to manage this property" -> accepts the
-- management terms -> CHS admin reviews -> on approval the listing gets the "Managed & Advertised by CHS" stamp and tag
-- (migration 477). Ending the arrangement removes the stamp. RPC only; no direct table access.

create table if not exists management_mandates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  owner_id uuid not null references profiles(id),
  purposes text[] not null check (cardinality(purposes) > 0 and purposes <@ array['rent','shortlet','sale']),
  owner_note text,
  fee_terms text not null,
  terms_text_version text not null,
  accepted_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','approved','declined','withdrawn','end_requested','ended')),
  admin_note text,
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  end_reason text,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
alter table management_mandates enable row level security;
revoke all on management_mandates from anon, authenticated;
create unique index if not exists management_mandates_one_open on management_mandates (property_id)
  where status in ('pending','approved','end_requested');

create or replace function request_chs_management(p_property uuid, p_purposes text[], p_note text, p_fee_terms text, p_terms_version text, p_accept boolean)
returns json language plpgsql security definer set search_path = public as $$
declare v_p properties%rowtype; v_id uuid; v_verified boolean;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if not coalesce(p_accept, false) then raise exception 'You must accept the CHS management terms.'; end if;
  select * into v_p from properties where id = p_property and owner_id = auth.uid();
  if not found then raise exception 'You can only hand over a property you own.'; end if;
  select coalesce(valid_id_verified, false) into v_verified from profiles where id = auth.uid();
  if not v_verified then raise exception 'Verify your identity first, then ask CHS to manage your property.'; end if;
  if p_purposes is null or cardinality(p_purposes) = 0 or not (p_purposes <@ array['rent','shortlet','sale']) then
    raise exception 'Choose what CHS should manage the property for: rent, shortlet or sale.'; end if;
  if v_p.chs_service = 'chs_managed' then raise exception 'This property is already managed by CHS.'; end if;
  if exists (select 1 from management_mandates where property_id = p_property and status in ('pending','approved','end_requested')) then
    raise exception 'There is already an open management request for this property.'; end if;
  insert into management_mandates (property_id, owner_id, purposes, owner_note, fee_terms, terms_text_version)
    values (p_property, auth.uid(), p_purposes, nullif(trim(p_note), ''), coalesce(p_fee_terms, ''), coalesce(p_terms_version, '1'))
    returning id into v_id;
  perform log_audit_event('management_requested', 'management_mandates', v_id, v_p.title, jsonb_build_object('purposes', p_purposes));
  perform notify_admins_by_domain('owner_buyer_tenant', 'New request: CHS to manage a property',
    '"' || v_p.title || '" (' || array_to_string(p_purposes, ', ') || ') — review in Admin → CHS stamp.', '/admin');
  perform notify_user(auth.uid(), 'Request received', 'CHS will review your request to manage "' || v_p.title || '" and reply here.', '/owner');
  return json_build_object('id', v_id, 'status', 'pending');
end $$;

create or replace function get_my_management_mandates() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', m.id, 'property_id', m.property_id, 'purposes', m.purposes, 'status', m.status,
    'admin_note', m.admin_note, 'created_at', m.created_at, 'decided_at', m.decided_at, 'tag', p.chs_tag) order by m.created_at desc), '[]'::json)
  from management_mandates m join properties p on p.id = m.property_id where m.owner_id = auth.uid();
$$;

create or replace function withdraw_management_request(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update management_mandates set status = 'withdrawn' where id = p_id and owner_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Only a pending request can be withdrawn.'; end if;
end $$;

create or replace function request_end_management(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_m management_mandates%rowtype; v_title text;
begin
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'Please say why you want CHS to stop managing this property.'; end if;
  update management_mandates set status = 'end_requested', end_reason = trim(p_reason)
   where id = p_id and owner_id = auth.uid() and status = 'approved' returning * into v_m;
  if not found then raise exception 'Only an active arrangement can be ended.'; end if;
  select title into v_title from properties where id = v_m.property_id;
  perform notify_admins_by_domain('owner_buyer_tenant', 'Owner asks to end CHS management', '"' || v_title || '": ' || trim(p_reason), '/admin');
end $$;

create or replace function admin_list_management_mandates(p_status text default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare r json;
begin
  if not is_admin() then raise exception 'admin_only'; end if;
  select coalesce(json_agg(x order by x.created_at desc), '[]'::json) into r from (
    select m.id, m.property_id, p.title, p.location_area, p.verification_status, p.purpose as listed_as, m.purposes, m.owner_note,
           m.fee_terms, m.terms_text_version, m.accepted_at, m.status, m.admin_note, m.end_reason, m.created_at,
           pr.full_name as owner_name, pr.valid_id_verified as owner_id_verified, p.chs_tag
      from management_mandates m join properties p on p.id = m.property_id join profiles pr on pr.id = m.owner_id
     where (p_status is null and m.status in ('pending','end_requested')) or m.status = p_status) x;
  return r;
end $$;

create or replace function admin_decide_management_mandate(p_id uuid, p_decision text, p_note text default null)
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
    perform set_config('chs.svc_ok', 'on', true);
    update properties set chs_service = 'chs_managed' where id = v_m.property_id returning chs_tag into v_tag;
    update management_mandates set status = 'approved', admin_note = p_note, decided_by = auth.uid(), decided_at = now() where id = p_id;
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
  perform log_audit_event('management_' || p_decision, 'management_mandates', p_id, v_p.title, jsonb_build_object('note', p_note));
  return json_build_object('id', p_id, 'decision', p_decision);
end $$;
