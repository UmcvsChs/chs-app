-- Real, new feature per direct client feedback: the owner dashboard
-- had no way to raise a real concern with CHS, no portfolio-wide
-- summary, and no real earnings ledger — confirmed by checking
-- directly, nothing like this existed anywhere for owners. Also
-- relocates the escrow release action to be directly visible
-- alongside the real earnings summary, and adds the notification
-- bell that was missing from the owner dashboard entirely.

create table owner_concerns (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id),
  property_id uuid references properties(id) on delete set null,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  admin_response text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

alter table owner_concerns enable row level security;
create policy "owner_concerns_own" on owner_concerns for all using (auth.uid() = owner_id);
create policy "owner_concerns_admin_all" on owner_concerns for all using (staff_can_access('owner_buyer_tenant'));

create or replace function raise_owner_concern(p_property_id uuid, p_subject text, p_message text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new_id uuid;
begin
  insert into owner_concerns (owner_id, property_id, subject, message)
  values (auth.uid(), p_property_id, p_subject, p_message)
  returning id into v_new_id;

  insert into notifications (user_id, title, body)
  select id, '⚠️ New owner concern raised', p_subject
  from profiles where is_super_admin = true;

  return v_new_id;
end;
$$;

create or replace function resolve_owner_concern(p_concern_id uuid, p_response text)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
begin
  if not is_admin() then
    raise exception 'Only CHS staff can resolve a concern.';
  end if;

  select owner_id into v_owner_id from owner_concerns where id = p_concern_id;
  update owner_concerns set status = 'resolved', admin_response = p_response, resolved_at = now() where id = p_concern_id;

  perform notify_user(v_owner_id, '✓ Your concern has been resolved', p_response);
end;
$$;

create or replace function get_owner_portfolio_summary(p_owner_id uuid)
returns table(total_properties int, active_listings int, occupied_or_sold int, total_real_earnings numeric, pending_offers int, open_fault_reports int)
language plpgsql
stable
as $$
begin
  return query
  select
    (select count(*) from properties where owner_id = p_owner_id)::int,
    (select count(*) from properties where owner_id = p_owner_id and status = 'active')::int,
    (select count(*) from properties where owner_id = p_owner_id and status in ('sold', 'occupied', 'rented'))::int,
    coalesce((select sum(wt.amount) from wallet_transactions wt where wt.user_id = p_owner_id and wt.direction = 'credit'
      and wt.wallet_type in ('main', 'escrow_held') and wt.description ilike any(array['%rent%received%', '%sale proceeds%', '%installment received%'])), 0),
    (select count(*) from offers o join properties p on p.id = o.property_id where p.owner_id = p_owner_id and o.status = 'pending')::int,
    (select count(*) from fault_reports fr join properties p on p.id = fr.property_id where p.owner_id = p_owner_id and fr.status != 'resolved')::int;
end;
$$;
