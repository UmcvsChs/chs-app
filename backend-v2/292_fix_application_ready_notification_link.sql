-- Real, direct fix -- the single most critical instance of this
-- exact bug: the notification telling an owner their application is
-- genuinely "ready for your decision" was linking to the generic
-- /owner dashboard root instead of /owner-applications, where
-- applications actually live. Confirmed offers do NOT have this bug
-- -- they display inline on /owner itself, so that link was already
-- correct and was left untouched.

create or replace function admin_relay_application_to_owner(p_application_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_applicant_name text;
  v_property_title text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can relay a real application to the owner.';
  end if;

  select p.owner_id, p.title, ra.applicant_full_name
    into v_owner_id, v_property_title, v_applicant_name
    from rental_applications ra join properties p on p.id = ra.property_id
    where ra.id = p_application_id and ra.status = 'awaiting_admin_review';

  if v_owner_id is null then
    raise exception 'This real application is not currently awaiting admin review.';
  end if;

  update rental_applications set status = 'awaiting_owner_decision' where id = p_application_id;

  perform log_audit_event('relay_application_to_owner', 'rental_applications', p_application_id,
    v_applicant_name || ' — ' || v_property_title, null);

  perform notify_user(v_owner_id, '📋 A real rental application is ready for your decision',
    v_applicant_name || ' has applied for ' || v_property_title || '. CHS has reviewed and verified their guarantor — please review and decide.',
    '/owner-applications');
end;
$$;
