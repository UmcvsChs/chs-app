-- 486: (1) "Managed & Advertised by CHS" can only be awarded where CHS holds an approved management agreement (mandate)
--      with the owner. Removing the stamp ends that agreement. "Advertised by CHS" is unchanged.
--      (2) Managed sale fee: the tiered seller fee is capped at 6.5% (setting managed_sale_fee_cap_pct).
insert into public.platform_settings(key, value) values ('managed_sale_fee_cap_pct', '6.5') on conflict (key) do nothing;

create or replace function public.chs_seller_fee_pct(p_property uuid, p_amount numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select case when p.chs_service = 'chs_managed' and p.purpose = 'sale' then
           least(case when p_amount <= 50000000 then 8 when p_amount <= 200000000 then 6 when p_amount <= 500000000 then 5
                      when p_amount <= 1000000000 then 4 else 3 end,
                 coalesce((select nullif(value, '')::numeric from platform_settings where key = 'managed_sale_fee_cap_pct'), 6.5))
         else (select value::numeric from platform_settings where key = 'sale_commission_seller_percentage') end
    from properties p where p.id = p_property;
$$;

create or replace function public.admin_set_chs_service(p_property uuid, p_level text, p_note text default null) returns json
language plpgsql security definer set search_path = public as $$
declare v_row properties%rowtype; v_old text;
begin
  if not is_admin() then raise exception 'admin_only'; end if;
  if p_level not in ('independent','chs_advertised','chs_managed') then raise exception 'invalid_level'; end if;
  select chs_service into v_old from properties where id = p_property;
  if not found then raise exception 'property_not_found'; end if;
  if p_level = 'chs_managed' and not exists (select 1 from management_mandates where property_id = p_property and status = 'approved') then
    raise exception 'Managed & Advertised needs an approved management agreement with the owner. Ask the owner to use "Ask CHS to manage this property", then approve it under Requests. Use Advertised only if CHS is not managing it.';
  end if;
  perform set_config('chs.svc_ok', 'on', true);
  update properties set chs_service = p_level where id = p_property returning * into v_row;
  if v_old = 'chs_managed' and p_level <> 'chs_managed' then
    update management_mandates set status = 'ended', ended_at = now(), admin_note = coalesce(p_note, admin_note), decided_by = auth.uid()
      where property_id = p_property and status in ('approved','end_requested');
  end if;
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
