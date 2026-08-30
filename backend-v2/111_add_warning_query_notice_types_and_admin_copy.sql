-- Real, new requirement per direct client request: an owner should be
-- able to issue a real warning or query directly to a tenant, not
-- just sale/renovation/rent-review/quit notices, and CHS should
-- genuinely be copied on every one of these — confirmed by checking
-- directly, admin was never notified at all.

alter table formal_notices drop constraint formal_notices_notice_type_check;
alter table formal_notices add constraint formal_notices_notice_type_check
  check (notice_type = ANY (ARRAY['sale', 'renovation', 'rent_review', 'quit', 'warning', 'query']));

create or replace function copy_admin_on_formal_notice()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into notifications (user_id, title, body)
  select p.id, '📋 Formal notice issued: ' || new.notice_type,
    'A real formal notice (Ref ' || new.reference || ') has been issued on tenancy ' || new.tenancy_id || '. Real, permanent record — view in the admin panel.'
  from profiles p where p.is_super_admin = true;
  return new;
end;
$$;

drop trigger if exists trg_copy_admin_on_formal_notice on formal_notices;
create trigger trg_copy_admin_on_formal_notice
  after insert on formal_notices
  for each row execute function copy_admin_on_formal_notice();
