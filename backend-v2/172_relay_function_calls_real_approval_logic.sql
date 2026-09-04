-- Real, important correction to my own previous migration — my first
-- version of this function only set a status and sent a generic
-- notification, completely bypassing the real, substantial logic
-- that actually creates the tenancy, generates the real commission
-- records (standard or agent-managed), and updates the property
-- status. Rebuilt to genuinely call the correct, existing real
-- approval function instead of reimplementing (and losing) that
-- logic. Tested directly against a real, existing application: the
-- real tenancy and commission records were confirmed created
-- correctly, then cleaned up to restore the original test state.

create or replace function relay_owner_decision_to_tenant(p_application_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_decision text;
  v_property_id uuid;
  v_agent_pct numeric;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can relay a real owner decision.';
  end if;

  select tenant_id, owner_decision, property_id into v_tenant_id, v_decision, v_property_id
  from rental_applications where id = p_application_id;

  if v_decision is null then
    raise exception 'No real owner decision recorded yet for this application.';
  end if;

  if v_decision = 'approved' then
    select agent_commission_pct into v_agent_pct from properties where id = v_property_id;
    if v_agent_pct is not null then
      perform approve_rental_application_agent_managed(p_application_id);
    else
      perform approve_rental_application(p_application_id);
    end if;
  else
    update rental_applications set status = 'owner_declined' where id = p_application_id;
    perform notify_user(v_tenant_id, 'Update on your rental application',
      'The owner was not able to proceed with your application at this time.');
  end if;
end;
$$;
