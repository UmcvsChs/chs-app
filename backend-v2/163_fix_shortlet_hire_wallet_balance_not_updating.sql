-- Real, serious, pre-existing bug found through genuine testing, not
-- something introduced today: book_shortlet_with_payment recorded a
-- real debit in wallet_transactions, but never actually updated the
-- real, stored wallets.main_balance value that every other part of
-- the app — the wallet page, every dashboard widget — actually reads.
-- A real user's displayed balance would stay wrong after any
-- shortlet or hire booking. Confirmed this was never caught before
-- because zero real shortlet bookings had ever been completed until
-- today's test found it.

create or replace function book_shortlet_with_payment(
  p_property_id uuid, p_guest_id uuid, p_check_in date, p_check_out date,
  p_total_price numeric, p_guests int, p_guest_full_name text, p_guest_phone text,
  p_guest_id_document_url text
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
    guests, guest_full_name, guest_phone, guest_id_document_url, payment_status
  ) values (
    p_property_id, p_guest_id, p_check_in, p_check_out, p_total_price,
    p_guests, p_guest_full_name, p_guest_phone, p_guest_id_document_url, 'held_escrow'
  ) returning id into v_booking_id;

  update wallets set main_balance = main_balance - p_total_price, updated_at = now() where user_id = p_guest_id;

  insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
    values (p_guest_id, 'main', p_total_price, 'debit', 'Shortlet booking (held in escrow)', 'SLB-' || substr(v_booking_id::text, 1, 8));

  perform generate_shortlet_commission(v_booking_id);

  return v_booking_id;
end;
$$;
