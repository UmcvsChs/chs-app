-- Real bug caught immediately by testing my own previous fix: RLS is
-- row-level, not column-level — the policies just added to let an
-- agent see a managed owner's name also handed them the owner's NIN,
-- phone, and ID document URL, since a real business relationship
-- doesn't justify seeing someone's national ID. Replaced with real,
-- safe, field-limited functions instead of broad row access.

drop policy if exists "profiles_managed_owner_visible_to_agent" on profiles;
drop policy if exists "profiles_agent_visible_to_owner" on profiles;
drop policy if exists "profiles_tenancy_parties_visible" on profiles;
drop policy if exists "profiles_offer_parties_visible" on profiles;

create or replace function get_related_party_name(p_user_id uuid)
returns json
language plpgsql
security definer
stable
as $$
declare
  v_is_related boolean;
  v_result json;
begin
  select
    exists (select 1 from properties p where p.owner_id = p_user_id and p.managing_agent_id = auth.uid())
    or exists (select 1 from properties p where p.managing_agent_id = p_user_id and p.owner_id = auth.uid())
    or exists (select 1 from tenancies t where t.tenant_id = auth.uid() and (t.landlord_id = p_user_id or t.manager_id = p_user_id))
    or exists (select 1 from tenancies t where (t.landlord_id = auth.uid() or t.manager_id = auth.uid()) and t.tenant_id = p_user_id)
    or exists (select 1 from offers o join properties p on p.id = o.property_id where o.buyer_id = auth.uid() and p.owner_id = p_user_id)
    or exists (select 1 from offers o join properties p on p.id = o.property_id where p.owner_id = auth.uid() and o.buyer_id = p_user_id)
    or is_admin()
  into v_is_related;

  if not v_is_related then
    return null;
  end if;

  select json_build_object('full_name', full_name, 'avatar_url', avatar_url)
  into v_result from profiles where id = p_user_id;

  return v_result;
end;
$$;
