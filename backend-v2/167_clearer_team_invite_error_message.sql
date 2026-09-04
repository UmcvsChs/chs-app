create or replace function invite_team_member(p_phone text, p_role_label text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_member_id uuid;
  v_new_id uuid;
begin
  select id into v_member_id from profiles where phone = p_phone;
  if v_member_id is null then
    raise exception 'No CHS account found with that phone number yet. Ask them to register at chs — choosing "Staff / Employee" as their role — then add them here using the same phone number.';
  end if;
  if v_member_id = auth.uid() then
    raise exception 'You cannot add yourself as your own team member.';
  end if;

  insert into team_members (parent_id, member_id, role_label)
  values (auth.uid(), v_member_id, p_role_label)
  on conflict (parent_id, member_id) do update set role_label = p_role_label, status = 'active'
  returning id into v_new_id;

  perform notify_user(v_member_id, '👥 You''ve been added to a real team',
    'You''ve been added as "' || p_role_label || '" — log in any time and go to "My Staff Dashboard" to see your real assignments and submit your daily report.');

  return v_new_id;
end;
$$;
