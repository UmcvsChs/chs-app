-- Real, serious bug found during real user testing: submitting a
-- real ID number and document immediately self-certified as
-- "verified" the instant the fields were filled in — no admin review
-- ever happened, and no record was ever created for admin to see.
-- Fixed to match the exact same real, proven review pattern already
-- used for liveness verification.

create table buyer_id_verifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  id_type text not null,
  id_number text not null,
  id_document_url text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table buyer_id_verifications enable row level security;
create policy "buyer_id_own_read" on buyer_id_verifications for select using (auth.uid() = user_id);
create policy "buyer_id_own_insert" on buyer_id_verifications for insert with check (auth.uid() = user_id);
create policy "buyer_id_admin_all" on buyer_id_verifications for all using (staff_can_access('registration_setup'));

create or replace function submit_buyer_id_verification(p_id_type text, p_id_number text, p_id_document_url text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new_id uuid;
begin
  insert into buyer_id_verifications (user_id, id_type, id_number, id_document_url, status)
  values (auth.uid(), p_id_type, p_id_number, p_id_document_url, 'pending')
  returning id into v_new_id;

  update profiles set id_type = p_id_type, id_number = p_id_number, id_document_url = p_id_document_url
  where id = auth.uid();

  return v_new_id;
end;
$$;

create or replace function apply_admin_action(p_request_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  req record;
  v_property record;
  v_artisan record;
  interested record;
  v_vendor_user_id uuid;
  v_fee_amount numeric;
  v_balance numeric;
  v_reference text;
  v_developer_user_id uuid;
  v_id_verif_user_id uuid;
begin
  select * into req from admin_action_requests where id = p_request_id;

  if req.action_type = 'verify_property' then
    update properties set verification_status = req.proposed_changes->>'verification_status' where id = req.target_id
      returning * into v_property;
    perform notify_user(
      v_property.owner_id,
      case when req.proposed_changes->>'verification_status' = 'verified' then 'Your property listing is now live!'
           else 'Your property listing needs attention' end,
      case when req.proposed_changes->>'verification_status' = 'verified'
           then '"' || v_property.title || '" has been verified and is now publicly visible.'
           else '"' || v_property.title || '" could not be verified. Please contact CHS support for details.' end,
      '/property/' || v_property.id::text
    );
    if req.proposed_changes->>'verification_status' = 'verified' then
      for interested in select user_id from property_interest where property_id = req.target_id loop
        perform notify_user(
          interested.user_id,
          'A property you''re interested in is now verified!',
          '"' || v_property.title || '" is now CHS Verified — you can go ahead with what you were trying to do.',
          '/property/' || v_property.id::text
        );
      end loop;
    end if;

  elsif req.action_type = 'clear_sale' then
    update offers set chs_cleared = true where id = req.target_id;
    perform generate_sale_commissions(req.target_id);

  elsif req.action_type = 'approve_profile' then
    update profiles set status = req.proposed_changes->>'status' where id = req.target_id;
    perform notify_user(
      req.target_id,
      case when req.proposed_changes->>'status' = 'approved' then 'Your CHS account is approved!'
           else 'Your CHS registration needs attention' end,
      case when req.proposed_changes->>'status' = 'approved' then 'You can now fully use CHS.'
           else 'Your registration could not be approved. Please contact CHS support for details.' end
    );

  elsif req.action_type = 'review_liveness' then
    update liveness_submissions set status = req.proposed_changes->>'status' where id = req.target_id;
    if (req.proposed_changes->>'status') = 'approved' then
      update profiles set liveness_verified = true
        where id = (select user_id from liveness_submissions where id = req.target_id);
    end if;

  elsif req.action_type = 'review_buyer_id' then
    select user_id into v_id_verif_user_id from buyer_id_verifications where id = req.target_id;
    update buyer_id_verifications set status = req.proposed_changes->>'status', reviewed_by = auth.uid() where id = req.target_id;
    if req.proposed_changes->>'status' = 'approved' then
      update profiles set valid_id_verified = true where id = v_id_verif_user_id;
      perform notify_user(v_id_verif_user_id, '✓ Identity verified', 'Your identity has been verified — you can now make real offers on properties.');
    else
      perform notify_user(v_id_verif_user_id, 'Identity verification needs attention', 'Your ID submission could not be verified. Please contact CHS support or resubmit.');
    end if;

  elsif req.action_type = 'verify_artisan' then
    update artisans set verification_status = req.proposed_changes->>'verification_status' where id = req.target_id
      returning * into v_artisan;
    perform notify_user(
      v_artisan.user_id,
      case when req.proposed_changes->>'verification_status' = 'verified' then 'You''re now a verified CHS artisan!'
           else 'Your artisan registration needs attention' end,
      case when req.proposed_changes->>'verification_status' = 'verified'
           then 'You can now quote on real maintenance jobs matching your trade and location.'
           else 'Your registration could not be verified. Please contact CHS support for details.' end,
      '/artisan'
    );

  elsif req.action_type = 'verify_vendor' then
    update marketplace_vendors set verification_status = req.proposed_changes->>'verification_status' where id = req.target_id;

  elsif req.action_type = 'review_developer' then
    select user_id into v_developer_user_id from developer_applications where id = req.target_id;
    update developer_applications set status = req.proposed_changes->>'status' where id = req.target_id;
    if req.proposed_changes->>'status' = 'partnered' then
      update profiles set role = 'developer' where id = v_developer_user_id;
      perform notify_user(v_developer_user_id, 'You''re now a verified CHS developer!',
        'Your developer account is now active — you can list real projects and developments.');
    elsif req.proposed_changes->>'status' = 'reviewed' then
      perform notify_user(v_developer_user_id, 'Your developer application has been reviewed',
        'CHS is reviewing your application — you''ll hear back on next steps soon.');
    end if;

  elsif req.action_type = 'freeze_wallet' then
    update wallets set frozen = (req.proposed_changes->>'frozen')::boolean,
      frozen_reason = req.proposed_changes->>'frozen_reason' where user_id = req.target_id;

  elsif req.action_type = 'mark_referral_paid' then
    select mv.user_id, rf.amount into v_vendor_user_id, v_fee_amount
      from referral_fees_owed rf join marketplace_vendors mv on mv.id = rf.vendor_id
      where rf.id = req.target_id;
    select main_balance into v_balance from wallets where user_id = v_vendor_user_id;
    if v_balance is not null and v_balance >= v_fee_amount then
      v_reference := 'VREF-' || substr(gen_random_uuid()::text, 1, 8);
      update wallets set main_balance = main_balance - v_fee_amount, updated_at = now() where user_id = v_vendor_user_id;
      insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
      values (v_vendor_user_id, 'main', v_fee_amount, 'debit', 'Vendor referral fee', v_reference);
      update referral_fees_owed set status = 'paid' where id = req.target_id;
    else
      perform notify_user(v_vendor_user_id, '⚠️ Referral fee could not be collected',
        'A real referral fee of ' || v_fee_amount || ' is owed but your wallet balance is insufficient. Please fund your wallet.');
    end if;
  end if;
end;
$$;
