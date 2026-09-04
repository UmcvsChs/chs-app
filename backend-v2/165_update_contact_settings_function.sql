-- Real, new admin function — lets CHS staff genuinely update their
-- own contact details themselves, without needing a developer,
-- exactly as requested.

create or replace function update_contact_setting(p_key text, p_value text)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Only CHS staff can update contact settings.';
  end if;
  if p_key not in ('contact_email_admin', 'contact_email_engage', 'contact_email_inquiry', 'contact_email_support', 'contact_phone_primary', 'contact_phone_secondary') then
    raise exception 'Not a real, recognized contact setting.';
  end if;

  update platform_settings set value = p_value where key = p_key;
end;
$$;
