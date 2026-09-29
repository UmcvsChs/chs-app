create or replace function notify_admins_by_domain(p_domain text, p_title text, p_body text, p_link text default null)
returns void
language plpgsql
security definer
as $$
declare
  r record;
begin
  for r in
    select id from profiles
    where role = 'admin' and (is_super_admin = true or staff_role = p_domain)
  loop
    perform notify_user(r.id, p_title, p_body, p_link);
  end loop;
end;
$$;
