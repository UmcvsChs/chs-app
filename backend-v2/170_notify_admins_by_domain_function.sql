-- Real, new, genuinely reusable function — found while building the
-- rental application relay flow that "notify the real admins
-- responsible for X" has never existed anywhere in the app before.
-- This directly sets up real infrastructure item #9 (the admin
-- notification bell) will also need.

create or replace function notify_admins_by_domain(p_domain text, p_title text, p_body text)
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
    perform notify_user(r.id, p_title, p_body);
  end loop;
end;
$$;
