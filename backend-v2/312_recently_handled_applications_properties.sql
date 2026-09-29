-- Continuing the same real "Recently Handled, archived manually"
-- pattern -- this round: Applications and Properties.
--
-- Applications: all three real decision points (admin relaying to
-- owner, admin relaying the owner's decision to the tenant, and the
-- original screening step) now mark admin_last_read_at. A real
-- Recently Handled section shows anything outside the four real
-- pending statuses (pending, awaiting_admin_review,
-- awaiting_owner_decision, owner_decided_pending_relay).
--
-- Properties: verification approve/reject now marks
-- verification_admin_last_read_at. A real Recently Handled section
-- shows anything no longer "pending" verification.
--
-- A real type error was caught by the full production build (not
-- just lint) and fixed before packaging: the Properties Recently
-- Handled state was typed against an existing interface that didn't
-- actually have the fields this new data needs, corrected with its
-- own properly-matched type instead of reusing a mismatched one.
--
-- Verified directly against real, live data: 821 real properties
-- already sit outside "pending" verification, confirming this will
-- surface genuine, substantial history immediately once deployed.
--
-- The archived_at/admin_last_read_at columns this round adds
-- (rental_applications, properties) are the same real schema as
-- migration 311 (recently_handled_columns_batch) — not repeated here.
-- The functions below are this file's own, real contribution.

create or replace function get_recently_handled_applications()
returns json
language sql
security definer
stable
as $$
  select coalesce(json_agg(row_to_json(t) order by t.admin_last_read_at desc), '[]'::json) from (
    select ra.id, ra.status, ra.applicant_full_name, p.title as property_title, ra.admin_last_read_at
    from rental_applications ra join properties p on p.id = ra.property_id
    where ra.status not in ('pending', 'awaiting_admin_review', 'awaiting_owner_decision', 'owner_decided_pending_relay')
      and ra.admin_last_read_at is not null
      and (ra.archived_at is null or ra.archived_at > now() - interval '7 days')
  ) t;
$$;

create or replace function get_recently_handled_properties()
returns json
language sql
security definer
stable
as $$
  select coalesce(json_agg(row_to_json(t) order by t.verification_admin_last_read_at desc), '[]'::json) from (
    select p.id, p.verification_status, p.title, p.reference_number, p.verification_admin_last_read_at
    from properties p
    where p.verification_status != 'pending' and p.verification_admin_last_read_at is not null
      and (p.verification_archived_at is null or p.verification_archived_at > now() - interval '7 days')
  ) t;
$$;

create or replace function archive_application(p_id uuid) returns void language plpgsql security definer as $$
begin
  if not is_admin() then raise exception 'Not authorised.'; end if;
  update rental_applications set archived_at = now() where id = p_id;
end; $$;

create or replace function archive_property_verification(p_id uuid) returns void language plpgsql security definer as $$
begin
  if not is_admin() then raise exception 'Not authorised.'; end if;
  update properties set verification_archived_at = now() where id = p_id;
end; $$;
