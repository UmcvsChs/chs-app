-- 477: "Managed by CHS" identity.
-- Why: a tenant could not tell a CHS-managed listing (low, published fees) from any other agent's listing.
-- What: an admin-only status on each listing (independent / chs_advertised / chs_managed), a unique CHS tag ID
-- issued automatically, a public tag-check function (so a copied badge or signboard can be proven fake),
-- and a move-in cost breakdown. Owners and agents cannot set or change any of this themselves.

create sequence if not exists chs_tag_seq start 100001;

alter table properties
  add column if not exists chs_service text not null default 'independent'
    check (chs_service in ('independent','chs_advertised','chs_managed')),
  add column if not exists chs_tag text,
  add column if not exists chs_service_since timestamptz,
  add column if not exists chs_service_ended_at timestamptz;

create unique index if not exists properties_chs_tag_key on properties (chs_tag) where chs_tag is not null;
create index if not exists properties_chs_service_idx on properties (chs_service) where chs_service <> 'independent';

-- Check digit so a mistyped tag is recognised as a typo rather than "not found".
create or replace function _chs_tag_check(p_digits text) returns text
language sql immutable as $$
  select (sum((substr(p_digits, i, 1))::int * i) % 10)::text from generate_series(1, length(p_digits)) i;
$$;

create or replace function _chs_new_tag() returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  v := lpad(nextval('chs_tag_seq')::text, 6, '0');
  return 'CHS-' || v || '-' || _chs_tag_check(v);
end $$;

-- Only an admin (or the backend itself) may set the status; anyone else's change is silently put back.
create or replace function enforce_chs_service() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_trusted boolean; v_owner_role text;
begin
  v_trusted := auth.uid() is null or is_admin() or coalesce(current_setting('chs.svc_ok', true), '') = 'on';
  if tg_op = 'INSERT' then
    if not v_trusted then
      new.chs_service := 'independent'; new.chs_tag := null; new.chs_service_since := null; new.chs_service_ended_at := null;
    end if;
    -- Listings created by a CHS admin account are CHS-advertised from the start.
    select role into v_owner_role from profiles where id = new.owner_id;
    if new.chs_service = 'independent' and v_owner_role = 'admin' then new.chs_service := 'chs_advertised'; end if;
  elsif not v_trusted then
    new.chs_service := old.chs_service; new.chs_tag := old.chs_tag;
    new.chs_service_since := old.chs_service_since; new.chs_service_ended_at := old.chs_service_ended_at;
  end if;

  if new.chs_service <> 'independent' then
    if new.chs_tag is null then new.chs_tag := _chs_new_tag(); end if;
    if tg_op = 'INSERT' or old.chs_service = 'independent' then
      new.chs_service_since := now(); new.chs_service_ended_at := null;
    end if;
  elsif tg_op = 'UPDATE' and old.chs_service <> 'independent' then
    new.chs_service_ended_at := now();
  end if;
  return new;
end $$;

create or replace trigger trg_enforce_chs_service
  before insert or update on properties
  for each row execute function enforce_chs_service();

create or replace function admin_set_chs_service(p_property uuid, p_level text, p_note text default null)
returns json language plpgsql security definer set search_path = public as $$
declare v_row properties%rowtype;
begin
  if not is_admin() then raise exception 'admin_only'; end if;
  if p_level not in ('independent','chs_advertised','chs_managed') then raise exception 'invalid_level'; end if;
  perform set_config('chs.svc_ok', 'on', true);
  update properties set chs_service = p_level where id = p_property returning * into v_row;
  if not found then raise exception 'property_not_found'; end if;
  perform log_audit_event('chs_service_set', 'properties', p_property, v_row.title,
    jsonb_build_object('level', p_level, 'tag', v_row.chs_tag, 'note', p_note));
  perform notify_user(v_row.owner_id,
    case when p_level = 'independent' then 'CHS status removed from your listing' else 'Your listing now carries the CHS stamp' end,
    case when p_level = 'independent' then '"' || v_row.title || '" is no longer shown as managed or advertised by CHS.'
         else '"' || v_row.title || '" is now shown as ' ||
              case when p_level = 'chs_managed' then 'Managed and Advertised by CHS' else 'Advertised by CHS' end ||
              '. Its CHS tag is ' || v_row.chs_tag || '.' end,
    '/property/' || p_property);
  return json_build_object('property_id', p_property, 'level', v_row.chs_service, 'tag', v_row.chs_tag);
end $$;

-- Public: anyone (including someone holding a printed signboard or a forwarded flyer) can check a tag.
create or replace function verify_chs_tag(p_tag text) returns json
language plpgsql stable security definer set search_path = public as $$
declare v_tag text := upper(trim(coalesce(p_tag, ''))); v_p properties%rowtype; v_public boolean;
begin
  if v_tag !~ '^CHS-[0-9]{6}-[0-9]$' then
    return json_build_object('found', false, 'reason', 'bad_format');
  end if;
  if _chs_tag_check(substr(v_tag, 5, 6)) <> right(v_tag, 1) then
    return json_build_object('found', false, 'reason', 'bad_check_digit');
  end if;
  select * into v_p from properties where chs_tag = v_tag;
  if not found then return json_build_object('found', false, 'reason', 'not_issued'); end if;
  v_public := v_p.verification_status = 'verified' and v_p.status in ('active', 'coming_soon');
  return json_build_object(
    'found', true, 'tag', v_tag, 'level', v_p.chs_service,
    'active', v_p.chs_service <> 'independent',
    'since', v_p.chs_service_since, 'ended_at', v_p.chs_service_ended_at,
    'listing_public', v_public,
    'property_id', case when v_public then v_p.id end,
    'title', case when v_public then v_p.title end,
    'area', case when v_public then v_p.location_area end,
    'purpose', case when v_public then v_p.purpose end);
end $$;
grant execute on function verify_chs_tag(text) to anon, authenticated;

-- Public: what it costs to move in, itemised. CHS-managed listings carry no agent, legal or inspection fee.
create or replace function get_move_in_cost(p_property_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare v_p properties%rowtype; v_pct numeric; v_comm numeric; v_items json; v_extra numeric := 0; v_dep numeric := 0;
begin
  select * into v_p from properties
   where id = p_property_id and verification_status = 'verified' and status in ('active', 'coming_soon');
  if not found or v_p.purpose <> 'rent' then return null; end if;
  select coalesce(nullif(value, '')::numeric, 0) into v_pct from platform_settings where key = 'rental_commission_tenant_percentage';
  v_comm := round(v_p.price * coalesce(v_pct, 0) / 100);
  if v_p.custom_fees is not null and jsonb_typeof(v_p.custom_fees::jsonb) = 'array' then
    select coalesce(json_agg(json_build_object('label', f->>'label', 'pct', (f->>'percentage')::numeric,
             'amount', round(v_p.price * (f->>'percentage')::numeric / 100))), '[]'::json),
           coalesce(sum(round(v_p.price * (f->>'percentage')::numeric / 100)), 0)
      into v_items, v_extra from jsonb_array_elements(v_p.custom_fees::jsonb) f;
  else
    v_items := '[]'::json;
  end if;
  if v_p.security_deposit_enabled and v_p.security_deposit_amount is not null then v_dep := v_p.security_deposit_amount; end if;
  return json_build_object(
    'rent', v_p.price, 'period', v_p.price_period, 'level', v_p.chs_service,
    'chs_fee_pct', v_pct, 'chs_fee', v_comm,
    'lister_fees', v_items, 'lister_fees_total', v_extra,
    'deposit', v_dep,
    'total', v_p.price + v_comm + v_extra);
end $$;
grant execute on function get_move_in_cost(uuid) to anon, authenticated;

-- Public: how many listings carry the CHS stamp (for the "Managed by CHS" page).
create or replace function get_chs_counts() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'managed', count(*) filter (where chs_service = 'chs_managed'),
    'advertised', count(*) filter (where chs_service = 'chs_advertised'))
  from properties where chs_service <> 'independent' and verification_status = 'verified' and status in ('active', 'coming_soon');
$$;
grant execute on function get_chs_counts() to anon, authenticated;

-- Admin: find listings to stamp (by title, area, reference number or tag); an empty search shows those already stamped.
create or replace function admin_chs_stamp_list(p_query text default '') returns json
language plpgsql stable security definer set search_path = public as $$
declare v_q text := '%' || trim(coalesce(p_query, '')) || '%'; r json;
begin
  if not is_admin() then raise exception 'admin_only'; end if;
  select coalesce(json_agg(x), '[]'::json) into r from (
    select p.id, p.title, p.location_area, p.purpose, p.price, p.reference_number, p.verification_status, p.status,
           p.chs_service, p.chs_tag, p.chs_service_since, pr.full_name as owner_name
      from properties p left join profiles pr on pr.id = p.owner_id
     where (trim(coalesce(p_query, '')) = '' and p.chs_service <> 'independent')
        or (trim(coalesce(p_query, '')) <> '' and (p.title ilike v_q or p.location_area ilike v_q
             or p.reference_number ilike v_q or p.chs_tag ilike v_q))
     order by p.chs_service = 'independent', p.created_at desc limit 30) x;
  return r;
end $$;
