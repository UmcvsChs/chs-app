# CHS — Test Checklist for the 14 October 2026 batch

Deploy the zip first (the database changes are already live). Test accounts: host/owner, guest, admin. Test event centre: Royal Garden Events Centre (Test). Test hotel: Savannah Grand Hotel (Test).

## A. Event centre advance (admin + host + guest)
1. Guest: open booking 018429ef (already paid). Confirm it shows confirmed and paid.
2. Admin → Escrow Oversight (or Event Centres) → find the booking. It shows the split: 60% advance now, 40% balance after the event. Press **Release advance (60%)** (Event Centres has the same as "Release advance now").
3. Expected: the host wallet is credited ₦781,632 with a reference starting ADV-. The balance (₦521,088) is paid after the event.
4. Press it again: expected "Nothing was released (already paid)".
5. Admin → Service sourcing → payouts: for CHS-sourced providers, check the advance and balance buttons.
6. Cancel test (on a new test booking): pay, release the advance, cancel as host. Expected: the advance is taken back from the host wallet first and the guest is refunded in full.

## B. Event documents, capacity, seating
1. Guest: on the event booking add a document (title with no phone number). Host and admin can open it; another guest cannot.
2. Host: Event pricing → Venue profile → set capacity 500, tick Theatre and Classroom, set Classroom to 120. Save. Admin sees "Venue capacity to verify".
3. Admin → Event Centres → verify capacity.
4. Guest: try to book 600 guests. Expected: refused.
5. Guest: Services and changes → Choose your seating layout. With 300 guests, Classroom (up to 120) is greyed out, Theatre works. Host sees the choice.

## C. Hotel (Savannah Grand Hotel)
1. Home page: choose dates. Expected: only places free on those dates appear. Try the accessibility filter.
2. Book 2 rooms with 2 adults and 1 child. Expected: two linked bookings, "Room 1 of 2", "Room 2 of 2".
3. Host confirms both. Guest: press **Pay all 2 rooms at once**. Expected: both confirmed and paid; wallet debited the total once.
4. Guest: Extras → ask for breakfast and airport pickup. Host answers with a price. Guest pays.
5. Host page → Stay offers: set weekly 10% and monthly 20%. Guest: book 7 nights. Expected: a discount line; the fees are on the discounted price.
6. Guest: send a group enquiry (try a phone number in the message: refused). Host reads it.
7. Property page shows the rating summary. Rating before the stay starts is refused.

## D. Open field / stadium
1. List a property as Open Field or Stadium. Host page → Ground details: fill in surface, floodlights, crowd limit, rain plan. Save (a phone number is refused).
2. Guest page → Open Fields & Stadiums tab shows it; the property page shows the ground details.

## E. VAT (super admin only) — leave OFF unless the accountant has confirmed
1. Admin → Financial → VAT on CHS fees. Try to switch on without a tax ID: refused.
2. For a test only: enter a test tax ID, rate 7.5, switch on, make a small test booking, check the report shows the fee and its VAT (a ₦107.50 fee shows ₦7.50 VAT). Then switch it OFF again.
3. A refund of that booking shows the entry as reversed.

## E2. Managing a hotel / event centre
1. Host page → the event centre → "Ask CHS to manage this property". Choose capacity "I am the owner". Upload only proof of ownership: the form should list the permit/licence, fire certificate and insurance as required (the submit button stays off until all are attached).
2. Submit with all four. Admin → CHS stamp: open the request, tick documents checked, enter base fee 5, incentive 10, term 36, approve.
3. Book the venue as a guest and check the price: the host commission is 0 and the host payout equals the full booking price. Compare with an unmanaged venue (4%).

## F. Documents
Admin → Documents page lists Terms V9 draft, security audit, feature catalog, explainer list, handover notes and the rest. Open each.

## Report back
For each failed step note: the step number, what you saw, a screenshot.


## Booking messages
1. Guest sends a message on a booking: it appears in Admin > Bookings tab (amber box). 2. Admin approves: host gets a notification and a Messages tab badge. 3. Host opens it and replies; badge clears. 4. Guest taps 'Open the change request form', asks for more guests; host answers in Changes.

## Resend / Withdraw on every flow (Admin)
1. Admin > Bookings: on a request waiting for the guest to pay, open "Resend / Withdraw", Resend: the guest gets a reminder; the card shows who received it (name and phone). 2. Admin > Applications, Offers, Marketplace and Rent-to-Own: each card has the same buttons. Resend to an owner while they are deciding; resend to the tenant/buyer after the decision. 3. Withdraw with a reason on an unpaid item: both sides are notified, item closes. 4. Try Withdraw on a paid item: it must refuse and point to refund.

## Advance and room picker
1. Pay a hotel booking as a guest: the host wallet receives 60% of the net payout at once and sees "Advance paid"; Admin escrow oversight still holds the rest. 2. Guest arrives and confirms: the host receives only the remaining 40%. 3. Host > Calendar > My rooms: rename rooms to real numbers, set floors and features. 4. Guest booking form: pick dates, see rooms by floor, tap "Keep us together" for a family, send the request: the booking card shows the chosen rooms and floors. 5. Pick a room, then have someone else take it first: the request is refused with nothing charged.


## Marketplace delivery (new)
1. Marketplace: choose your city (for example Kano). Every product shows "Nearby seller" or "Seller is far", km, delivery cost and arrival dates; the header says "N of M items are from sellers near you".
2. Add items from two sellers. Open the cart: each seller has delivery choices; change a choice and watch the total change. A same-city CHS delivery for a second seller shows "shares one run".
3. Pay with your PIN. "Track my deliveries" opens Marketplace > My deliveries: one parcel per seller, each with a 6-digit code.
4. Seller account > Deliveries: set your city, switch free local delivery on, then mark a parcel handed over (carrier + waybill). The buyer gets a notification.
5. Admin > Oversight > Deliveries & shipments: update the status to in transit and out for delivery; the buyer sees the history.
6. Try Release balance before delivery: refused. Release 60% instead: the seller gets it and is told.
7. Buyer taps "I have received it" twice: status delivered; admin releases the balance.
8. Buyer "Report a problem" on another parcel: admin alerted, payment stays held. Try a refund after a part release: refused with a clear reason.
9. Admin > Deliveries > Rates, centres & rules: change a rate and see the next cart quote change; switch on a centre with a street address and see "Pick up at a CHS centre" for far sellers.
10. Seller product form: weight, handling and "ready to hand over in" are required.

## Marketplace search scope
1. First visit shows "How do you want to search?" with three choices; close it and it does not return, but "How searching works" reopens it.
2. Choose Kano. Near me shows only Kano sellers and a note about items in other towns. Cheapest overall ranks by total with delivery. Anywhere lists nearest first.
3. A heavy item from far away shows the red "Delivery is N% of the price" warning.

## Locations (all states and LGAs)
1. Marketplace > Deliver to: choose any state (all 36 plus FCT) and then any LGA, for example Kaduna > Igabi. Delivery cost and dates appear for every seller.
2. Vendor > Deliveries: choose your state and LGA and save.
3. Admin > Deliveries > Rates, centres & rules > Area map points: pick Kaduna, add a latitude and longitude for Igabi, and see the distance change.

## Areas and bold Marketplace
1. Deliver to: choose Kaduna > Kaduna South > Barnawa. The area follows you into the cart, tracking and the seller's dispatch card.
2. Open the Owner, Agent, Manager, Host, Guest, Artisan and Developer dashboards: a compact white "CHS Marketplace / Shop" tile sits near the top; tap it to open the Marketplace. Nothing floats over the page.
3. Home page: the large banner and the red Marketplace button and tab.

## Test store (17 Oct): follow CHS_TEST_STORE_GUIDE.pdf
[ ] Buyer One buys the 20-item list in one checkout (8 parcels). [ ] Seller hands over / free local delivery code. [ ] Admin updates courier statuses. [ ] Release 60%, then balance after delivery. [ ] Report a problem and refund rules. [ ] Repeat on at least two real iPhones (SE-size and large): no zoom on typing, bottom bar clear of home bar, Add to Home Screen works.

## Hotel in-house services (17 Oct)
[ ] Host (Savannah Grand or Hilltop Lodge owner): Hotel operations > Services offered: add, edit, hide a service; leave a price empty. [ ] Hotel page shows "Services at this hotel", price only where entered. [ ] Guest with a booking: My bookings > Hotel services for your stay > reserve (no payment), withdraw. [ ] Host accepts and declines; guest is notified. [ ] Phone number in a note is refused. [ ] Check on a 360 px phone and on iPhone.
- Login: sellers choose 'Seller / Vendor / Service Provider' in 'Log in as' (not Owner); buyers choose Buyer; admin chooses Admin.
- Seller: tap the 'real order' / 'Prepare this order' notification -> must open Seller page on the Deliveries tab with the parcel and its dispatch button.
- Seller: red banner 'orders waiting for you to send' -> Deliveries / Dispatch tab -> enter carrier -> 'I have handed it over'. Buyer AND admin must receive a notification. My Orders rows show 'Send this order'.
- Seller page bottom must read "Build 18 Oct 2026 · 4 ..." (proves the new version is live). Top of seller page shows "Orders to send" box with the dispatch button.
- Buyer: buy 3+ items; My Receipts shows ONE row; the receipt lists every item with its price and a TOTAL PAID equal to the wallet debits.
