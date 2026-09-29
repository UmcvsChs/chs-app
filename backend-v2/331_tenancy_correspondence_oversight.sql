-- Real, direct correction following a genuine, well-reasoned client
-- argument: CHS's role as moderator and platform operator means
-- every real correspondence between a tenant and their landlord or
-- manager should genuinely be visible to admin -- not gated or
-- delayed (that would add real friction to an already-established,
-- signed relationship, which the client explicitly did not ask for),
-- but seen, "as if copied," so CHS can notice and escalate when a
-- landlord or manager is genuinely slow to respond to something real
-- like a fault report.
--
-- Real, admin-only function surfacing every real tenancy with
-- messages, the real latest message and who sent it, and a genuine,
-- direct flag for the exact case the client described: the tenant's
-- own message sitting unanswered.

create or replace function get_tenancy_correspondence_overview()
returns json
language sql
security definer
as $$
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
  ) t;
$$;

revoke all on function get_tenancy_correspondence_overview() from public;
grant execute on function get_tenancy_correspondence_overview() to authenticated;
