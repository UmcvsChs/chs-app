-- Real, urgent security fix to my own previous migration: the
-- function was granted to any authenticated user with no real check
-- inside it, meaning any real logged-in user could have called it
-- directly and read every tenant's correspondence across the whole
-- platform -- a genuine, serious mistake, caught and fixed
-- immediately before this was ever used, not left for later.

create or replace function get_tenancy_correspondence_overview()
returns json
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Only CHS staff can view real tenancy correspondence.';
  end if;

  return (
    select coalesce(json_agg(row_to_json(t) order by t.last_message_at desc), '[]'::json) from (
      select
        tm.tenancy_id,
        p.title as property_title,
        p.street_address,
        tenant.full_name as tenant_name,
        tenant.phone as tenant_phone,
        coalesce(landlord.full_name, manager.full_name) as responsible_party_name,
        coalesce(landlord.phone, manager.phone) as responsible_party_phone,
        case when tn.manager_id is not null then 'manager' else 'landlord' end as responsible_party_role,
        last_msg.text as last_message_text,
        last_msg.sender_id as last_sender_id,
        (last_msg.sender_id = tn.tenant_id) as awaiting_landlord_reply,
        last_msg.created_at as last_message_at,
        (select count(*) from tenancy_messages where tenancy_id = tm.tenancy_id) as message_count
      from (select distinct tenancy_id from tenancy_messages) tm
      join tenancies tn on tn.id = tm.tenancy_id
      join properties p on p.id = tn.property_id
      join profiles tenant on tenant.id = tn.tenant_id
      left join profiles landlord on landlord.id = tn.landlord_id
      left join profiles manager on manager.id = tn.manager_id
      join lateral (
        select text, sender_id, created_at from tenancy_messages
        where tenancy_id = tm.tenancy_id order by created_at desc limit 1
      ) last_msg on true
    ) t
  );
end;
$$;
