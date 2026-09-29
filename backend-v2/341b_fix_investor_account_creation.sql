-- Real, urgent fix to my own previous migration, caught before it
-- was ever used: profiles has no PIN or password column at all --
-- real login credentials are handled entirely by Supabase's own auth
-- system, created through the real registration flow, not something
-- a SQL function can fabricate directly. Corrected to follow the
-- exact same, real, already-working pattern used for assigning staff
-- roles: find an existing, already-registered real account by phone
-- or email, and promote it to the investor role -- the person must
-- genuinely register on CHS first (or already have a real account),
-- then admin elevates them.
--
-- NOTE: this migration number (341) was independently reused by an
-- earlier, unrelated feature (real refund request/processing) in the
-- same session. Kept as 341b; see 341a for the other.

drop function if exists create_investor_account(text, text, text);

create or replace function grant_investor_access(p_contact text)
returns text
language plpgsql
security definer
as $$
declare
  v_target_id uuid;
  v_target_name text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can grant real investor access.';
  end if;

  select id, full_name into v_target_id, v_target_name
    from profiles where phone = p_contact or email = p_contact;
  if v_target_id is null then
    raise exception 'No real CHS account found with that phone number or email. They must register on CHS first.';
  end if;

  update profiles set role = 'investor' where id = v_target_id;

  perform notify_user(v_target_id, 'You now have real investor access',
    'CHS has granted you access to the real investor dashboard — genuine business figures for your own real due diligence.');

  return v_target_name;
end;
$$;
