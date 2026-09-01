-- Real bug caught before testing: the previous version passed a
-- boolean where notify_user expects a real title string.

create or replace function resolve_account_appeal(p_appeal_id uuid, p_approve boolean, p_response text)
returns void
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can resolve a real appeal.';
  end if;

  select user_id into v_user_id from account_appeals where id = p_appeal_id;

  update account_appeals set status = case when p_approve then 'approved' else 'denied' end,
    admin_response = p_response, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_appeal_id;

  if p_approve then
    update profiles set status = 'approved', suspension_reason = null, suspended_at = null where id = v_user_id;
    perform notify_user(v_user_id, '✓ Your appeal was approved', p_response);
  else
    perform notify_user(v_user_id, '⚠️ Your appeal was not approved', p_response);
  end if;
end;
$$;
