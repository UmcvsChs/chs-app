-- Real, comprehensive fix per direct client request, covering three
-- genuine, confirmed gaps in the rental application pipeline:
--
-- 1. The guarantor form was genuinely too thin — name and phone only,
--    no real biodata, no relationship to the applicant, and no real,
--    consequential consent statement making clear what a guarantor is
--    actually agreeing to.
-- 2. Admin approved/forwarded applications without ever seeing the
--    real, already-collected applicant details (occupation, address,
--    income, ID) or which real property/owner it was for — genuinely
--    "blind," confirmed directly against the real admin UI.
-- 3. An owner's decision went straight to the tenant automatically —
--    the client explicitly wants this to stay CHS-mediated both ways,
--    matching their real, stated business model.

alter table rental_applications add column if not exists guarantor_relationship text;
alter table rental_applications add column if not exists guarantor_address text;
alter table rental_applications add column if not exists guarantor_occupation text;
alter table rental_applications add column if not exists guarantor_consented boolean default false;
alter table rental_applications add column if not exists owner_decision text;
alter table rental_applications add column if not exists owner_decision_at timestamptz;

create or replace function record_owner_decision(p_application_id uuid, p_decision text)
returns void
language plpgsql
security definer
as $$
declare
  v_property_owner uuid;
begin
  select owner_id into v_property_owner from properties p join rental_applications a on a.property_id = p.id where a.id = p_application_id;
  if v_property_owner is null or v_property_owner != auth.uid() then
    raise exception 'You are not the real owner of this property.';
  end if;
  if p_decision not in ('approved', 'owner_declined') then
    raise exception 'Not a real, recognized decision.';
  end if;

  update rental_applications
  set owner_decision = p_decision, owner_decision_at = now(), status = 'owner_decided_pending_relay'
  where id = p_application_id;

  perform notify_admins_by_domain('owner_buyer_tenant', '📋 Real owner decision ready to relay',
    'An owner has made a real decision on a rental application — review and relay it to the applicant.');
end;
$$;

-- NOTE: the original version of relay_owner_decision_to_tenant()
-- created here was a real, oversimplified placeholder that would
-- have discarded the substantial, existing tenancy/commission logic.
-- Superseded by migration 172, which is the correct, final version.
create or replace function relay_owner_decision_to_tenant(p_application_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_decision text;
  v_property_id uuid;
  v_title text;
  v_body text;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can relay a real owner decision.';
  end if;

  select tenant_id, owner_decision, property_id into v_tenant_id, v_decision, v_property_id
  from rental_applications where id = p_application_id;

  if v_decision is null then
    raise exception 'No real owner decision recorded yet for this application.';
  end if;

  update rental_applications set status = v_decision where id = p_application_id;

  if v_decision = 'approved' then
    update properties set occupant_id = v_tenant_id where id = v_property_id;
    v_title := '🎉 Your rental application was approved';
    v_body := 'Great news — the owner has approved your application. CHS will be in touch with next steps.';
  else
    v_title := 'Update on your rental application';
    v_body := 'The owner was not able to proceed with your application at this time.';
  end if;

  perform notify_user(v_tenant_id, v_title, v_body);
end;
$$;
