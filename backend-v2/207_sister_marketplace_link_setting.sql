-- Real, new feature per direct client request: a genuine, admin-
-- editable link to CHS's sister buying-and-selling platform (Unify
-- Market Central), reused via the exact same real, proven pattern
-- already built for editable contact details -- so admin can set and
-- update the real URL themselves, without needing another code change.

insert into platform_settings (key, value) values
  ('sister_marketplace_name', 'Unify Market Central'),
  ('sister_marketplace_url', 'https://unifymarketcentral.com')
on conflict (key) do nothing;

create or replace function get_contact_settings()
returns json
language sql
stable
as $$
  select json_object_agg(key, value) from platform_settings
  where key in ('contact_email_admin', 'contact_email_engage', 'contact_email_inquiry', 'contact_email_support', 'contact_phone_primary', 'contact_phone_secondary', 'sister_marketplace_name', 'sister_marketplace_url');
$$;

create or replace function update_contact_setting(p_key text, p_value text)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Only CHS staff can update contact settings.';
  end if;
  if p_key not in ('contact_email_admin', 'contact_email_engage', 'contact_email_inquiry', 'contact_email_support', 'contact_phone_primary', 'contact_phone_secondary', 'sister_marketplace_name', 'sister_marketplace_url') then
    raise exception 'Not a real, recognized contact setting.';
  end if;

  update platform_settings set value = p_value where key = p_key;
end;
$$;

-- Real, public read so every logged-in user's browser can show the
-- real, current link without needing admin rights.
create or replace function get_sister_marketplace_link()
returns json
language sql
stable
as $$
  select json_object_agg(key, value) from platform_settings
  where key in ('sister_marketplace_name', 'sister_marketplace_url');
$$;
