-- Real, serious fix found during the audit: nothing anywhere ever
-- released a shortlet's escrowed payment to the host. The guest's
-- money was correctly held, but the other half of the promise —
-- releasing it once check-in is confirmed — was never built.

create or replace function confirm_shortlet_condition_report(p_report_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_guest_id uuid;
  v_report_type text;
  v_booking_id uuid;
  v_host_id uuid;
  v_total_price numeric;
  v_payment_status text;
  v_reference text;
begin
  select sb.guest_id, cr.report_type, cr.shortlet_booking_id
    into v_guest_id, v_report_type, v_booking_id
    from condition_reports cr join shortlet_bookings sb on sb.id = cr.shortlet_booking_id
    where cr.id = p_report_id;

  if v_guest_id != auth.uid() then
    raise exception 'Only the real guest on this booking can confirm this report.';
  end if;

  update condition_reports set tenant_confirmed = true, status = 'approved', approved_at = now() where id = p_report_id;

  if v_report_type = 'check_in' then
    select sb.payment_status, sb.total_price, p.owner_id
      into v_payment_status, v_total_price, v_host_id
      from shortlet_bookings sb join properties p on p.id = sb.property_id
      where sb.id = v_booking_id;

    if v_payment_status = 'held_escrow' then
      v_reference := 'SLR-' || substr(gen_random_uuid()::text, 1, 8);

      update wallets set main_balance = main_balance + v_total_price, updated_at = now() where user_id = v_host_id;
      insert into wallet_transactions (user_id, wallet_type, amount, direction, description, reference)
      values (v_host_id, 'main', v_total_price, 'credit', 'Shortlet booking payment released (check-in confirmed)', v_reference);

      update shortlet_bookings set payment_status = 'released' where id = v_booking_id;

      perform notify_user(v_host_id, '💰 Shortlet payment released',
        'Your guest confirmed check-in — ' || v_total_price || ' has been released to your wallet.');
    end if;
  end if;
end;
$$;
