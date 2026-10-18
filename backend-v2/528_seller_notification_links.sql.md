# 528 - Seller order notifications open the Deliveries tab (applied live 18 Oct 2026)
- buy_product_direct: "A real order was placed" notification now carries link /vendor?tab=deliveries (was NULL).
- checkout_cart(jsonb,text,integer,jsonb): "Prepare this order for dispatch" link changed from /vendor to /vendor?tab=deliveries.
- Existing seller notifications with link NULL (order placed) or /vendor were updated to /vendor?tab=deliveries.

## Addendum (18 Oct 2026, later) - dispatch also notifies admin
- vendor_dispatch_shipment now also calls notify_admins_by_domain('owner_buyer_tenant', 'Seller dispatched an order', ..., '/admin?tab=deliveries'). Buyer notification unchanged. Tested as the seller in a rolled-back block: status dispatched, 1 buyer + 1 admin notification.
