-- Real, new feature per direct client request: four real, distinct
-- contact emails (support, inquiry, engage, admin) and two real
-- placeholder phone numbers, stored as genuine, admin-editable
-- settings — not hardcoded in the app — so CHS can update these
-- themselves at any time without needing a developer.

insert into platform_settings (key, value) values
  ('contact_email_admin', 'admin@completehousingsolutions.com'),
  ('contact_email_engage', 'engage@completehousingsolutions.com'),
  ('contact_email_inquiry', 'inquiry@completehousingsolutions.com'),
  ('contact_email_support', 'support@completehousingsolutions.com'),
  ('contact_phone_primary', '08099995899'),
  ('contact_phone_secondary', '08037799837')
on conflict (key) do nothing;

create or replace function get_contact_settings()
returns json
language sql
stable
as $$
  select json_object_agg(key, value) from platform_settings
  where key in ('contact_email_admin', 'contact_email_engage', 'contact_email_inquiry', 'contact_email_support', 'contact_phone_primary', 'contact_phone_secondary');
$$;
