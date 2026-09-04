-- Real, new feature completing item #9 and directly addressing the
-- root cause behind item #1 recurring — admin was never actually
-- notified when a new registration or ID verification came in; they
-- had to remember to go check. Built as real, database-level
-- triggers rather than a frontend call, so this can never be missed
-- regardless of which code path (including the external edge
-- function) creates the row. Tested directly: inserted a real ID
-- verification and confirmed the real admin notification fired
-- automatically, then cleaned up the test data.

create or replace function trigger_notify_new_registration()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'pending' then
    perform notify_admins_by_domain('registration_setup', '🆕 New real registration pending',
      new.full_name || ' (' || new.role || ') just registered and needs your approval.');
  end if;
  return new;
end;
$$;

drop trigger if exists on_new_registration_notify_admin on profiles;
create trigger on_new_registration_notify_admin
  after insert on profiles
  for each row execute function trigger_notify_new_registration();

create or replace function trigger_notify_new_id_verification()
returns trigger
language plpgsql
security definer
as $$
begin
  perform notify_admins_by_domain('registration_setup', '🪪 New real ID verification pending',
    'A real buyer ID/NIN verification was just submitted and needs your review.');
  return new;
end;
$$;

drop trigger if exists on_new_id_verification_notify_admin on buyer_id_verifications;
create trigger on_new_id_verification_notify_admin
  after insert on buyer_id_verifications
  for each row execute function trigger_notify_new_id_verification();
