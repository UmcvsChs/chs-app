# 529 - One combined receipt per marketplace checkout (applied live 18 Oct 2026)
- get_checkout_receipt(p_reference text) returns json: receipt no. CHK-XXXXXXXX, date, buyer, address, every item (name, qty, unit price, line amount, seller, order ref), items subtotal, CHS service fee total, delivery + insurance total (DLV-xxxxxxxx wallet debit), parcels. Accepts any reference from the purchase (CHS-BUY-, BUYPAY-, DLV-, CHK-). Buyer or admin only; returns null otherwise (old receipt flow is used for everything else).
- get_my_checkout_receipts() lists the buyer's checkouts (one row each, with grand total).
- Verified: 3 items 2,316,000 + fee 138,960 + delivery 346,500 = 2,801,460 = sum of the four wallet debits.
