create or replace function get_admin_processed_history()
returns json
language sql
security definer
stable
as $$
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
    select * from (
      select 'rental_application' as item_type, ra.id, ra.status,
        coalesce(ra.applicant_full_name, 'Applicant') as person_name,
        p.title as property_title, ra.owner_decision_at as acted_at
      from rental_applications ra join properties p on p.id = ra.property_id
      where ra.status in ('approved', 'owner_declined') and ra.owner_decision_at is not null

      union all

      select 'offer' as item_type, o.id, o.status,
        coalesce(o.buyer_full_name, 'Buyer') as person_name,
        p.title as property_title, o.created_at as acted_at
      from offers o join properties p on p.id = o.property_id
      where o.status in ('accepted', 'rejected')
    ) combined
    order by acted_at desc
    limit 100
  ) t;
$$;
