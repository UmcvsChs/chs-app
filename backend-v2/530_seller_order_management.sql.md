# 530 - Seller order management: packed step + full dispatch record (applied live 18 Oct 2026)
- marketplace_shipments gained: dispatch_method (own_rider | courier | chs_centre), rider_name, rider_phone, vehicle_plate, packed_at, dispatched_at, dispatch_expected, dispatch_note (carrier and tracking_no already existed).
- _ship_json now returns those fields, plus per item: unit_price and, for the seller/admin view only (never the buyer view), vendor_commission and vendor_paid; plus buyer first name for the seller view.
- vendor_mark_packed(shipment) - records packed, notifies the buyer.
- vendor_dispatch_shipment(shipment, method, carrier, tracking, rider_name, rider_phone, vehicle, expected_date, note) - validates (own rider needs name + phone; courier needs company name), records a permanent event, notifies the buyer (who is carrying it) and the admin team. The old 3-argument one-tap version now routes through it (courier if a carrier is named, otherwise CHS centre), so no dispatch is ever saved without a method.
- Seller notifications (order placed / prepare for dispatch) now link to /vendor/orders; 13 existing notifications repaired.
- Tested as the seller (rolled back): validation messages, packed, dispatch with rider, buyer sees rider but not the seller's commission.
