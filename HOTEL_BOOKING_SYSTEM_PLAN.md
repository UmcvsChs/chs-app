# Hotel / Lodge / Event-Centre Booking System — Plan and Status

The agreed design, the build order, and where we are. Updated as each step is built.

## The problem that started this

Philips Edward asked for a hotel for six days; admin was only *notified* and the request went straight to
the host. Raised in testing: what if the hotel is fully booked (festival season)? How does the guest know
*before* booking? How do we stop "I booked and they cancelled"?

**Verified on the real code before building:** two guests could request the same room for overlapping
dates; both were charged and told "request sent"; the host then got a raw database error accepting the
second; the second guest stayed pending with money held. The guest form's "already booked" check could not
see other guests' bookings at all (correctly — privacy rules — but it meant guests had no way to know).

## Decisions locked (agreed jointly)

| # | Decision | Chosen |
|---|---|---|
| 1 | Booking flow | **Request → admin relays → host confirms availability → guest pays** (not pay-first) |
| 2 | Time limits | **Tiered by urgency** (a fixed 12h would block impromptu travel): >3 days away: host 24h / guest pays within 6h · 1–3 days: 6h / 2h · within 24h (Express): 30 min / 20 min |
| 3 | Rooms | **Hybrid** — individual rooms underneath, created in bulk ("Standard 101–112"), grouped by room type; guest picks a type, system assigns a free room |
| 4 | Peak / off-peak pricing | **CHS suggests, host decides** — CHS publishes suggested peak periods (Dec/New Year, Easter, Sallah, long weekends; Eid moves yearly so CHS updates it); host switches on, sets the rate, adds local events (e.g. Calabar Carnival) |
| 5 | Host confirms then can't deliver | **Tiered**: 1st — guest made whole (host, not guest, covers the small bank fee) + warning + CHS helps rebook · 2nd within 90 days — penalty (start: 10% of booking value, from payouts) · 3rd — listing suspended pending review. Cancelled dates stay blocked (no cancel-and-resell at festival price). Needs a one-line update to term 36. |
| 6 | Event centres | **Same calendar engine**, by the day (already stored as day ranges) |

### Express Booking (last-minute travel) — the answer to "I must be in Calabar in 6 hours"
- **Lane 1 — Instant Confirm:** host opts in; if the room shows green it is confirmed the moment the guest pays — no host or admin wait. Badge "Confirmed instantly" requires the host's calendar to have been confirmed within 12h (one tap: "My calendar is accurate"). Admin notified of every instant booking.
- **Lane 2 — Express Request:** very short clocks; guest may ask **up to 3 hotels at once** — first "yes" wins, the others cancel automatically (possible only because payment comes *after* confirmation). Admin gets a live red queue with countdowns and phones silent hosts.
- **Guards:** guest ID-verified and wallet already funded; arrival time (ETA) shown to host; normal cancellation terms shown before paying.
- **Caveat:** SMS/WhatsApp alerts to hosts depend on the SMS provider approval (pending when last checked). Until then Express Requests rely on in-app alerts + admin phoning; Instant Confirm does not depend on it.

## Build order and status

| Step | What | Status |
|---|---|---|
| 1 | Rooms, calendar ledger, database guard against double-booking (incl. holds), expiring holds, date-only availability | **DONE** — migration 450 |
| 2 | Guest calendar (green / red-crossed / amber "requested") + room-type picker · Host console: add rooms, block dates, record walk-in bookings, daily "calendar accurate" tap + reminder · Admin stale-calendar alert | **DONE** — migrations 451, 452 |
| 3 | Request-before-pay flow with admin relay · tiered timers + automatic expiry · **ETA captured at request** | **DONE** — migration 454 |
| 4 | Instant Confirm · Express Request (3 hotels at once) · admin Express queue | |
| 5 | Peak / off-peak pricing (CHS-suggested periods, host rates, optional minimum stay) | |
| 6 | Host cancellation consequences (tiered) + term 36 update | |
| 7 | **Digital check-in** (see below) — 7a, 7b, 7c | |

### Correction — the host is paid when the guest ARRIVES (migration 459, October 2026)
Booking is prepaid, as a Nigerian rental is: CHS holds the money only until the guest has arrived and found the property as described. Before this, text said the host was paid "after the stay", and the only release trigger was a condition report the host had to file first (never used — a ₦900,000 event booking sat held after its dates began). Now: **the guest ticks an arrival checklist** (arrived; matches listing; each listed facility present and working; optional message) → the host's net payout is released **at once** and the message goes to the host and CHS; a **reported problem** keeps the money held; the host can **ask CHS to release** once the guest's check-in day arrives; and with no response the payout is released **automatically 24 hours after 2 pm check-in** (setting `shortlet_auto_release_hours`). Older pay-first bookings (no payment date) are not auto-released; CHS releases them from the new "Payments awaiting release" list in the Shortlet/Hire tab. All wording ("after the stay") removed from the app, Terms, FAQ and guides.
**House rules:** the upload existed only for rent/lease/shortlet/rent-to-own listings on the Owner dashboard; it now also covers hire listings (hotels, venues, halls, car parks) and the Host dashboard. No listing had uploaded any yet.
**Rent-to-own (460, 461):** ownership is now exact and the buyer can never overpay (previously the 3-payment studio needed a 4th payment); one active agreement per property; the owner no longer sees the buyer's phone number. Test guide: CHS_Rent_to_Own_Test_Guide.pdf.

### Decisions taken (October 2026)
- **Terms Version 3 — yes, re-acceptance.** Term 11 changed what users pay, when, and what they can do; fresh, recorded acceptance is the standard way to make that binding. Everyone is asked once, with a "what's new" banner. `accept_terms()` now records the version the person actually saw (1..current), so deploying the app and raising the database version can happen in either order without locking anyone out (migration 456).
- **Feature Catalog — regenerated** from its single data source (`types/featureCatalogData.ts`), PDF and spreadsheet together; stale entries corrected, new section 16 for the booking system; tooltip wording corrected in both copies.
- **Commission timing — decided: both at payment**, as rent and sale (migration 457). The host's commission is recorded as collected when the guest pays; the two existing paid bookings were corrected (₦82,000 moved from pending to paid). Shortlet commission is now ₦123,000 (guest) + ₦82,000 (host) = ₦205,000, exactly 10% of the two paid bookings (₦2,050,000).
- **Late cancellations — decided: split** (migration 457). Refund 100% (48h+ ahead, or host never confirmed) / 50% (inside 48h) / 0% (on or after check-in); deposit always returned. The unrefunded stay price goes to the host as compensation (less CHS's commission on it); CHS keeps its service fee on that part. The host's share of the kept price is `shortlet_cancellation_host_share_pct` (default 100). Refund + host net + CHS commissions always equals what was paid (tested to the naira).
- **Ledger bug fixed on the way (458):** a request refunded in full still had its commission counted (₦12,600); fixed and removed.
- **Phone numbers hidden from hosts at the database level — done (455c).**

### Correction after Step 3 — everything goes through CHS (migration 455)
The platform rule is that CHS relays every message between parties in every category. Step 3 had broken it three ways: urgent (soon/express) requests were relayed to the host instantly; guest and host could chat freely; and three host screens showed the guest's phone number. Fixed: **every lane now waits for CHS** (fallback auto-relay only as a safety net: standard 4h, soon 30m, express 10m, in `platform_settings`, with a loud admin alert per lane); **messages are reviewed before delivery until the booking is paid** (row security stops the other side reading them), phone numbers/emails are refused at all times (the shared filter was also fixed so ordinary dates, times and numbers pass); hosts see the guest's **name and a CHS reference only**. Admin has a message-review box in the Shortlet/Hire tab.
**Still to apply after the new version is deployed:** remove the host's technical permission to read `guest_phone` / `guest_id_document_url` from `shortlet_bookings` (SQL is in migration file 455). **Open decision:** record BOTH commissions at payment (as rent and sale do) instead of the host's only at payout.

### Step 3 — what exists now (request before pay)
- **Order:** guest sends a request (nothing charged) → CHS relays it to the host → host confirms the dates are free → guest pays within a short window → confirmed. New stages: `awaiting_admin_relay`, `pending_host_review`, `awaiting_payment`, `confirmed`; dead ends `declined`, `cancelled`, `expired`.
- **Lanes** (by check-in, Nigerian time; settings in `platform_settings`): *standard* (>3 days) host 24h / pay 6h, relayed by an admin or automatically after 4h; *soon* (1–3 days) 6h / 2h, relayed instantly; *express* (today) 30m / 20m, relayed instantly, arrival time required. Soon and express need the full amount already in the guest's wallet when the request is sent.
- **Every stage holds the dates** and has a deadline; the 5-minute sweeper settles overdue stages (auto-relay / lapse with nothing to refund / exact refund for an older paid request).
- **Screens:** booking forms say "nothing is charged now" with the real windows and an arrival-time field; the page after sending says "Request sent" (it used to say "Booking confirmed"); My Bookings and the Guest dashboard show the stage, a countdown and a **Pay now** card; the host panel offers "Confirm — dates are free" / "Decline"; the admin tab is a relay queue (relay with a note, or decline with a reason; urgent first; host phone shown).
- **Money:** `pay_for_booking` charges price + guest commission + deposit; guest commission recorded paid, host commission pending until payout. Older requests that were paid at request keep their old behaviour (exact refund on decline / no reply).
- **Payout fixes found on the way:** the Release button now refuses a booking nothing was paid for; both payout routes (admin release, guest confirms check-in) go through one routine that pays the host *net* of CHS's commission and records that commission as collected.
- **Open decisions:** (1) who receives the amount kept when a guest cancels a paid booking inside 48 hours (50% kept) or after check-in (all kept) — today it stays in CHS's holding account; (2) whether to raise the Terms to Version 3 (term 11 was rewritten inside Version 2); (3) the Feature Catalog PDF still says "paid instantly".

### Fix after Step 2 testing — paid requests invisible to the owner (migration 453)
Philips Edward paid for a hotel room; the owner (08120000002) got the notification but could not find the request anywhere. Causes: the Owner dashboard only listed *confirmed/active* bookings, so a pending request showed nowhere (Accept/Decline lived only on /host); booking-request notifications always linked to /owner, which bounces non-owners to the home page; guest cancellations told nobody; and the property name was read in the wrong shape in 24 places, showing the generic word "Property".
Now: a red **"booking requests awaiting your decision"** panel sits at the very top of both the Owner and Host dashboards (guest, dates, what the host receives, 24h countdown, Accept/Decline); notification links are role-aware (/owner or /host) and existing notifications were corrected; the host and admin are told when a guest cancels; and one shared helper (`lib/embedded.ts`) fixes the property name everywhere.

### Step 2 — what exists now
- **Guest calendar** (`AvailabilityCalendar`) in the shortlet/hotel booking form and the venue/hire form: green available (with "n left" when a place has several rooms), amber dashed "requested — may reopen", red crossed-out booked. A guest can check out on the day the next guest arrives. Refreshes every minute; if the dates a guest has picked are taken meanwhile, they are cleared with a clear message. Event venues use the same calendar one day at a time.
- **Room types**: the booking form shows a room-type picker (Executive / Standard…), each with its own nightly price (a type's price overrides the listing price). The system assigns a free room of that type.
- **Host console** `/host/calendar/[listing]`: a tape chart (rooms down the side, 14 days across). Tap a free square to record a walk-in guest or block the room; tap a block to remove it; tap a guest's square for details (guest bookings and requests cannot be deleted from here). "Fully booked or closed?" blocks every free room for a period in one action. Rooms and types are set up here, in bulk ("101-112, 201, 204"). A listing's "Whole property" placeholder room that already holds a booking is flagged for renaming into a real room number.
- **"My calendar is accurate"**: one tap per listing, and one tap for all of a host's listings on the host dashboard. Each listing shows how fresh its calendar is.
- **Admin**: the Shortlet/Hire Bookings tab lists every active listing whose calendar has not been confirmed in 3+ days (red), with the host's phone, rooms and pending requests.
- **Daily reminder** to hosts at 07:00 Nigerian time (one per host, never twice in 20 hours).
- **My Bookings**: once confirmed, the guest sees their room number and type.
- Fixed on the way: a past check-in is now refused; a one-day hire (start = end) was always rejected by the database and is now chosen as "that day and the day after"; the event-date calendar no longer loses a date on its background refresh.
- **Not yet done (later steps):** the request-before-pay flow with admin relay (step 3), Instant Confirm / Express (4), peak pricing (5), host cancellation penalties (6), digital check-in (7). Today a guest still pays at request time and the host answers; the calendar and holds make that safe, step 3 changes the order.
- **Needs the host's attention once:** the demo hotel's placeholder room holds Philips Edward's pending request — rename it to a real room number in the console.

### Step 1 — what exists now
- `room_types`, `property_units` (every shortlet/hire listing has at least one room), `unit_calendar` (the single ledger of taken nights per room: held / confirmed / blocked / walk_in).
- A database **exclusion constraint** makes two entries for the same room and night impossible, from any code path or timing.
- Triggers keep the ledger in step with bookings; a request takes its hold **before** any money moves, so a clash means no charge.
- Holds last `platform_settings.shortlet_host_response_hours` (24). `sweep_expired_booking_holds()` runs every 5 minutes (pg_cron job `chs-expire-booking-holds`): an unanswered request is declined and refunded in full, exactly what was paid.
- `get_property_availability(property, from, days, room_type)` — dates and room counts only, no guest data.
- Fixed on the way: a host declining a booking did not refund the security deposit; a host could "confirm" a request already declined/refunded.
- The guest booking forms now show a clear message when dates are taken (previously they would have shown "Could not complete this booking. Please try again.").
- **Not yet visible to guests:** the calendar itself (step 2). The protection is in place; the picture is not.

## Digital check-in (added to the plan — step 7)

**Scenario:** the guest reaches the hotel; four or five people are queuing at reception. How does he confirm his reservation and check in so staff simply hand over the key?

**Principle:** the slow part of a hotel check-in is paperwork (registration card, ID copying, printing), not handing over a key. Do all of that in the app, beforehand, and make the desk step a ten-second verification.

1. **Pre-registration (7b).** After the booking is confirmed, the guest completes the hotel's registration card in the app: details CHS already holds (name, verified ID, phone) are pre-filled; the guest adds address, nationality, vehicle plate, purpose of visit, next destination, ETA, signature. The host sees "Pre-registered ✓".
2. **Arrival pass (7a).** The booking page shows a signed QR code and a short code, tied to the booking and dates, plus: assigned room/type, "Paid via CHS", "ID verified by CHS". A screenshot works with no data at the desk — the **host's** device verifies it online.
3. **"I've arrived" (7c).** Optional one-tap alert (location permission, within ~500 m) that pings the host console — "Mr X has arrived — Room 204 ready" — so reception prepares the key while serving the queue. Hotels can designate an "app check-in" lane.
4. **At the counter.** Guest shows the QR/code; staff scan it (or type the code) in the **Arrivals board**; it shows the verified guest, room and paid status; staff hand over the key and tap "Checked in" (time-stamped). A glance at the physical ID against the CHS-verified name remains — many hotels are required to see ID — but nothing is written, copied or printed.
5. **Host Arrivals board (7a).** Today's arrivals by ETA with chips: Awaiting → Arrived → Checked in → No-show. Walk-ins recorded at the front desk (step 2) appear on the same board — one true picture of the house.
6. **Front-desk staff login (7c).** The person at the counter is not the owner: a limited login that sees only the Arrivals board and the scanner — no wallet, no earnings.
7. **Plugs into what exists:** check-in triggers the existing shortlet condition report and starts the escrow release timeline; a no-show cutoff (host marks no-show, e.g. next day 12:00) releases the room and follows the existing cancellation terms; ETA is mandatory for Express bookings.
8. **Optional self check-in (7c):** for guest houses with keypad locks or lockboxes, the host enters a one-time code per booking, revealed to the guest only at check-in time.

**Honest limits:** no digital room keys (lock systems vary widely and most Nigerian hotels use physical keys); hotels may still require sight of ID; the "I've arrived" alert needs location permission and a decent GPS fix; the host's device must be online to verify a pass.

**Small hooks built into earlier steps so step 7 is not a rewrite:** the guest sees their assigned room (step 2); the request captures an ETA (step 3).
