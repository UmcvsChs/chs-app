-- 475 — Mortgage (Rent to Own): every decision and payment goes through CHS; final payment held until documents are handed over (applied October 2026)
-- FIX (same evening): get_rto_admin_queue() originally used json_agg(x order by x.sort_at), which is invalid SQL at run time, so the admin queue returned an error. Corrected to json_agg(t.x order by t.sort_at) and applied live.
-- 1. Owner approve / decline no longer reach the buyer directly. New statuses owner_approved / owner_declined: CHS is told, and
--    admin_relay_rto_decision() passes the decision to the buyer. The admin queue now lists EVERY agreement (newest first) and never drops one.
-- 2. Buyer details (name, phone, occupation, source of funds, address) are collected BEFORE the request is sent: request_rent_to_own() takes them.
--    The phone is kept in rto_applicant_contacts (CHS only). The owner sees "Alex P." only (public_display_name); applicant_full_name is column-hidden from owners.
-- 3. pay_rent_to_own(agreement, amount): any amount from one installment up to the whole balance ("crash pay"). Earlier payments go to the owner's wallet at once
--    (audit-logged); the FINAL payment is held in the owner's escrow_held until the documents are handed over. pay_rent_to_own_installment() is kept as a wrapper.
-- 4. Document handover: request_rto_documents (recipient, address, phone, method, max days) -> rto_mark_documents_sent (proof) ->
--    confirm_rto_documents_received (buyer) or admin_release_rto_final (CHS verified). Phone visible to CHS only. get_rto_handover() returns role-safe JSON.
-- 5. get_owner_earnings_detailed() now includes rent_to_own income; names of sale buyers are shown as "Alex P.". owner_offers shows the buyer as "Alex P.".
-- 6. Notifications in this flow all carry a link, so the bell opens them.

create or replace function public_display_name(p text) returns text language sql immutable as $$
  select case
    when p is null or btrim(p) = '' then 'A verified buyer'
    when position(' ' in btrim(p)) = 0 then btrim(p)
    else split_part(btrim(p), ' ', 1) || ' ' || upper(left(regexp_replace(btrim(p), '^.*\s', ''), 1)) || '.'
  end $$;

alter table rent_to_own_agreements drop constraint if exists rent_to_own_agreements_status_check;
alter table rent_to_own_agreements add constraint rent_to_own_agreements_status_check check (status in
  ('awaiting_admin_relay','requested','owner_approved','owner_declined','active','awaiting_handover','completed','defaulted','cancelled','declined'));

alter table rent_to_own_agreements
  add column if not exists applicant_full_name text,
  add column if not exists applicant_occupation text,
  add column if not exists applicant_source_of_funds text,
  add column if not exists applicant_address text,
  add column if not exists owner_decision_at timestamptz,
  add column if not exists owner_decision_note text,
  add column if not exists final_held_amount numeric not null default 0,
  add column if not exists final_paid_at timestamptz;
alter table rent_to_own_payments add column if not exists held boolean not null default false;

-- the owner cannot read the applicant's full name straight from the table
revoke select on rent_to_own_agreements from authenticated, anon;
grant select (id, property_id, buyer_id, seller_id, total_price, monthly_amount, portion_pct, total_paid, ownership_pct, status, started_at,
  completed_at, admin_note, relayed_at, applicant_occupation, applicant_source_of_funds, applicant_address, owner_decision_at, owner_decision_note,
  final_held_amount, final_paid_at) on rent_to_own_agreements to authenticated;

create table if not exists rto_applicant_contacts (agreement_id uuid primary key references rent_to_own_agreements(id) on delete cascade, phone text not null);
alter table rto_applicant_contacts enable row level security;
revoke all on rto_applicant_contacts from authenticated, anon;

create table if not exists rto_handovers (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null unique references rent_to_own_agreements(id) on delete cascade,
  requested_by uuid not null,
  recipient_name text not null, delivery_address text not null, delivery_phone text not null, preferred_method text not null,
  max_days int not null check (max_days between 1 and 60),
  deadline timestamptz not null,
  status text not null default 'requested' check (status in ('requested','sent','confirmed')),
  sent_at timestamptz, sent_method text, tracking_reference text, proof_note text, proof_url text,
  confirmed_at timestamptz, confirmed_by text,
  created_at timestamptz not null default now());
alter table rto_handovers enable row level security;
revoke all on rto_handovers from authenticated, anon;

-- ---------- request: details first ----------
drop function if exists request_rent_to_own(uuid);
create or replace function request_rent_to_own(p_property_id uuid, p_full_name text, p_phone text, p_occupation text, p_source_of_funds text, p_address text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_seller_id uuid; v_price numeric; v_monthly numeric; v_portion_pct numeric; v_new_id uuid; v_existing text; v_title text;
begin
  if coalesce(length(btrim(p_full_name)), 0) < 3 or coalesce(length(btrim(p_phone)), 0) < 10 or coalesce(length(btrim(p_occupation)), 0) < 2
     or coalesce(length(btrim(p_source_of_funds)), 0) < 2 or coalesce(length(btrim(p_address)), 0) < 5 then
    raise exception 'Please fill in all your details (full name, phone, occupation, source of funds and address) before sending your request.';
  end if;
  select owner_id, price, rent_to_own_monthly, rent_to_own_portion_pct, title into v_seller_id, v_price, v_monthly, v_portion_pct, v_title
    from properties where id = p_property_id and purpose = 'rent_to_own' and status = 'active';
  if v_seller_id is null then raise exception 'This property is not available for Rent-to-Own.'; end if;
  if v_monthly is null or v_price is null then raise exception 'This property has no real rent-to-own terms configured.'; end if;
  if v_seller_id = auth.uid() then raise exception 'You cannot request your own property.'; end if;
  if exists (select 1 from rent_to_own_agreements where property_id = p_property_id and status in ('active','owner_approved','awaiting_handover')) then
    raise exception 'This property already has a Rent-to-Own agreement with another buyer, so it is no longer available.';
  end if;
  select status into v_existing from rent_to_own_agreements where property_id = p_property_id and buyer_id = auth.uid() order by started_at desc nulls last limit 1;
  if v_existing in ('awaiting_admin_relay','requested','owner_approved','owner_declined','active','awaiting_handover') then
    raise exception 'You already have a Rent-to-Own request on this property, and it is still in progress.';
  end if;
  if v_existing is not null then raise exception 'You have already had a Rent-to-Own agreement on this property (%), so a new request cannot be made.', v_existing; end if;
  insert into rent_to_own_agreements (property_id, buyer_id, seller_id, total_price, monthly_amount, portion_pct, status, applicant_full_name, applicant_occupation, applicant_source_of_funds, applicant_address)
    values (p_property_id, auth.uid(), v_seller_id, v_price, v_monthly, coalesce(v_portion_pct, 100), 'awaiting_admin_relay', btrim(p_full_name), btrim(p_occupation), btrim(p_source_of_funds), btrim(p_address))
    returning id into v_new_id;
  insert into rto_applicant_contacts (agreement_id, phone) values (v_new_id, btrim(p_phone));
  perform notify_admins_by_domain('owner_buyer_tenant', '🏠 New Rent-to-Own request to relay',
    btrim(p_full_name) || ' wants to start a Rent-to-Own agreement on ' || v_title || ' (' || fmt_naira(v_monthly) || ' a month toward ' || fmt_naira(v_price) || '). Review it and relay it to the owner, or reject it with a reason. Ref RTO-' || substr(v_new_id::text, 1, 8) || '.', '/admin?tab=rtorequests');
  perform notify_user(auth.uid(), 'Rent-to-Own request received', 'CHS has received your request for ' || v_title || ' and will review it and pass it to the owner. Nothing has been charged. Ref RTO-' || substr(v_new_id::text, 1, 8) || '.', '/rent-to-own');
  return v_new_id;
end $$;

-- ---------- relay to the owner (name as initial only) ----------
create or replace function admin_relay_rent_to_own(p_agreement_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a record; v_title text;
begin
  if not is_admin() then raise exception 'Only CHS staff can relay a Rent-to-Own request.'; end if;
  select * into a from rent_to_own_agreements where id = p_agreement_id for update;
  if not found then raise exception 'This request does not exist.'; end if;
  if a.status <> 'awaiting_admin_relay' then raise exception 'This request is not waiting for CHS to relay it (it is now: %).', a.status; end if;
  if exists (select 1 from rent_to_own_agreements where property_id = a.property_id and status in ('active','owner_approved','awaiting_handover')) then
    raise exception 'This property already has an agreement in progress, so this request cannot be relayed. Reject it instead.';
  end if;
  select title into v_title from properties where id = a.property_id;
  update rent_to_own_agreements set status = 'requested', relayed_at = now(), admin_note = nullif(trim(coalesce(p_note, '')), '') where id = a.id;
  perform notify_user(a.seller_id, '🏠 A Rent-to-Own request for your property',
    public_display_name(coalesce(a.applicant_full_name, (select full_name from profiles where id = a.buyer_id))) || ' has applied to continue the mortgage process for ' || v_title || ' and has been verified by CHS. ' ||
    fmt_naira(a.monthly_amount) || ' a month toward ' || fmt_naira(a.total_price) || '. Ref RTO-' || substr(a.id::text, 1, 8) || '. Please approve or decline it on your dashboard. Contact with the buyer goes through CHS.', '/owner');
  perform notify_user(a.buyer_id, 'Your Rent-to-Own request has gone to the owner', 'CHS has reviewed your request for ' || v_title || ' and passed it to the owner. CHS will tell you as soon as the owner decides. Nothing has been charged.', '/rent-to-own');
  perform log_audit_event('admin_relayed_rent_to_own', 'rent_to_own_agreements', a.id, 'RTO-' || substr(a.id::text, 1, 8), null);
end $$;

-- ---------- owner decides: CHS hears first ----------
create or replace function approve_rent_to_own_request(p_agreement_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare a record; v_title text;
begin
  select * into a from rent_to_own_agreements where id = p_agreement_id for update;
  if not found then raise exception 'This Rent-to-Own request does not exist.'; end if;
  if a.seller_id <> auth.uid() and not is_admin() then raise exception 'Only the real property owner can approve this request.'; end if;
  if a.status = 'awaiting_admin_relay' then raise exception 'CHS is still reviewing this request and will pass it to you shortly.'; end if;
  if a.status <> 'requested' then raise exception 'This request is no longer waiting for approval (it is now: %).', a.status; end if;
  if exists (select 1 from rent_to_own_agreements where property_id = a.property_id and status in ('active','owner_approved','awaiting_handover') and id <> a.id) then
    raise exception 'This property already has an agreement in progress with another buyer. A property can only have one.';
  end if;
  select title into v_title from properties where id = a.property_id;
  update rent_to_own_agreements set status = 'owner_approved', owner_decision_at = now() where id = a.id;
  perform notify_user(a.seller_id, '✓ Your approval was received', 'Thank you. CHS will confirm your approval to the buyer and start the agreement for ' || v_title || '. You will be told when payments begin.', '/owner');
  perform notify_admins_by_domain('owner_buyer_tenant', '✅ Owner APPROVED a Rent-to-Own request — please confirm it to the buyer', v_title || ' (RTO-' || substr(a.id::text, 1, 8) || '). The buyer has not been told yet. Open Rent-to-Own Requests and tap Confirm to buyer.', '/admin?tab=rtorequests');
  perform log_audit_event('owner_approved_rent_to_own', 'rent_to_own_agreements', a.id, 'RTO-' || substr(a.id::text, 1, 8), null);
end $$;

create or replace function decline_rent_to_own_request(p_agreement_id uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare a record; v_title text; v_reason text := nullif(trim(coalesce(p_reason, '')), ''); v_block text;
begin
  if v_reason is null or length(v_reason) < 5 then raise exception 'Please give a short reason; CHS will pass it to the buyer.'; end if;
  v_block := detect_offplatform_contact(v_reason);
  if v_block is not null then raise exception '% Please keep contact details out of your reason.', v_block; end if;
  select * into a from rent_to_own_agreements where id = p_agreement_id for update;
  if not found then raise exception 'This request does not exist.'; end if;
  if a.seller_id <> auth.uid() and not is_admin() then raise exception 'Only the owner of this property can decline this request.'; end if;
  if a.status = 'awaiting_admin_relay' then raise exception 'CHS is still reviewing this request. You will be able to answer it once CHS passes it to you.'; end if;
  if a.status <> 'requested' then raise exception 'This request is no longer waiting for your answer (it is now: %).', a.status; end if;
  select title into v_title from properties where id = a.property_id;
  update rent_to_own_agreements set status = 'owner_declined', owner_decision_at = now(), owner_decision_note = v_reason where id = a.id;
  perform notify_user(a.seller_id, 'Your answer was received', 'CHS will pass your decision on ' || v_title || ' to the buyer.', '/owner');
  perform notify_admins_by_domain('owner_buyer_tenant', '❌ Owner DECLINED a Rent-to-Own request — please tell the buyer', v_title || ' (RTO-' || substr(a.id::text, 1, 8) || '): ' || v_reason || ' The buyer has not been told yet.', '/admin?tab=rtorequests');
  perform log_audit_event('owner_declined_rent_to_own', 'rent_to_own_agreements', a.id, v_reason, null);
end $$;

create or replace function admin_relay_rto_decision(p_agreement_id uuid, p_note text default null) returns void language plpgsql security definer set search_path = public as $$
declare a record; r record; v_title text;
begin
  if not is_admin() then raise exception 'Only CHS staff can pass the owner''s decision to the buyer.'; end if;
  select * into a from rent_to_own_agreements where id = p_agreement_id for update;
  if not found then raise exception 'This request does not exist.'; end if;
  select title into v_title from properties where id = a.property_id;
  if a.status = 'owner_approved' then
    if exists (select 1 from rent_to_own_agreements where property_id = a.property_id and status in ('active','awaiting_handover') and id <> a.id) then
      raise exception 'Another agreement is already running on this property.';
    end if;
    update rent_to_own_agreements set status = 'active', started_at = now(), admin_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), admin_note) where id = a.id;
    perform notify_user(a.buyer_id, '✓ Rent-to-Own agreement approved!', 'CHS confirms the owner has approved your agreement on ' || v_title || '. Monthly payments of ' || fmt_naira(a.monthly_amount) || ' can begin now. Every payment goes through your CHS wallet.', '/rent-to-own');
    for r in select id, buyer_id from rent_to_own_agreements where property_id = a.property_id and status in ('requested','awaiting_admin_relay','owner_approved','owner_declined') and id <> a.id loop
      update rent_to_own_agreements set status = 'declined' where id = r.id;
      perform notify_user(r.buyer_id, 'Rent-to-Own request not taken forward', 'The owner has agreed an arrangement with another buyer for ' || coalesce(v_title, 'this property') || ', so it is no longer available. Nothing was charged.', '/rent-to-own');
    end loop;
    perform notify_user(a.seller_id, 'Agreement started', 'CHS has confirmed your approval to the buyer. Payments begin now and reach your wallet through CHS.', '/owner');
    perform log_audit_event('admin_relayed_rto_approval', 'rent_to_own_agreements', a.id, 'RTO-' || substr(a.id::text, 1, 8), null);
  elsif a.status = 'owner_declined' then
    update rent_to_own_agreements set status = 'declined', admin_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), a.owner_decision_note) where id = a.id;
    perform notify_user(a.buyer_id, 'Your Rent-to-Own request was declined', 'The owner of ' || v_title || ' has declined your request. Reason: ' || coalesce(a.owner_decision_note, 'not given') || '. Nothing was charged. You are welcome to look at other properties.', '/rent-to-own');
    perform log_audit_event('admin_relayed_rto_decline', 'rent_to_own_agreements', a.id, coalesce(a.owner_decision_note, ''), null);
  else
    raise exception 'There is no owner decision waiting to be passed on (this one is: %).', a.status;
  end if;
end $$;

-- ---------- admin queue: everything, newest first ----------
create or replace function get_rto_admin_queue() returns json language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Not authorised: CHS admins only.'; end if;
  return (select coalesce(json_agg(t.x order by t.sort_at desc), '[]'::json) from (
    select a.started_at as sort_at, json_build_object(
      'id', a.id, 'ref', 'RTO-' || substr(a.id::text, 1, 8), 'status', a.status,
      'needs_action', (a.status in ('awaiting_admin_relay','owner_approved','owner_declined') or coalesce(h.status, '') = 'sent'),
      'property_title', p.title, 'property_ref', p.reference_number, 'location', p.location_area,
      'total_price', a.total_price, 'monthly_amount', a.monthly_amount, 'total_paid', a.total_paid, 'ownership_pct', a.ownership_pct,
      'payments', case when a.monthly_amount > 0 then ceil(a.total_price / a.monthly_amount) end,
      'payments_made', (select count(*) from rent_to_own_payments x where x.agreement_id = a.id),
      'last_payment_at', (select max(paid_at) from rent_to_own_payments x where x.agreement_id = a.id),
      'buyer_name', coalesce(a.applicant_full_name, b.full_name), 'buyer_phone', coalesce(c.phone, b.phone),
      'applicant_occupation', a.applicant_occupation, 'applicant_source_of_funds', a.applicant_source_of_funds, 'applicant_address', a.applicant_address,
      'buyer_id_verified', coalesce(b.valid_id_verified, false) and coalesce(b.liveness_verified, false),
      'owner_name', o.full_name, 'owner_phone', o.phone, 'requested_at', a.started_at, 'relayed_at', a.relayed_at,
      'owner_decision_at', a.owner_decision_at, 'owner_decision_note', a.owner_decision_note,
      'competing_requests', (select count(*) from rent_to_own_agreements y where y.property_id = a.property_id and y.id <> a.id and y.status in ('awaiting_admin_relay','requested','owner_approved')),
      'final_held_amount', a.final_held_amount,
      'handover', case when h.id is null then null else json_build_object('status', h.status, 'recipient_name', h.recipient_name, 'delivery_address', h.delivery_address,
        'delivery_phone', h.delivery_phone, 'method', h.preferred_method, 'max_days', h.max_days, 'deadline', h.deadline, 'overdue', (h.status <> 'confirmed' and now() > h.deadline),
        'sent_at', h.sent_at, 'sent_method', h.sent_method, 'tracking', h.tracking_reference, 'proof_note', h.proof_note, 'proof_url', h.proof_url, 'confirmed_at', h.confirmed_at) end
    ) as x
    from rent_to_own_agreements a
    join properties p on p.id = a.property_id join profiles b on b.id = a.buyer_id join profiles o on o.id = a.seller_id
    left join rto_applicant_contacts c on c.agreement_id = a.id left join rto_handovers h on h.agreement_id = a.id
  ) t);
end $$;

-- ---------- payment: any amount up to the balance; final payment held ----------
create or replace function pay_rent_to_own(p_agreement_id uuid, p_amount numeric default null) returns json language plpgsql security definer set search_path = public as $$
declare a record; v_remaining numeric; v_min numeric; v_amt numeric; v_buyer_pct numeric; v_seller_pct numeric; v_bc numeric; v_sc numeric; v_total numeric; v_net numeric;
  v_balance numeric; v_ref text; v_gain numeric; v_pid uuid; v_new_paid numeric; v_new_own numeric; v_done boolean; v_title text; v_name text;
begin
  select * into a from rent_to_own_agreements where id = p_agreement_id and status = 'active' for update;
  if not found then raise exception 'There is no active Rent-to-Own agreement to pay into — it may not have been approved yet, or it is already fully paid.'; end if;
  if a.buyer_id <> auth.uid() then raise exception 'Only the real buyer on this agreement can make this payment.'; end if;
  v_remaining := a.total_price - a.total_paid;
  if v_remaining <= 0 then raise exception 'This property has already been paid for in full.'; end if;
  v_min := least(a.monthly_amount, v_remaining);
  v_amt := coalesce(p_amount, v_min);
  if v_amt < v_min then raise exception 'The smallest payment is %.', fmt_naira(v_min); end if;
  if v_amt > v_remaining then raise exception 'You owe %, so a payment can be at most that.', fmt_naira(v_remaining); end if;
  select value::numeric into v_buyer_pct from platform_settings where key = 'rent_to_own_buyer_commission_pct';
  select value::numeric into v_seller_pct from platform_settings where key = 'rent_to_own_seller_commission_pct';
  v_bc := round(v_amt * coalesce(v_buyer_pct, 0) / 100, 2); v_sc := round(v_amt * coalesce(v_seller_pct, 0) / 100, 2);
  v_total := v_amt + v_bc; v_net := v_amt - v_sc;
  select main_balance into v_balance from wallets where user_id = auth.uid() for update;
  if v_balance is null or v_balance < v_total then raise exception 'insufficient_balance'; end if;
  v_ref := 'RTO-' || substr(gen_random_uuid()::text, 1, 8);
  v_gain := round((v_amt / a.total_price) * a.portion_pct, 3);
  v_new_paid := a.total_paid + v_amt;
  v_new_own := least(100, round((v_new_paid / a.total_price) * a.portion_pct, 3));
  v_done := v_new_paid >= a.total_price;
  select title into v_title from properties where id = a.property_id;
  select coalesce(a.applicant_full_name, full_name) into v_name from profiles where id = a.buyer_id;

  update wallets set main_balance = main_balance - v_total, updated_at = now() where user_id = a.buyer_id;
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (a.buyer_id, 'main', v_total, 'debit', 'Rent-to-Own payment (' || fmt_naira(v_amt) || ' + your ' || fmt_naira(v_bc) || ' commission)', v_ref);
  if v_done then
    update wallets set escrow_held = escrow_held + v_net, updated_at = now() where user_id = a.seller_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
      values (a.seller_id, 'escrow_held', v_net, 'credit', 'Final Rent-to-Own payment — held by CHS until the property documents are handed over', v_ref);
  else
    update wallets set main_balance = main_balance + v_net, updated_at = now() where user_id = a.seller_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
      values (a.seller_id, 'main', v_net, 'credit', 'Rent-to-Own payment released by CHS, net of your commission', v_ref);
  end if;
  insert into rent_to_own_payments (agreement_id, amount, ownership_pct_gained, reference, held) values (p_agreement_id, v_amt, v_gain, v_ref, v_done) returning id into v_pid;
  update rent_to_own_agreements set total_paid = v_new_paid, ownership_pct = v_new_own where id = a.id;
  insert into transaction_commissions (transaction_type, rent_to_own_payment_id, property_id, payer_id, payer_role, base_amount, commission_percentage, commission_amount, status, paid_at)
    values ('rent_to_own', v_pid, a.property_id, a.buyer_id, 'buyer', v_amt, coalesce(v_buyer_pct, 0), v_bc, 'paid', now()),
           ('rent_to_own', v_pid, a.property_id, a.seller_id, 'seller', v_amt, coalesce(v_seller_pct, 0), v_sc, 'paid', now());
  perform log_audit_event(case when v_done then 'rto_final_payment_held' else 'rto_installment_released' end, 'rent_to_own_agreements', a.id, v_ref || ' ' || fmt_naira(v_amt), null);

  if v_done then
    update rent_to_own_agreements set status = 'awaiting_handover', final_held_amount = v_net, final_paid_at = now() where id = a.id;
    update properties set purpose = 'sale', status = 'sold' where id = a.property_id;
    perform notify_user(a.buyer_id, '✓ Final payment made — now request your documents', 'You have paid for ' || v_title || ' in full. Ownership becomes final once the owner hands over the property documents. Tap to request them from CHS.', '/rent-to-own');
    perform notify_user(a.seller_id, '💰 Final payment received — send the documents', 'The buyer has paid in full for ' || v_title || '. Your final ' || fmt_naira(v_net) || ' is held safely by CHS and is released when you have handed over the property documents and the buyer (or CHS) confirms. Open your dashboard to see where to send them.', '/owner');
    perform notify_admins_by_domain('owner_buyer_tenant', '🔒 Rent-to-Own paid in full — final payment held', v_name || ' completed payments on ' || v_title || '. ' || fmt_naira(v_net) || ' is held until the documents are handed over. Ref ' || v_ref || '.', '/admin?tab=rtorequests');
  else
    perform notify_user(a.buyer_id, '✓ Payment made', 'Reference ' || v_ref || ': you paid ' || fmt_naira(v_total) || ' (' || fmt_naira(v_amt) || ' + your CHS commission ' || fmt_naira(v_bc) || '). You now own ' || v_new_own || '%. ' || fmt_naira(a.total_price - v_new_paid) || ' remains.', '/rent-to-own');
    perform notify_user(a.seller_id, '💰 Payment received', 'Reference ' || v_ref || ': ' || fmt_naira(v_net) || ' was released to your wallet by CHS (' || fmt_naira(v_amt) || ' net of your CHS commission ' || fmt_naira(v_sc) || ').', '/my-earnings');
    perform notify_admins_by_domain('owner_buyer_tenant', '💰 Rent-to-Own payment received', v_name || ' paid ' || fmt_naira(v_total) || ' on ' || v_title || '. Ref ' || v_ref || '. Platform earning ' || fmt_naira(v_bc + v_sc) || '. Ownership now ' || v_new_own || '%.', '/admin?tab=rtorequests');
  end if;
  return json_build_object('reference', v_ref, 'real_total_paid', v_total, 'installment', v_amt, 'buyer_commission', v_bc, 'ownership_pct', v_new_own, 'completed', v_done, 'awaiting_handover', v_done, 'remaining', a.total_price - v_new_paid);
end $$;

create or replace function pay_rent_to_own_installment(p_agreement_id uuid) returns json language sql security definer set search_path = public as $$
  select pay_rent_to_own(p_agreement_id, null) $$;

-- ---------- handover ----------
create or replace function release_rto_final(p_agreement_id uuid, p_by text) returns void language plpgsql security definer set search_path = public as $$
declare a record; v_title text; v_amt numeric; v_ref text := 'RTOREL-' || substr(p_agreement_id::text, 1, 8);
begin
  select * into a from rent_to_own_agreements where id = p_agreement_id for update;
  if not found or a.status <> 'awaiting_handover' then return; end if;
  v_amt := a.final_held_amount;
  select title into v_title from properties where id = a.property_id;
  if v_amt > 0 then
    update wallets set escrow_held = greatest(0, escrow_held - v_amt), main_balance = main_balance + v_amt, updated_at = now() where user_id = a.seller_id;
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference) values (a.seller_id, 'escrow_held', v_amt, 'debit', 'Final Rent-to-Own payment released from CHS hold', v_ref);
    insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference) values (a.seller_id, 'main', v_amt, 'credit', 'Final Rent-to-Own payment released — documents handed over (' || v_title || ')', v_ref);
  end if;
  update rent_to_own_payments set held = false where agreement_id = a.id and held;
  update rent_to_own_agreements set status = 'completed', completed_at = now(), final_held_amount = 0 where id = a.id;
  update rto_handovers set status = 'confirmed', confirmed_at = now(), confirmed_by = p_by where agreement_id = a.id;
  perform notify_user(a.seller_id, '✓ Final payment released', fmt_naira(v_amt) || ' for ' || v_title || ' is now in your wallet.', '/my-earnings');
  perform notify_user(a.buyer_id, '🎉 Handover complete', 'The documents for ' || v_title || ' have been handed over. The property is fully yours.', '/rent-to-own');
  perform log_audit_event('rto_final_released', 'rent_to_own_agreements', a.id, p_by || ' ' || fmt_naira(v_amt), null);
end $$;
revoke all on function release_rto_final(uuid, text) from public, anon, authenticated;

create or replace function request_rto_documents(p_agreement_id uuid, p_recipient_name text, p_address text, p_phone text, p_method text, p_max_days int)
returns void language plpgsql security definer set search_path = public as $$
declare a record; v_title text;
begin
  select * into a from rent_to_own_agreements where id = p_agreement_id for update;
  if not found or a.buyer_id <> auth.uid() then raise exception 'This is not your agreement.'; end if;
  if a.status not in ('awaiting_handover','completed') then raise exception 'You can ask for the documents once the final payment is made.'; end if;
  if exists (select 1 from rto_handovers where agreement_id = a.id) then raise exception 'You have already asked for these documents.'; end if;
  if coalesce(length(btrim(p_recipient_name)), 0) < 3 or coalesce(length(btrim(p_address)), 0) < 8 or coalesce(length(btrim(p_phone)), 0) < 10 then
    raise exception 'Please give the recipient''s name, the full delivery address and a phone number CHS can reach.'; end if;
  if p_max_days is null or p_max_days < 1 or p_max_days > 60 then raise exception 'Choose between 1 and 60 days for delivery.'; end if;
  insert into rto_handovers (agreement_id, requested_by, recipient_name, delivery_address, delivery_phone, preferred_method, max_days, deadline)
    values (a.id, auth.uid(), btrim(p_recipient_name), btrim(p_address), btrim(p_phone), coalesce(nullif(btrim(p_method), ''), 'courier'), p_max_days, now() + make_interval(days => p_max_days));
  select title into v_title from properties where id = a.property_id;
  perform notify_user(a.seller_id, '📮 The buyer is asking for the property documents', 'Please send the documents for ' || v_title || ' to ' || btrim(p_recipient_name) || ', ' || btrim(p_address) || ' within ' || p_max_days || ' days, then show proof that you sent them. Contact with the buyer goes through CHS.', '/owner');
  perform notify_admins_by_domain('owner_buyer_tenant', '📮 Rent-to-Own document request', v_title || ' (RTO-' || substr(a.id::text, 1, 8) || '): the buyer wants the documents within ' || p_max_days || ' days. Final payment ' || fmt_naira(a.final_held_amount) || ' stays held until handover.', '/admin?tab=rtorequests');
  perform notify_user(auth.uid(), 'Document request sent', 'CHS has told the owner to send your documents within ' || p_max_days || ' days. You will be asked to confirm when they arrive.', '/rent-to-own');
end $$;

create or replace function rto_mark_documents_sent(p_agreement_id uuid, p_method text, p_tracking text, p_proof_note text, p_proof_url text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a record; h record; v_title text;
begin
  select * into a from rent_to_own_agreements where id = p_agreement_id;
  if not found or a.seller_id <> auth.uid() then raise exception 'This is not your agreement.'; end if;
  select * into h from rto_handovers where agreement_id = a.id for update;
  if not found then raise exception 'The buyer has not asked for the documents yet.'; end if;
  if h.status <> 'requested' then raise exception 'These documents are already marked as sent.'; end if;
  if coalesce(length(btrim(p_proof_note)), 0) < 5 and coalesce(length(btrim(p_tracking)), 0) < 3 and coalesce(length(btrim(p_proof_url)), 0) < 5 then
    raise exception 'Please show proof: a tracking number, a courier receipt, or a short note saying how and when they were sent.'; end if;
  update rto_handovers set status = 'sent', sent_at = now(), sent_method = nullif(btrim(coalesce(p_method, '')), ''), tracking_reference = nullif(btrim(coalesce(p_tracking, '')), ''),
    proof_note = nullif(btrim(coalesce(p_proof_note, '')), ''), proof_url = nullif(btrim(coalesce(p_proof_url, '')), '') where id = h.id;
  select title into v_title from properties where id = a.property_id;
  perform notify_user(a.buyer_id, '📬 The owner says your documents are on the way', 'Documents for ' || v_title || ' were sent. When they reach you, open your mortgage page and confirm. That releases the final payment to the owner.', '/rent-to-own');
  perform notify_admins_by_domain('owner_buyer_tenant', '📬 Owner sent Rent-to-Own documents — verify and release', v_title || ' (RTO-' || substr(a.id::text, 1, 8) || '). Proof shown. Confirm with the buyer, then release the held ' || fmt_naira(a.final_held_amount) || '.', '/admin?tab=rtorequests');
  perform notify_user(a.seller_id, 'Proof received', 'CHS has your proof. Your final payment is released as soon as the buyer or CHS confirms the documents arrived.', '/owner');
end $$;

create or replace function confirm_rto_documents_received(p_agreement_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare a record; h record;
begin
  select * into a from rent_to_own_agreements where id = p_agreement_id;
  if not found or a.buyer_id <> auth.uid() then raise exception 'This is not your agreement.'; end if;
  select * into h from rto_handovers where agreement_id = a.id;
  if not found or h.status <> 'sent' then raise exception 'The owner has not marked the documents as sent yet.'; end if;
  if a.status = 'awaiting_handover' then perform release_rto_final(a.id, 'buyer'); else update rto_handovers set status = 'confirmed', confirmed_at = now(), confirmed_by = 'buyer' where id = h.id; end if;
end $$;

create or replace function admin_release_rto_final(p_agreement_id uuid, p_note text default null) returns void language plpgsql security definer set search_path = public as $$
declare a record; h record;
begin
  if not is_admin() then raise exception 'Only CHS staff can release the final payment.'; end if;
  select * into a from rent_to_own_agreements where id = p_agreement_id;
  if not found or a.status <> 'awaiting_handover' then raise exception 'There is no held final payment on this agreement.'; end if;
  select * into h from rto_handovers where agreement_id = a.id;
  if not found or h.status not in ('sent') then
    if coalesce(length(btrim(p_note)), 0) < 10 then raise exception 'The owner has not shown proof yet. To release anyway, write a note saying how you verified the handover (for example, phoned the buyer).'; end if;
  end if;
  perform release_rto_final(a.id, 'CHS' || coalesce(': ' || nullif(btrim(p_note), ''), ''));
end $$;

create or replace function get_rto_handover(p_agreement_id uuid) returns json language plpgsql security definer set search_path = public as $$
declare a record; h record; v_role text;
begin
  select * into a from rent_to_own_agreements where id = p_agreement_id;
  if not found then return null; end if;
  v_role := case when is_admin() then 'admin' when a.buyer_id = auth.uid() then 'buyer' when a.seller_id = auth.uid() then 'seller' else null end;
  if v_role is null then raise exception 'Not your agreement.'; end if;
  select * into h from rto_handovers where agreement_id = a.id;
  if not found then return null; end if;
  return json_build_object('status', h.status, 'recipient_name', h.recipient_name, 'delivery_address', h.delivery_address, 'method', h.preferred_method, 'max_days', h.max_days,
    'deadline', h.deadline, 'overdue', (h.status <> 'confirmed' and now() > h.deadline), 'sent_at', h.sent_at, 'sent_method', h.sent_method, 'tracking', h.tracking_reference,
    'proof_note', h.proof_note, 'proof_url', h.proof_url, 'confirmed_at', h.confirmed_at,
    'delivery_phone', case when v_role in ('admin', 'buyer') then h.delivery_phone else null end);
end $$;

-- the owner's view of the requests on a property: the buyer appears as "Alex P."
create or replace function get_owner_rto_requests(p_property_id uuid) returns json language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from properties where id = p_property_id and owner_id = auth.uid()) then raise exception 'Not your property.'; end if;
  return (select coalesce(json_agg(json_build_object('id', a.id, 'monthly_amount', a.monthly_amount, 'status', a.status,
      'display_name', public_display_name(coalesce(a.applicant_full_name, b.full_name)), 'occupation', a.applicant_occupation, 'source_of_funds', a.applicant_source_of_funds,
      'verified', coalesce(b.valid_id_verified, false) and coalesce(b.liveness_verified, false), 'total_paid', a.total_paid, 'total_price', a.total_price, 'final_held_amount', a.final_held_amount)
      order by a.started_at desc), '[]'::json)
    from rent_to_own_agreements a join profiles b on b.id = a.buyer_id
    where a.property_id = p_property_id and a.status in ('requested','owner_approved','owner_declined','active','awaiting_handover','completed'));
end $$;

-- ---------- earnings: rent-to-own included; sale buyer shown as an initial ----------
create or replace function get_owner_earnings_detailed() returns json language sql stable security definer as $$
select coalesce(json_agg(row_to_json(t) order by t.paid_at desc), '[]'::json) from (
  select 'rent' as category, rp.amount as gross_amount,
    round(rp.amount * (select value::numeric from platform_settings where key = 'rental_commission_landlord_percentage') / 100, 2) as commission_amount,
    rp.amount - round(rp.amount * (select value::numeric from platform_settings where key = 'rental_commission_landlord_percentage') / 100, 2) as net_amount,
    rp.created_at as paid_at, p_tenant.full_name as payer_name, prop.title as property_title, prop.location_area as property_location, 'Rent payment' as detail_label, rp.reference
  from rent_payments rp join tenancies t on t.id = rp.tenancy_id join properties prop on prop.id = t.property_id join profiles p_tenant on p_tenant.id = rp.tenant_id where t.landlord_id = auth.uid()
  union all
  select 'sale', o.amount,
    round(o.amount * (select value::numeric from platform_settings where key = 'sale_commission_seller_percentage') / 100, 2),
    o.amount - round(o.amount * (select value::numeric from platform_settings where key = 'sale_commission_seller_percentage') / 100, 2),
    o.created_at, public_display_name(o.buyer_full_name), prop.title, prop.location_area, 'Property sale', null
  from offers o join properties prop on prop.id = o.property_id where prop.owner_id = auth.uid() and o.legal_transfer_confirmed = true
  union all
  select 'rent_to_own', rtp.amount,
    coalesce((select sum(c.commission_amount) from transaction_commissions c where c.rent_to_own_payment_id = rtp.id and c.payer_role = 'seller'), 0),
    rtp.amount - coalesce((select sum(c.commission_amount) from transaction_commissions c where c.rent_to_own_payment_id = rtp.id and c.payer_role = 'seller'), 0),
    rtp.paid_at, public_display_name(coalesce(a.applicant_full_name, b.full_name)), prop.title, prop.location_area,
    case when rtp.held then 'Mortgage final payment (held until documents are handed over)' else 'Mortgage payment (Rent to Own)' end, rtp.reference
  from rent_to_own_payments rtp join rent_to_own_agreements a on a.id = rtp.agreement_id join properties prop on prop.id = a.property_id join profiles b on b.id = a.buyer_id
  where a.seller_id = auth.uid()
  union all
  select 'shortlet', sb.total_price, sb.host_commission_amount, sb.total_price - sb.host_commission_amount, sb.created_at, sb.guest_full_name, prop.title, prop.location_area,
    'Booking, ' || sb.check_in || ' to ' || sb.check_out, null
  from shortlet_bookings sb join properties prop on prop.id = sb.property_id where prop.owner_id = auth.uid() and sb.payment_status = 'released'
) t $$;

-- owners see the offer's buyer as an initial
do $$ declare v text; begin
  v := pg_get_viewdef('owner_offers'::regclass);
  if position('    buyer_full_name,' in v) = 0 then raise exception 'owner_offers definition changed; review'; end if;
  execute 'create or replace view owner_offers as ' || replace(v, '    buyer_full_name,', '    public_display_name(buyer_full_name) AS buyer_full_name,');
end $$;

-- ---------------------------------------------------------------------------
-- 475c (applied live 9 Oct 2026): EVERY installment reaches CHS first.
-- pay_rent_to_own() now credits the owner's escrow_held (not main balance) for every payment, marks the payment pending_release,
-- and CHS releases it from Rent-to-Own Requests -> "Payments to release" (admin_release_rto_payment / admin_release_all_rto_payments /
-- get_rto_pending_payments). The final payment still waits for the document handover. Columns added to rent_to_own_payments:
-- pending_release, net_amount, released_at, released_by. See the live function definitions for the full text.
-- ---------------------------------------------------------------------------

-- 475d (applied live 9 Oct 2026): owner document check + receipt trail.
-- Table rto_document_submissions; rto_submit_documents (owner uploads scans), admin_review_rto_documents (CHS approves / asks for changes),
-- get_rto_submissions (buyer sees status only, never the files); rto_mark_documents_sent now requires an approved submission and accepts a receipt file;
-- confirm_rto_documents_received now also notifies the owner and CHS. See the live function definitions for the full text.

-- 475e (applied live 9 Oct 2026): approved soft copy reaches the buyer.
-- admin_review_rto_documents now also notifies the buyer on approval; get_rto_submissions shows the files to the buyer only once approved;
-- rto_buyer_can_read_file() + storage policy private_docs_rto_buyer_read let the buyer open ONLY approved files. See the live definitions.

-- 475f (applied live 2026-10-09): FINAL RELEASE IS MANUAL, SUPER ADMIN ONLY.
--  * confirm_rto_documents_received no longer releases money. It marks the handover 'confirmed',
--    notifies owner + admins. The held final payment stays in escrow_held.
--  * admin_release_rto_final requires profiles.is_super_admin (accepts handover 'sent' or 'confirmed';
--    otherwise a >=10 char verification note is required).
--  * platform_settings 'rto_final_auto_release' (default 'false'). rto_auto_release_on() reads it;
--    admin_set_rto_auto_release(boolean) (super admin only, audited) toggles it. Only when 'true' does the
--    buyer's confirmation call release_rto_final(). Tick box is on the admin Mortgage panel.
--  * admin_revert_rto_final_release(agreement, note>=10 chars): super admin only; moves a released final
--    payment from the owner's main balance back to escrow_held (refs RTOREV-xxxxxxxx), agreement back to
--    awaiting_handover. Refuses if the owner no longer has the money.
--  * get_rto_admin_queue: needs_action also true when buyer confirmed and money is still held; handover
--    JSON carries confirmed_by. Notification wording in pay_rent_to_own / rto_mark_documents_sent updated.
