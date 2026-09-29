create or replace function link_managing_agent_by_id(p_property_id uuid, p_chs_agent_id text)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_agent_id uuid;
begin
  select owner_id into v_owner_id from properties where id = p_property_id;
  if v_owner_id != auth.uid() then
    raise exception 'Only the real property owner can link a managing agent.';
  end if;

  select id into v_agent_id from profiles where chs_agent_id = p_chs_agent_id and role = 'agent';
  if v_agent_id is null then
    raise exception 'No real, registered agent found with that CHS ID. Please double-check the ID with your agent.';
  end if;

  update properties set managing_agent_id = v_agent_id where id = p_property_id;

  perform notify_user(v_agent_id, '🤝 You''ve been granted management authority',
    'A real property owner has named you as the managing agent with full authority for one of their listings.', '/agent');
end;
$$;

create or replace function revoke_managing_agent(p_property_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_old_agent_id uuid;
  v_tenant_id uuid;
begin
  select owner_id, managing_agent_id into v_owner_id, v_old_agent_id from properties where id = p_property_id;

  if v_owner_id != auth.uid() then
    raise exception 'Only the real property owner can revoke a managing agent.';
  end if;
  if v_old_agent_id is null then
    raise exception 'This property has no real managing agent to revoke.';
  end if;

  update tenancies set manager_id = null, management_delegated = false
  where property_id = p_property_id and manager_id = v_old_agent_id;

  update properties set managing_agent_id = null where id = p_property_id;

  perform notify_user(v_old_agent_id, '⚠️ Management authority revoked',
    'The property owner has relieved you of management duty on this property. Your access to its tenant, notices, and maintenance tools has been removed immediately.', '/agent');

  select tenant_id into v_tenant_id from tenancies where property_id = p_property_id and status = 'active' limit 1;
  if v_tenant_id is not null then
    perform notify_user(v_tenant_id, 'ℹ️ A change in property management',
      'Your landlord has changed who manages this property on their behalf. You''ll be notified directly once a new arrangement is confirmed — for now, please reach your landlord through CHS as usual.', '/tenant');
  end if;
end;
$$;

create or replace function approve_agent_replacement(p_request_id uuid, p_agent_chs_id text)
returns void
language plpgsql
security definer
as $$
declare
  v_property_id uuid;
  v_owner_id uuid;
  v_agent_id uuid;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can approve a real agent replacement.';
  end if;

  select id into v_agent_id from profiles where chs_agent_id = p_agent_chs_id and role = 'agent';
  if v_agent_id is null then
    raise exception 'No real, registered agent found with that CHS ID.';
  end if;

  select property_id, owner_id into v_property_id, v_owner_id from agent_change_requests where id = p_request_id;

  update properties set managing_agent_id = v_agent_id where id = v_property_id;
  update tenancies set manager_id = v_agent_id, management_delegated = true
  where property_id = v_property_id and status = 'active';

  update agent_change_requests set status = 'approved', admin_reviewed_by = auth.uid(), reviewed_at = now() where id = p_request_id;

  perform notify_user(v_agent_id, '🤝 You''ve been granted management authority',
    'CHS has confirmed your identity and granted you full management authority on a real property.', '/agent');
  perform notify_user(v_owner_id, '✓ New agent confirmed',
    'CHS has verified and linked your new managing agent — they now have full access to manage this property on your behalf.', '/owner');
end;
$$;

create or replace function set_unit_owner_occupier(p_property_id uuid, p_occupant_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_estate_id uuid;
  v_manager_id uuid;
begin
  select estate_id into v_estate_id from properties where id = p_property_id;
  select manager_id into v_manager_id from estates where id = v_estate_id;

  if v_manager_id != auth.uid() and not is_admin() then
    raise exception 'Only this estate''s real manager can set unit occupancy.';
  end if;

  update properties set occupant_id = p_occupant_id, occupancy_type = 'owner_occupier' where id = p_property_id;

  perform notify_user(p_occupant_id, '🏠 Welcome to your estate unit',
    'You''ve been registered as the real owner-occupier of your unit. You''ll receive real service charge bills and can report maintenance faults directly through CHS.', '/tenant');
end;
$$;

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
    perform notify_user(v_user_id, '✓ Your appeal was approved', p_response, '/profile');
  else
    perform notify_user(v_user_id, '⚠️ Your appeal was not approved', p_response, '/profile');
  end if;
end;
$$;

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

  perform notify_user(p_user_id, '⚠️ Your CHS account has been suspended', p_reason || ' If you believe this is a mistake, you can submit a real appeal from the app.', '/profile');
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
  perform notify_user(p_user_id, '✓ Your CHS account has been reactivated', 'Your real access to CHS has been fully restored.', '/profile');
end;
$$;

create or replace function invite_team_member(p_phone text, p_role_label text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_member_id uuid;
  v_new_id uuid;
  v_current_staff_count int;
begin
  select id into v_member_id from profiles where phone = p_phone;
  if v_member_id is null then
    raise exception 'No CHS account found with that phone number yet. Ask them to register at chs — choosing "Staff / Employee" as their role — then add them here using the same phone number.';
  end if;
  if v_member_id = auth.uid() then
    raise exception 'You cannot add yourself as your own team member.';
  end if;

  select count(*) into v_current_staff_count from team_members where parent_id = auth.uid() and status = 'active';
  if v_current_staff_count >= 2 and not has_active_team_subscription(auth.uid()) then
    raise exception 'subscription_required';
  end if;

  insert into team_members (parent_id, member_id, role_label)
  values (auth.uid(), v_member_id, p_role_label)
  on conflict (parent_id, member_id) do update set role_label = p_role_label, status = 'active'
  returning id into v_new_id;

  perform notify_user(v_member_id, '👥 You''ve been added to a real team',
    'You''ve been added as "' || p_role_label || '" — log in any time and go to "My Staff Dashboard" to see your real assignments and submit your daily report.', '/staff');

  return v_new_id;
end;
$$;

create or replace function host_decide_shortlet_booking(p_booking_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_property_id uuid;
  v_host_id uuid;
  v_guest_id uuid;
  v_total_price numeric;
  v_guest_commission numeric;
  v_property_title text;
begin
  select sb.property_id, sb.guest_id, sb.total_price, sb.guest_commission_amount
    into v_property_id, v_guest_id, v_total_price, v_guest_commission
    from shortlet_bookings sb where sb.id = p_booking_id;

  select owner_id, title into v_host_id, v_property_title from properties where id = v_property_id;

  if v_host_id != auth.uid() then
    raise exception 'You are not the real host of this property.';
  end if;
  if p_decision not in ('confirmed', 'declined') then
    raise exception 'Not a real, recognized decision.';
  end if;

  if p_decision = 'declined' then
    update shortlet_bookings set status = 'declined', payment_status = 'refunded', host_decision_note = p_note where id = p_booking_id;
    update wallets set main_balance = main_balance + v_total_price + v_guest_commission, updated_at = now() where user_id = v_guest_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
      values (v_guest_id, 'main', v_total_price + v_guest_commission, 'credit', 'Real refund — host declined your booking request', 'DEC-' || substr(p_booking_id::text, 1, 8));
    perform notify_user(v_guest_id, 'Your booking request was declined',
      'The host was not able to accept your request for ' || v_property_title || '. You have been fully, automatically refunded.' || coalesce(E'\nNote: ' || p_note, ''), '/my-bookings');
  else
    update shortlet_bookings set status = 'confirmed', host_decision_note = p_note where id = p_booking_id;
    perform generate_shortlet_commission(p_booking_id);
    perform notify_user(v_guest_id, '🎉 Your booking was accepted',
      'The host has confirmed your booking for ' || v_property_title || '.' || coalesce(E'\nNote: ' || p_note, ''), '/my-bookings');
  end if;
end;
$$;

create or replace function resolve_security_deposit(p_booking_id uuid, p_decision text, p_reason text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_guest_id uuid;
  v_host_id uuid;
  v_deposit numeric;
  v_status text;
  v_property_id uuid;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can resolve a real security deposit.';
  end if;

  select sb.guest_id, sb.security_deposit_amount, sb.security_deposit_status, sb.property_id
    into v_guest_id, v_deposit, v_status, v_property_id
    from shortlet_bookings sb where sb.id = p_booking_id;

  select owner_id into v_host_id from properties where id = v_property_id;

  if v_status != 'held' then
    raise exception 'This real deposit is not currently held or has already been resolved.';
  end if;
  if p_decision not in ('released_to_guest', 'claimed_by_host') then
    raise exception 'Not a real, recognized decision.';
  end if;

  if p_decision = 'released_to_guest' then
    update wallets set main_balance = main_balance + v_deposit, updated_at = now() where user_id = v_guest_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
      values (v_guest_id, 'main', v_deposit, 'credit', 'Real security deposit released — no damage claimed', 'DEP-' || substr(p_booking_id::text, 1, 8));
    perform notify_user(v_guest_id, '✓ Your real security deposit was released', 'Your full deposit has been credited back to your wallet.', '/my-bookings');
  else
    update wallets set main_balance = main_balance + v_deposit, updated_at = now() where user_id = v_host_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
      values (v_host_id, 'main', v_deposit, 'credit', 'Real security deposit claimed — ' || coalesce(p_reason, 'damage reported'), 'DEP-' || substr(p_booking_id::text, 1, 8));
    perform notify_user(v_guest_id, 'Your real security deposit was claimed', 'Reason: ' || coalesce(p_reason, 'Damage reported by host.'), '/my-bookings');
  end if;

  update shortlet_bookings set security_deposit_status = p_decision where id = p_booking_id;
end;
$$;

create or replace function request_management_termination(p_tenancy_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_landlord_id uuid;
  v_manager_id uuid;
  v_new_id uuid;
begin
  select landlord_id, manager_id into v_landlord_id, v_manager_id from tenancies where id = p_tenancy_id;

  if v_landlord_id != auth.uid() and not is_admin() then
    raise exception 'Only the real property owner can request ending management delegation.';
  end if;

  insert into management_termination_requests (tenancy_id, requested_by, reason, notice_period_ends_at, status)
  values (p_tenancy_id, auth.uid(), p_reason, now() + interval '30 days', 'pending')
  returning id into v_new_id;

  if v_manager_id is not null then
    perform notify_user(v_manager_id, '📋 Management termination requested',
      'The owner has requested to end your management of this property, effective in 30 days real notice.', '/manager');
  end if;

  return v_new_id;
end;
$$;

create or replace function mark_documents_dispatched(p_offer_id uuid, p_method text, p_tracking text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_seller_id uuid;
  v_buyer_id uuid;
  v_property_id uuid;
begin
  select o.buyer_id, o.property_id into v_buyer_id, v_property_id from offers o where o.id = p_offer_id;
  select owner_id into v_seller_id from properties where id = v_property_id;

  if v_seller_id != auth.uid() then
    raise exception 'Only the real property owner can mark documents as dispatched.';
  end if;

  update document_dispatch_requests set status = 'dispatched', dispatch_method = p_method, tracking_reference = p_tracking, dispatched_at = now()
  where offer_id = p_offer_id;

  perform notify_user(v_buyer_id, '📦 Your real documents are on the way',
    'The seller has marked your legal documents as dispatched via ' || p_method || coalesce(' (tracking: ' || p_tracking || ')', '') || '. Please confirm once you genuinely receive them.',
    '/property/' || v_property_id);
end;
$$;

create or replace function confirm_documents_received(p_offer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_property_id uuid;
  v_held_amount numeric;
begin
  select buyer_id, property_id into v_buyer_id, v_property_id from offers where id = p_offer_id;
  if v_buyer_id != auth.uid() then
    raise exception 'Only the real buyer on this offer can confirm this.';
  end if;

  select owner_id into v_seller_id from properties where id = v_property_id;

  update document_dispatch_requests set status = 'received' where offer_id = p_offer_id;

  select escrow_held into v_held_amount from wallets where user_id = v_seller_id;
  if v_held_amount is null or v_held_amount <= 0 then
    raise exception 'No real held funds found for this seller.';
  end if;

  update wallets set escrow_held = 0, main_balance = main_balance + v_held_amount, updated_at = now() where user_id = v_seller_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
  values (v_seller_id, 'main', v_held_amount, 'credit', 'Sale proceeds released — buyer confirmed real document receipt', 'RELEASE-' || substr(gen_random_uuid()::text, 1, 8));

  update offers set legal_transfer_confirmed = true where id = p_offer_id;

  perform notify_user(v_seller_id, '✓ Funds released!',
    'The buyer has confirmed genuine receipt of the real legal documents. Your ' || v_held_amount || ' is now in your main wallet and available to withdraw.', '/wallet');
end;
$$;

create or replace function add_linked_bank_account(p_bank_name text, p_bank_code text, p_account_number text, p_account_name text, p_replace_existing boolean default false)
returns uuid
language plpgsql
security definer
as $$
declare
  v_role text;
  v_secondary_roles text[];
  v_is_agent_or_manager boolean;
  v_existing_count int;
  v_new_id uuid;
  v_effective_at timestamptz;
begin
  select role, secondary_roles into v_role, v_secondary_roles from profiles where id = auth.uid();
  v_is_agent_or_manager := v_role in ('agent', 'manager') or 'agent' = any(v_secondary_roles) or 'manager' = any(v_secondary_roles);

  select count(*) into v_existing_count from linked_bank_accounts where user_id = auth.uid();

  if v_existing_count >= 1 and not v_is_agent_or_manager and not p_replace_existing then
    raise exception 'Only agents and property managers can link more than one real bank account.';
  end if;
  if v_existing_count >= 4 and not p_replace_existing then
    raise exception 'A maximum of 4 real bank accounts can be linked.';
  end if;

  v_effective_at := now() + interval '48 hours';

  if p_replace_existing then
    delete from pending_bank_account_changes where user_id = auth.uid() and status = 'pending';
  end if;

  insert into pending_bank_account_changes (user_id, bank_name, bank_code, account_number, account_name, status, effective_at, replaces_existing)
  values (auth.uid(), p_bank_name, p_bank_code, p_account_number, p_account_name, 'pending', v_effective_at, p_replace_existing)
  returning id into v_new_id;

  perform notify_user(auth.uid(), '⏳ New bank account pending — 48-hour protection window',
    'Your request to link ' || p_bank_name || ' will take effect in 48 real hours. If you did not request this, contact CHS support immediately.', '/profile');

  return v_new_id;
end;
$$;
