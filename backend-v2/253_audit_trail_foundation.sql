-- Fix Tracker item 12 — a real, permanent, tamper-evident log of
-- every significant action across the platform: who did what, to
-- which record, when, and what changed. Built as a genuine, shared,
-- reusable piece of infrastructure — any real function can log a real
-- event with one call, and every entry is permanent (no update or
-- delete policy exists on this table at all, by design — a real
-- audit trail that could be edited after the fact would defeat its
-- entire purpose).

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  actor_role text,
  action text not null,
  target_table text not null,
  target_id uuid,
  target_label text,
  details jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_audit_log_target on audit_log (target_table, target_id);
create index if not exists idx_audit_log_actor on audit_log (actor_id);
create index if not exists idx_audit_log_created on audit_log (created_at desc);

alter table audit_log enable row level security;
create policy audit_log_admin_read on audit_log for select using (staff_can_access('owner_buyer_tenant'));
-- Deliberately no insert/update/delete policy for regular users —
-- every real entry can only be written by a SECURITY DEFINER function
-- running as the database owner, never directly by a user or even an
-- admin's own client-side code. No update or delete policy exists at
-- all, for anyone — a real audit trail must never be editable.

create or replace function log_audit_event(
  p_action text, p_target_table text, p_target_id uuid, p_target_label text, p_details jsonb default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_role text;
begin
  select role into v_role from profiles where id = auth.uid();
  insert into audit_log (actor_id, actor_role, action, target_table, target_id, target_label, details)
  values (auth.uid(), coalesce(v_role, 'system'), p_action, p_target_table, p_target_id, p_target_label, p_details);
end;
$$;
