-- Real, confirmed gap found per direct client request: a genuine
-- "expected attendees" field already existed for hire/event bookings,
-- but nothing captured a real request for a music band, caterer,
-- ushers, or any other event-day service -- a host had no way to even
-- know these were wanted, let alone arrange them. Added as real,
-- optional fields on the same booking, defaulting to null/false so
-- existing shortlet and non-event hire bookings are entirely
-- unaffected.
--
-- NOTE: superseded by migration 210, which found this function
-- (book_shortlet_with_payment) is not the one the real booking form
-- actually calls. Kept here for a truthful history.

alter table shortlet_bookings add column if not exists wants_music_band boolean default false;
alter table shortlet_bookings add column if not exists wants_caterer boolean default false;
alter table shortlet_bookings add column if not exists wants_ushers boolean default false;
alter table shortlet_bookings add column if not exists number_of_ushers integer;
alter table shortlet_bookings add column if not exists additional_event_requests text;

create or replace function book_shortlet_with_payment(
  p_property_id uuid, p_guest_id uuid, p_check_in date, p_check_out date, p_total_price numeric,
  p_guests integer, p_guest_full_name text, p_guest_phone text, p_guest_id_document_url text,
  p_wants_music_band boolean default false, p_wants_caterer boolean default false,
  p_wants_ushers boolean default false, p_number_of_ushers integer default null,
  p_additional_event_requests text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_balance numeric;
  v_booking_id uuid;
begin
  select main_balance into v_balance from wallets where user_id = p_guest_id;

  if v_balance is null or v_balance < p_total_price then
    raise exception 'insufficient_balance';
  end if;

  insert into shortlet_bookings (
    property_id, guest_id, check_in, check_out, total_price,
    guests, guest_full_name, guest_phone, guest_id_document_url, payment_status,
    wants_music_band, wants_caterer, wants_ushers, number_of_ushers, additional_event_requests
  ) values (
    p_property_id, p_guest_id, p_check_in, p_check_out, p_total_price,
    p_guests, p_guest_full_name, p_guest_phone, p_guest_id_document_url, 'held_escrow',
    p_wants_music_band, p_wants_caterer, p_wants_ushers, p_number_of_ushers, p_additional_event_requests
  ) returning id into v_booking_id;

  update wallets set main_balance = main_balance - p_total_price, updated_at = now() where user_id = p_guest_id;

  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (p_guest_id, 'main', p_total_price, 'debit', 'Shortlet booking (held in escrow)', 'SLB-' || substr(v_booking_id::text, 1, 8));

  perform generate_shortlet_commission(v_booking_id);

  return v_booking_id;
end;
$$;
