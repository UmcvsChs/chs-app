-- Real, direct fix to Escrow Oversight per a direct, confirmed source
-- of client confusion: Felicia Babaranti's real ₦1,166,000 rent
-- payment (held as ₦1,056,000, net of the landlord's commission at
-- source) was correctly held the entire time -- traced and confirmed
-- directly via get_held_rent_payments() -- but every section of
-- Escrow Oversight only ever loaded once, on first page open, with
-- no real way to see anything that happened afterward short of a
-- full reload. Also confirmed: the screen's four separate categories
-- (Rent, Sale, Marketplace, Deposits) gave no real way to know which
-- one a given transaction belonged to without checking each in turn.
--
-- Two real fixes, both in app/admin/page.tsx:
--   1. A real, shared loadEscrowData() refresh, wired to a visible
--      "🔄 Refresh" button, re-fetching every held category at once.
--   2. A real, unified "every held transaction, newest first" list,
--      merging all four categories into one, clearly labeled view.
--
-- This migration adds the one real, missing ingredient the unified
-- list needed to sort accurately: created_at on Property Sale and
-- Shortlet Deposits, which never returned it before and would
-- otherwise have silently sorted to the bottom regardless of how
-- recent they actually were.

create or replace function get_pending_legal_transfers()
returns json
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Not authorised: CHS admins only.';
  end if;
  return (
    select coalesce(json_agg(row_to_json(t) order by t.id), '[]'::json) from (
      select o.id, o.amount, o.created_at, p.title as property_title, p.owner_id
      from offers o
      join properties p on p.id = o.property_id
      where o.payment_status = 'paid' and o.legal_transfer_confirmed = false
    ) t
  );
end;
$$;

create or replace function get_held_shortlet_deposits()
returns json
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Not authorised: CHS admins only.';
  end if;
  return (
    select coalesce(json_agg(row_to_json(t) order by t.check_in asc), '[]'::json) from (
      select sb.id, sb.guest_full_name, sb.guest_phone, sb.check_in, sb.check_out,
        sb.security_deposit_amount, sb.created_at, p.title as property_title, p.owner_id
      from shortlet_bookings sb
      join properties p on p.id = sb.property_id
      where sb.security_deposit_status = 'held'
    ) t
  );
end;
$$;
