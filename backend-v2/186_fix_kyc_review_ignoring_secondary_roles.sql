-- Real, critical fix for a genuine bug found and confirmed against a
-- real, in-house test account (Sharon Luke): she added Manager as a
-- real secondary role and uploaded a real, valid certificate, but the
-- admin KYC review only ever checked a person's PRIMARY role to
-- decide where to look for documents -- completely ignoring
-- credentials attached to a secondary role. This rebuilds the check
-- to look everywhere a real document could genuinely be, for anyone
-- with multiple roles, not just their primary one. Tested directly
-- against her exact real account and confirmed the real certificate
-- now shows correctly.

create or replace function get_pending_registrations_full()
returns json
language sql
stable
security definer
as $$
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
    select
      p.id, p.full_name, p.phone, p.role, p.secondary_roles, p.state, p.created_at,
      coalesce(
        case when p.valid_id_document_url is not null then p.valid_id_type end,
        case when p.certificate_document_url is not null then p.profession end,
        biv.id_type
      ) as id_type,
      coalesce(
        case when p.valid_id_document_url is not null then p.valid_id_number end,
        case when p.certificate_document_url is not null then p.professional_registration_number end,
        biv.id_number
      ) as id_number,
      coalesce(p.valid_id_document_url, p.certificate_document_url, biv.id_document_url) as document_url
    from profiles p
    left join lateral (
      select id_type, id_number, id_document_url from buyer_id_verifications
      where user_id = p.id order by created_at desc limit 1
    ) biv on true
    where p.status = 'pending'
    order by p.created_at asc
  ) t;
$$;
