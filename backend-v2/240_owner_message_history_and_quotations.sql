-- Real, new feature per direct client request: a genuine, unified
-- message history for owners, pulling together every real
-- conversation with a buyer (via precommit_messages, tied to a real
-- offer) or a tenant (via tenancy_messages, tied to a real tenancy) --
-- all mediated through CHS already, now visible in one real place
-- rather than only inside each individual offer or tenancy screen.

create or replace function get_owner_message_history()
returns json
language sql
security definer
stable
as $$
  select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json) from (
    select pm.id, pm.text, pm.status, pm.created_at, pm.sender_id,
      'offer' as conversation_type, p.title as property_title, o.id as reference_id,
      sender.full_name as sender_name
    from precommit_messages pm
    join offers o on o.id = pm.offer_id
    join properties p on p.id = o.property_id
    join profiles sender on sender.id = pm.sender_id
    where p.owner_id = auth.uid()

    union all

    select tm.id, tm.text, 'approved' as status, tm.created_at, tm.sender_id,
      'tenancy' as conversation_type, p.title as property_title, t.id as reference_id,
      sender.full_name as sender_name
    from tenancy_messages tm
    join tenancies t on t.id = tm.tenancy_id
    join properties p on p.id = t.property_id
    join profiles sender on sender.id = tm.sender_id
    where t.landlord_id = auth.uid()
  ) t;
$$;
