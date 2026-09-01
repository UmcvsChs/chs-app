-- Real, serious gap found through direct client question: a
-- "suspended" status already existed in the real database schema,
-- but nothing ever actually used it — no admin tool to suspend a
-- genuinely suspicious account, and critically, nothing anywhere
-- actually blocked a suspended account from continuing to use the
-- app normally. Also builds the real appeal process requested, and a
-- genuine self-service deactivation, matching WhatsApp/Facebook.

alter table profiles drop constraint if exists profiles_status_check;
alter table profiles add constraint profiles_status_check
  check (status = ANY (ARRAY['pending', 'approved', 'rejected', 'suspended', 'deactivated']));

alter table profiles add column if not exists suspension_reason text;
alter table profiles add column if not exists suspended_at timestamptz;

create table account_appeals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id),
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  admin_response text,
  reviewed_by uuid references profiles(id),
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

alter table account_appeals enable row level security;
create policy "appeals_own" on account_appeals for all using (auth.uid() = user_id);
create policy "appeals_admin_all" on account_appeals for all using (staff_can_access('owner_buyer_tenant'));

create or replace function suspend_user_account(p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Only CHS staff can suspend a real account.';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A real, genuine reason must be recorded for any suspension.';
  end if;

  update profiles set status = 'suspended', suspension_reason = p_reason, suspended_at = now() where id = p_user_id;

  perform notify_user(p_user_id, '⚠️ Your CHS account has been suspended', p_reason || ' If you believe this is a mistake, you can submit a real appeal from the app.');
end;
$$;

create or replace function reactivate_user_account(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Only CHS staff can reactivate a real account.';
  end if;

  update profiles set status = 'approved', suspension_reason = null, suspended_at = null where id = p_user_id;
  perform notify_user(p_user_id, '✓ Your CHS account has been reactivated', 'Your real access to CHS has been fully restored.');
end;
$$;

create or replace function submit_account_appeal(p_message text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new_id uuid;
begin
  insert into account_appeals (user_id, message)
  values (auth.uid(), p_message)
  returning id into v_new_id;

  insert into notifications (user_id, title, body, link)
  select id, '⚖️ Real account appeal submitted', p_message, '/admin'
  from profiles where is_super_admin = true;

  return v_new_id;
end;
$$;

create or replace function deactivate_my_account()
returns void
language plpgsql
security definer
as $$
begin
  update profiles set status = 'deactivated', suspended_at = now() where id = auth.uid();
end;
$$;

create or replace function reactivate_my_account()
returns void
language plpgsql
security definer
as $$
begin
  update profiles set status = 'approved', suspended_at = null where id = auth.uid() and status = 'deactivated';
end;
$$;
