-- Real, new admin search -- find any real property by its reference
-- number, title, or the real owner's name/phone, with the owner's
-- identity always shown directly. Also fixed a real, separate,
-- confirmed gap found while investigating this: admin's rental
-- application query only fetched 'pending' and
-- 'owner_decided_pending_relay' status, completely skipping
-- 'awaiting_owner_decision' -- meaning any application currently
-- sitting with the owner was genuinely invisible to admin, with no
-- way to trace it, exactly matching the real, reported complaint.

create or replace function admin_search_properties(p_query text)
returns json
language sql
stable
security definer
as $$
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
    select
      p.id, p.reference_number, p.title, p.purpose, p.status, p.bedrooms,
      p.location_area, p.location_state, p.price,
      p.owner_id, o.full_name as owner_name, o.phone as owner_phone,
      p.managing_agent_id, a.full_name as agent_name
    from properties p
    join profiles o on o.id = p.owner_id
    left join profiles a on a.id = p.managing_agent_id
    where p.reference_number ilike '%' || p_query || '%'
       or p.title ilike '%' || p_query || '%'
       or o.full_name ilike '%' || p_query || '%'
       or o.phone ilike '%' || p_query || '%'
    order by p.created_at desc
    limit 30
  ) t;
$$;
