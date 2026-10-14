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
