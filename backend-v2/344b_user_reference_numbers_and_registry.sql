-- Real, new user reference numbers, per direct client request,
-- mirroring the exact same real pattern properties already use
-- (PROP-000XXX): a genuine, permanent, human-readable identifier for
-- every real registered user, generated the same way, auto-assigned
-- going forward.
--
-- NOTE: this migration number (344) was independently reused by an
-- earlier, unrelated feature (removal of the redundant refund system)
-- in the same session. Kept as 344b; see 344a for the other.

create sequence if not exists user_reference_seq start 1;

alter table profiles add column if not exists reference_number text
  unique default ('CHS-U-' || lpad(nextval('user_reference_seq')::text, 6, '0'));

-- Backfill every real, existing user with a genuine reference number,
-- oldest account first, so the numbering reflects real registration
-- order.
do $$
declare
  r record;
begin
  for r in (select id from profiles where reference_number is null order by created_at asc) loop
    update profiles set reference_number = 'CHS-U-' || lpad(nextval('user_reference_seq')::text, 6, '0') where id = r.id;
  end loop;
end $$;

-- Real, super-admin-only function: total registered, genuinely
-- active (signed in within the real window given, using Supabase's
-- own real last_sign_in_at, not invented tracking), and a real,
-- searchable roster — name and reference number, exactly as asked,
-- plus the operational detail (role, phone) a real super admin
-- legitimately needs, never exposed to the investor view.
create or replace function get_user_registry(p_active_days int default 30, p_search text default null)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_super_admin = true) then
    raise exception 'Only the super admin can view the real user registry.';
  end if;

  return (
    select json_build_object(
      'total_registered', (select count(*) from profiles where role not in ('admin','staff')),
      'active_count', (
        select count(*) from profiles p join auth.users u on u.id = p.id
        where p.role not in ('admin','staff') and u.last_sign_in_at > now() - (p_active_days || ' days')::interval
      ),
      'users', (
        select coalesce(json_agg(row_to_json(x)), '[]'::json) from (
          select p.reference_number, p.full_name, p.phone, p.role, p.created_at, u.last_sign_in_at,
            (u.last_sign_in_at > now() - (p_active_days || ' days')::interval) as is_active
          from profiles p join auth.users u on u.id = p.id
          where p.role not in ('admin','staff')
            and (p_search is null or p.full_name ilike '%' || p_search || '%' or p.phone ilike '%' || p_search || '%' or p.reference_number ilike '%' || p_search || '%')
          order by p.created_at desc
          limit 200
        ) x
      )
    )
  );
end;
$$;
