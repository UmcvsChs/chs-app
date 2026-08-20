-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Shortlet Booking Payment + Guest Details
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 13_shortlet_bookings.sql, in the same
-- Supabase project.
--
-- A genuinely significant gap found during the systematic Shortlet
-- view comparison: a booking could be created with zero real payment
-- ever happening — no wallet debit, no charge, nothing. Fixed
-- properly with a real, atomic function, matching the same real
-- pattern already proven for listing promotion. Also adds real guest
-- count and verification fields, found missing from the same
-- comparison.
-- ═══════════════════════════════════════════════════════════════

select count(*) as schema_already_set_up from shortlet_bookings;
-- If this errors, run 13_shortlet_bookings.sql first.

alter table shortlet_bookings add column if not exists guests integer not null default 1;
alter table shortlet_bookings add column if not exists guest_full_name text;
alter table shortlet_bookings add column if not exists guest_phone text;
alter table shortlet_bookings add column if not exists guest_id_document_url text;
alter table shortlet_bookings add column if not exists payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'held_escrow', 'released', 'refunded'));

create or replace function book_shortlet_with_payment(
  p_property_id uuid,
  p_guest_id uuid,
  p_check_in date,
  p_check_out date,
  p_total_price numeric,
  p_guests integer,
  p_guest_full_name text,
  p_guest_phone text,
  p_guest_id_document_url text
) returns uuid
language plpgsql
security definer
as $$
declare
  v_balance numeric;
  v_booking_id uuid;
begin
  select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)
    into v_balance
    from wallet_transactions
    where user_id = p_guest_id and wallet_type = 'main';

  if v_balance < p_total_price then
    raise exception 'insufficient_balance';
  end if;

  insert into shortlet_bookings (
    property_id, guest_id, check_in, check_out, total_price,
    guests, guest_full_name, guest_phone, guest_id_document_url, payment_status
  ) values (
    p_property_id, p_guest_id, p_check_in, p_check_out, p_total_price,
    p_guests, p_guest_full_name, p_guest_phone, p_guest_id_document_url, 'held_escrow'
  ) returning id into v_booking_id;

  -- Real, genuine escrow — debited immediately, matching the real
  -- original's own "held in escrow until check-in confirmed" promise,
  -- not released to the host until check-in is actually confirmed.
  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (p_guest_id, 'main', p_total_price, 'debit', 'Shortlet booking (held in escrow)', 'SLB-' || substr(v_booking_id::text, 1, 8));

  return v_booking_id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify it worked:
-- ═══════════════════════════════════════════════════════════════
select column_name from information_schema.columns
where table_name = 'shortlet_bookings'
and column_name in ('guests', 'guest_full_name', 'guest_phone', 'guest_id_document_url', 'payment_status');
-- Should return 5 rows.
