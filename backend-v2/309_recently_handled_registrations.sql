-- Continuing the same real "Recently Handled, archived manually"
-- pattern to Registrations. profiles.status already drives the real
-- pending-registrations query; these two new, nullable columns don't
-- affect anything else profiles is used for.

alter table profiles add column if not exists registration_archived_at timestamptz;
alter table profiles add column if not exists registration_admin_last_read_at timestamptz;

create or replace function get_recently_handled_registrations()
returns json
language sql
security definer
as $$
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
    select
      p.id, p.full_name, p.phone, p.role, p.status, p.created_at,
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
    where p.status != 'pending'
      and p.registration_archived_at is null
      and (p.registration_admin_last_read_at is null or p.registration_admin_last_read_at > now() - interval '7 days')
    order by p.registration_admin_last_read_at desc nulls last
    limit 200
  ) t;
$$;

create or replace function archive_registration(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Only CHS staff can archive a real registration record.';
  end if;
  update profiles set registration_archived_at = now() where id = p_user_id;
end;
$$;
