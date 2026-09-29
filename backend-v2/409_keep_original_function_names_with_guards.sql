-- Follow-up to 408. The deployed admin screen calls
-- release_rent_to_landlord and has_approved_admin_login BY NAME.
-- Rather than hand the client a broken admin page until the next
-- deploy, keep those names callable -- but as guarded wrappers around
-- internal versions that nobody but the server can reach.

-- has_approved_admin_login: only ever answers about yourself
drop function if exists has_approved_admin_login_guarded(uuid);
alter function has_approved_admin_login(uuid) rename to has_approved_admin_login_impl;
revoke all on function has_approved_admin_login_impl(uuid) from public, anon, authenticated;
grant execute on function has_approved_admin_login_impl(uuid) to service_role;

create function has_approved_admin_login(p_admin_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_admin_id is distinct from auth.uid() then return false; end if;
  return has_approved_admin_login_impl(p_admin_id);
end $$;
revoke all on function has_approved_admin_login(uuid) from public, anon;
grant execute on function has_approved_admin_login(uuid) to authenticated, service_role;

-- release_rent_to_landlord: the public name is now the ADMIN-ONLY door
alter function release_rent_to_landlord(uuid, text) rename to release_rent_to_landlord_impl;
revoke all on function release_rent_to_landlord_impl(uuid, text) from public, anon, authenticated;
grant execute on function release_rent_to_landlord_impl(uuid, text) to service_role;
drop function if exists admin_release_rent(uuid);

create function release_rent_to_landlord(p_rent_payment_id uuid, p_reason text default 'admin_override') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not staff_can_access('owner_buyer_tenant') then
    raise exception 'Not authorised: only CHS admins can release held rent early.';
  end if;
  -- the reason is fixed here so an admin action can never be labelled
  -- as a tenant's clean report or as the grace period passing
  perform release_rent_to_landlord_impl(p_rent_payment_id, 'admin_override');
end $$;
revoke all on function release_rent_to_landlord(uuid, text) from public, anon;
grant execute on function release_rent_to_landlord(uuid, text) to authenticated, service_role;

-- the clean-report path now calls the internal version directly
do $$
declare def text;
begin
  select pg_get_functiondef(oid) into def from pg_proc
    where proname = 'check_and_release_on_clean_report' and pronamespace = 'public'::regnamespace;
  if position($a$release_rent_to_landlord(v_rent_payment_id, 'clean_report')$a$ in def) = 0 then
    raise exception 'anchor not found in check_and_release_on_clean_report';
  end if;
  def := replace(def, $a$release_rent_to_landlord(v_rent_payment_id, 'clean_report')$a$, $a$release_rent_to_landlord_impl(v_rent_payment_id, 'clean_report')$a$);
  execute def;
end $$;
