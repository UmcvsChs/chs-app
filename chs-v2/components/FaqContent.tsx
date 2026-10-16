"use client";

import { useState } from "react";
import Link from "next/link";

// Real, new FAQ per a direct, confirmed gap — deliberately built from
// CHS's own real Terms & Conditions and actual, working features,
// not copied from any other platform's answers. Every answer here
// traces back to a real clause or a real, tested piece of CHS itself.
const FAQ_ITEMS = [
  {
    q: "I own a property. How do I ask CHS to manage it?",
    a: "List the property yourself (or open one you already listed), then go to My Properties and press Ask CHS to manage this property. Choose what CHS should manage it for (rent, shortlet, sale, hotel or commercial), say in what capacity you act, upload the documents CHS asks for, read the full terms and accept. You pay one CHS management fee, which replaces the standard owner-side fee. CHS checks your documents, and once the listing is verified and CHS approves, the property shows the Managed & Advertised by CHS stamp and gets a CHS tag. You can withdraw a pending request, or ask CHS to stop managing the property later.",
  },
  {
    q: "How do I know a property is really managed by CHS?",
    a: "Properties CHS manages or advertises carry a CHS stamp and a tag such as CHS-100002-3, shown on the listing card and the listing page. Use the Managed by CHS button on the home page to see only those. A badge picture can be copied, but a tag cannot be faked: type it at the Check a CHS tag page and CHS will tell you whether it is genuine and still active. Only CHS staff can give a listing the stamp. A listing without it is from another owner or agent, who sets their own fees, which must be shown on the listing. Never pay anyone because of a picture of a badge.",
  },
  {
    q: "How do I know an agent is really approved by CHS?",
    a: "A CHS-approved agent is a registered company or firm (CAC, ESVARBON or QSRBN) whose owners CHS has fully verified and which has a proven record of at least 10 paid transactions on CHS in the last 180 days. Their listings show a gold strip with the registered name, registration number and CHS agent ID. You can check any agent ID on the Check an agent page without logging in. If an agent says they are approved but the ID does not check out, do not pay them anything outside your CHS account.",
  },
  {
    q: "How do viewing time slots work?",
    a: "Some owners set the days and hours they can show a property. When you book an inspection on those properties you pick one free slot, and no one else can take it. You can move your visit to another free slot from My Inspections up to 12 hours before. You get a reminder the day before and a few hours before. If the owner has set no slots, you suggest a time as before.",
  },
  {
    q: "Can I pay rent monthly or quarterly?",
    a: "On CHS-managed rentals, if the landlord has allowed it. You choose a plan when you first pay, or within 30 days of your lease end for the next year. Each instalment is held safely by CHS like a full-year payment. Your one-time CHS agency fee is paid with the first instalment. If the property does not offer instalments, you pay the full year.",
  },
  {
    q: "How much does CHS actually charge?",
    a: "It depends on what you're doing, and it's always split between both sides — never charged twice for the same amount. Rent/lease: a 6% agency fee from the tenant and a 4% service charge from the landlord (from year two onward, the tenant pays nothing further — only the landlord, at a reduced 3%). Sale: a 6.5% agency fee from the buyer and a 6% service charge from the seller. Rent to Own: 5% buyer / 5.5% seller, charged on each real instalment as it's paid. Shortlet: a sliding scale by length of stay, from 7%/5% down to 5%/3%. Hotel, Event Centre, and hourly Car Park bookings: a flat 6%/4%. There is no separate inspection fee as standard.",
  },
  {
    q: "When exactly do I pay CHS's commission?",
    a: "For a sale, it's calculated automatically the moment the seller accepts your offer, and shown to you as one combined total — the price plus commission — charged in a single payment, never two separate charges. For a shortlet or hire booking, the real total (including CHS's fee) is shown to you before you ever commit to a request, not added afterward.",
  },
  {
    q: "Is there a separate legal fee, and who pays it?",
    a: "CHS itself does not charge a separate 'legal fee' as standard. For a sale specifically, the owner is required to have real legal documents (Certificate of Occupancy, Deed of Assignment, Survey Plan, Governor's Consent, Tax Clearance, Sale Agreement, and Building Plan Approval where applicable) verified by CHS before a buyer's payment can proceed — this verification is part of CHS's own role, not a separate line item billed to you. If you separately engage CHS for a professional service like Sale Negotiation or full Property Management, that carries its own real, distinct fee schedule, shown to you before that service begins.",
  },
  {
    q: "Can I pay a landlord or seller directly, outside the platform?",
    a: "No. Every transaction started on CHS must be completed on CHS. Concluding a deal introduced through the platform outside it does not remove CHS's commission — it remains legally owed, and doing so gives up the real protections (escrow, dispute resolution, document verification) that only apply to transactions completed properly through CHS.",
  },
  {
    q: "How does CHS protect my money?",
    a: "All funds are held in escrow until the real conditions for release are met. For a sale specifically, a seller's proceeds appear in their wallet immediately but stay locked until CHS confirms the real legal documents have genuinely been transferred to the buyer. For a shortlet, hotel or hire booking you pay nothing when you send the request; you pay only after the host confirms the dates are free, and your payment is then held until your stay begins. And if the other side of your deal later fails to deliver, you are entitled to your full payment back, including CHS's own commission, less only a small real bank processing fee — see the next questions for exactly how.",
  },
  {
    q: "How does booking a hotel, lodge, shortlet or event centre work — and when do I pay?",
    a: "You send a request and nothing is charged. CHS passes it to the host, who confirms the dates are free. You are then notified and have a short window to pay from your CHS Wallet — your payment is held safely by CHS, CHS can release a percentage to the host (normally 60% of their payout) before you arrive so they can prepare for you, and the balance is released when you arrive and confirm, with a short checklist in the app, that everything is as described (or automatically 24 hours after check-in if you do not respond). The time allowed depends on how soon you arrive: for a stay more than 3 days away the host has 24 hours and you have 6 hours to pay; for a stay in 1 to 3 days, 6 hours and 2 hours; for a stay starting today, 30 minutes and 20 minutes. If the host can't take you, doesn't reply, or you don't pay in time, the request simply lapses and you pay nothing. For a stay starting within 3 days your wallet must already hold the full amount when you send the request, so a host is never asked to hold a room for someone who can't pay.",
  },
  {
    q: "Can I contact the host (or the guest) directly?",
    a: "No — and that protects both sides. CHS relays every booking request and every message between a guest and a host. Your request goes to CHS first, and CHS passes it to the host. Until a booking is paid, CHS reviews each message before it is delivered, and phone numbers and email addresses are blocked at all times. A host sees only the guest's name and a CHS reference, never their phone number; a guest never sees who the host is. Once your booking is paid you can message through the booking itself, still without sharing contact details.",
  },
  {
    q: "When does the host get paid for a hotel, lodge or shortlet stay?",
    a: "In two parts. Booking is prepaid: you pay before your stay and CHS holds the money safely. The money stays in CHS escrow. As agreed in the host terms, CHS can release a percentage to the host (normally 60% of their payout, after CHS commission) before you arrive so they can prepare for you; an admin does this by hand and can raise or lower the percentage. The balance is released the moment you arrive and confirm in the app that the property is as described and each listed facility is present and working, the money is released to the host and both the host and CHS receive your confirmation. If you do not respond, it is released automatically 24 hours after check-in. If something is wrong, report a problem instead and the payment stays held while CHS looks into it. A host whose guest has arrived can also ask CHS to release it.",
  },
  {
    q: "What is the difference between an Artisan, a Vendor and a Service Provider?",
    a: "An Artisan does skilled trade work, such as plumbing, electrical work, carpentry or painting. A Vendor sells goods: furniture, electronics and home appliances, bedding and textiles, kitchen items, building materials or interior design items. A Service Provider offers a service: security, cleaning, fumigation and pest control, or facilities maintenance. Each has its own registration, and each is reviewed by CHS before it is shown to the public.",
  },
      {
    q: "Why was my listing hidden, or why am I asked to confirm it is still available?",
    a: "A property for sale, rent or lease must be confirmed as still available every 30 days. CHS reminds you at 25 days, and an unconfirmed listing is hidden from the public after 30 days. Open your dashboard and tap Confirm available and it is visible again at once. This stops listings that are already taken from wasting people's time.",
  },
  {
    q: "How do I report a listing, and will the owner know it was me?",
    a: "Open the listing and tap Report this listing. Choose a reason, such as a hidden or wrong price, a fake or copied listing, already taken, or scam behaviour. The owner is not told who reported. CHS reviews it, may ask the owner to fix it or take the listing down, and tells you the outcome.",
  },
{
    q: "Why can't I submit a listing without the price, or when I write \"DM for price\"?",
    a: "CHS does not allow hidden prices. Every listing must show its real price, location, street address, at least five photos, a video, a description and a private contact number before it can be submitted, and the database will not let an incomplete listing go live even if a screen is bypassed. Wording such as DM for price, inbox for price or call for price is refused. A service must show a starting price. Your contact number is kept private for CHS and you; it is not shown publicly.",
  },
{
    q: "How do I list a product properly as a Vendor?",
    a: "Open your vendor dashboard and tap Add a listing. Give the brand, model and condition, the price and how many you have in stock, then the specification for your kind of product (for a television: size, features, power, dimensions; for furniture: material and dimensions), then any options the buyer chooses, such as colour or size, a warranty and delivery information, and up to six clear photos. Fields marked with a red star are required. When your stock reaches zero the listing shows Sold out automatically, and reopens when you restock.",
  },
  {
    q: "How is my wallet protected from fraud?",
    a: "In layers. (1) A separate 6-digit transaction PIN, which you set under Wallet security, is asked for whenever money leaves your wallet; five wrong tries lock it for 30 minutes. (2) Only ID-verified users can send money to another CHS user, and there are limits per transfer and per day, with a lower cap on a first transfer to someone new. (3) Money you receive from another CHS user can be used inside CHS at once, but can only be withdrawn to a bank after 24 hours. (4) You are alerted the moment money leaves your wallet. (5) If you suspect anything, tap Freeze my wallet and nothing can leave until CHS verifies you. (6) If your account is opened on a device CHS has not seen before, you are alerted, and for the first day a larger transfer or withdrawal from it needs extra confirmation (a code texted to your phone once SMS codes are switched on, or a lower limit until then). (7) Money you add by card also waits 24 hours before it can go to a bank. (8) CHS scans wallet activity every 15 minutes for unusual patterns and reviews anything suspicious. (9) If you were tricked or did not authorise a transfer, tap Report this transfer beside it: CHS holds that amount in the recipient's wallet and investigates, and can reverse it while the money is still there. Never share your PIN, and never send money because someone asks you to — CHS never asks.",
  },
  {
    q: "I got a message saying a new device signed in to my account. What should I do?",
    a: "If it was you on a new phone or browser, nothing — for the first 24 hours, larger transfers and withdrawals from that device need extra confirmation, and then it is treated as your usual device. If it was NOT you, open your wallet and tap Freeze my wallet now, then contact CHS so we can verify you and help you secure your account. Never share your PIN or any code CHS texts you.",
  },
  {
    q: "I sold a property and handed over the documents. How do I get my money?",
    a: "Your proceeds, after CHS's commission, are held safely from the moment the buyer pays. They are released when the buyer confirms in the app that they have the documents, or when CHS confirms delivery. If the buyer has not confirmed, open your Owner dashboard and tap Request release of my money, with a short note of how and when you delivered. CHS then verifies delivery from the platform's records or by contacting the buyer, tells the buyer you have asked, and either releases your money or tells you what is still outstanding. Only that sale's money is released, never anything else in your wallet.",
  },
  {
    q: "Can I pay an agent, an owner, a host or CHS staff directly — or into an account?",
    a: "No. Every payment on CHS — rent, purchases, bookings, inspection costs, fees — is made through your own CHS Wallet inside the app, and nowhere else. Never transfer money to any person or bank account, even if they say they represent CHS. CHS staff and agents will never ask you to pay into a personal account, to “send it first”, or to share your PIN or wallet code. If anyone asks you to pay any other way, it is a scam: stop, do not pay, and report it to CHS straight away.",
  },
  {
    q: "Who pays for a physical inspection, and how?",
    a: "Photographs and room videos are free, and you can ask the owner for more of either. If you still want to see a property in person, the whole transport cost is yours — never split with the owner and never carried by CHS. CHS assigns an agent and confirms the final cost, worked out from where the agent sets off to the property and back (₦150 per km each way). You then pay it from your CHS Wallet in My Inspections. It is held safely and passed to the agent after the visit. You are refunded in full if the owner or CHS cancels, or if you cancel at least 12 hours before; inside 12 hours it goes to the agent. A visit you have not paid for 2 hours before it is due lapses, and nothing is charged.",
  },
  {
    q: "Why am I asked what time I will arrive?",
    a: "So the host can have your room ready. For a booking that starts today it is required, because the host has only 30 minutes to reply and needs to know when to expect you. For other bookings it is optional but helpful.",
  },
  {
    q: "Can I cancel a shortlet or hire booking, and will I get a refund?",
    a: "Yes. A request you haven't paid for yet can be withdrawn at any time at no cost. Once you have paid, a real, stated policy applies: a full refund if you cancel 48 or more hours before check-in, 50% if you cancel within 48 hours, and no refund once check-in has passed. This is calculated and enforced automatically, not left to a manual decision. The part that is not refunded compensates the host for the dates they held (less CHS's commission), and CHS keeps its service fee on it; a security deposit is always returned.",
  },
  {
    q: "What if the seller, landlord, host or vendor doesn't deliver — do I get my money back?",
    a: "Yes. This applies to every tenant, buyer and guest, and it is written into term 36 of the Terms & Conditions. Because your money is held in escrow, it is still with CHS — it has not reached the other side. If they fail to do what they agreed, you get back the full price you paid, plus CHS's own commission from you, less only a small real bank processing fee. The refund opens at different points: for a sale, once the document-delivery window has passed without the legal transfer being confirmed; for rent, once the grace period has passed with no clean move-in report; for marketplace goods and for shortlet or hire bookings, once CHS has reviewed what went wrong. A host who simply declines your request at the start refunds you in full with nothing deducted at all. The refund is credited to your CHS Wallet and you are told the exact amount and the exact fee.",
  },
  {
    q: "How do I actually ask for a refund?",
    a: "For a sale, once the document window has passed you will see a 'Request refund & cancel this deal' button on the property page. For a shortlet or hire booking you can cancel from My Bookings (see the cancellation policy above), and if the host fails to honour a confirmed booking, contact CHS and the team will review it. For rent and marketplace purchases, contact CHS support and give the property or order reference — the CHS team reviews it and, if the other side failed to deliver, processes the refund for you. In every case a real reason is recorded.",
  },
  {
    q: "Is CHS keeping my commission if the deal fails? What is the bank fee I'm charged?",
    a: "No — CHS does not keep a commission on a deal that failed because of the other side. The only amount kept is a real bank processing fee: when your original payment moved, CHS's payment provider charged a transfer fee that cannot be recovered. It is worked out as 1.5% of CHS's commission from you plus ₦100, and is never more than ₦2,000, however large the deal. For example, if CHS's commission from you was ₦100,000, the fee is ₦1,600 and you receive the full price plus ₦98,400 back. The commission CHS would have charged the other side is cancelled too.",
  },
  {
    q: "I'm an owner, landlord, host or vendor — what happens to my side if the buyer or tenant is refunded?",
    a: "The deal is reversed. The money CHS was holding for you on that deal is removed from your held balance (only that deal's share — your other held amounts are untouched), CHS's commission from you on that deal is cancelled, and you are told the reason. For a sale or a first-year rent, your property is listed as available again. A refund only happens after the agreed deadline has passed without you delivering, or after CHS has reviewed a failure, so delivering the documents, keys or service on time protects your payout.",
  },
  {
    q: "On a Mortgage (Rent to Own), who holds my payments?",
    a: "CHS does. Every instalment you pay goes from your CHS Wallet to CHS first, is recorded, and is released to the owner by CHS. You can pay one instalment or any larger amount up to the full balance. The owner never receives money directly from you, and never sees your phone number.",
  },
  {
    q: "When does the owner get the final payment on a Mortgage?",
    a: "Only after the property documents are in your hands. When you have paid in full, you request your documents. The owner uploads them for CHS to check, CHS approves, the owner sends the hard copies, and you confirm in the app that they arrived. CHS then releases the final payment. A CHS super admin does this by hand, so your confirmation alone does not move the money; during very busy periods CHS may switch on automatic release.",
  },
  {
    q: "What happens if a host cancels my confirmed hotel booking?",
    a: "You are refunded in full, the dates stay blocked, and CHS helps you find another place. The host must give a real reason, and is penalised: a warning the first time, a 10% penalty the second time within 90 days, and suspension of the listing the third time.",
  },
  {
    q: "How does hotel check-in work?",
    a: "Once your booking is confirmed you get an arrival pass with a code. Fill in the short registration card before you travel. When you arrive, tap I have arrived; the front desk verifies your pass and checks you in. If the host uses a lockbox, its code is shown to you only on your stay days after you have arrived.",
  },
  {
    q: "What can a hotel owner manage on CHS besides bookings?",
    a: "Each hotel or lodge has a Hotel operations panel on the host dashboard: a housekeeping board (which rooms are occupied, to clean or ready), repair tickets with costs, income from the restaurant, bar, laundry, gym and events, expenses, and an owner-only report showing occupancy, average room rate, revenue per available room and the net result, with a downloadable ledger. Every entry is stamped with who made it and the exact date and time, and a wrong entry is voided with a reason rather than erased. Guests get a welcome at check-in and a thank-you after check-out, and the owner gets a summary each evening.",
  },
  {
    q: "Can a hotel owner add staff, assign duties and move over from Excel or another booking site?",
    a: "Yes. The owner adds staff by phone number with a role (manager, front desk, housekeeping, kitchen or bar, accountant) and can limit each person to certain properties. The owner or a manager assigns duties with a due time; staff mark them done and send shift reports, and each carries the person's name and exact time. Rooms, income and expenses can be imported from an Excel or CSV sheet, with a preview before anything is saved and an Undo afterwards. A private calendar link per room can be shared with Booking.com, Airbnb or Google Calendar, and their calendars can be linked into CHS so a room booked elsewhere is blocked here too. Free Listed hosts get the basics; Pro and Business plans add the team and finance tools and a lower CHS commission.",
  },
  {
    q: "How do the Pro and Business plans work, and what if I stop paying?",
    a: "A plan is paid from your CHS Wallet for 30 days and renews from your wallet until you cancel. If a renewal fails, you have 7 days to top up. After that you move to the free Listed plan: your records, reports and ledger stay readable and downloadable, you just cannot add new Pro records until you subscribe again. A paid plan lowers the commission CHS charges you on bookings CHS brings you. CHS charges no commission on walk-in guests or direct sales you record in the tools.",
  },
  {
    q: "Can I ask for ushers, a caterer, a live band or security for my event?",
    a: "Yes. When you request an event centre, tick the services you want (ushers, caterer, live band, security, with numbers where it matters) or write anything else you need. Your request goes through CHS to the venue, who tells you what is possible. Nothing is charged until the venue confirms, and you pay from your CHS Wallet.",
  },
  {
    q: "When does an event centre get paid, and what is the 60% advance?",
    a: "After you pay, CHS holds the money. About 48 hours before the event CHS pays the venue an advance (currently 60% of what it earns) so it can prepare, and the balance after the event. If the event is cancelled after the advance, CHS takes the advance back from the venue first and then refunds you under the cancellation rules in term 11 (and term 40 where it applies).",
  },
  {
    q: "Do I need documents for my event, and is there a limit on guests?",
    a: "Larger or higher-risk events (such as concerts, festivals, political events or 200+ guests) may need documents like a permit or police clearance, which you can attach to the booking; only you, the venue and CHS can see them. Each venue states its licensed capacity, and a booking for more guests than that is refused.",
  },
  {
    q: "Can I choose how the hall is set up?",
    a: "Yes. If the venue has listed seating layouts (banquet, theatre, classroom, U-shape, boardroom, standing), open your booking, go to Services and changes and tap the one you want. A layout that cannot hold your number of guests is greyed out. The diagrams are illustrations, not a plan of the hall.",
  },
  {
    q: "Can I book more than one hotel room and pay once?",
    a: "Yes. Choose the number of rooms, adults and children. Each room is requested separately and the host confirms them; then \"Pay all rooms at once\" pays for all of them together from your wallet.",
  },
  {
    q: "Is there a discount for a long stay?",
    a: "Hosts can offer a weekly discount (7+ nights) and a monthly one (28+ nights). If the property has one, you see it as its own line in the price before you pay.",
  },
  {
    q: "Can I search by dates, or for step-free access?",
    a: "Yes. Pick check-in and check-out dates on the home page to see only places free on those dates, and use the accessibility filter for features like step-free access.",
  },
  {
    q: "I am bringing a group or company. Can I ask for a rate?",
    a: "Use the group enquiry form on the hotel or lodge page. It goes to the host through CHS. It is not a booking, and phone numbers or links are not allowed in it.",
  },
  {
    q: "Can I hire a field or a stadium?",
    a: "Yes. Open fields and stadiums are listed under Hire. The page shows the ground details (surface, floodlights, toilets, safe crowd limit, rain plan, curfew). You must keep to the crowd limit and the curfew.",
  },
  {
    q: "What does CHS need before it can manage my hotel or event centre, and what does it cost?",
    a: "Proof of ownership, the venue's operating permit or licence (it states the licensed capacity), a public liability insurance certificate and, for event centres and open venues, a fire safety certificate, plus company papers or a power of attorney if you are not the owner. CHS checks them. The fee is 5% of gross revenue plus 10% of gross operating profit, which replaces the usual host-side booking commission (guests still pay the published guest-side fee). The full terms are shown before you accept them.",
  },
  {
    q: "Does CHS charge VAT on top of its fees?",
    a: "Not at present. If CHS becomes required to charge or account for VAT on its own fees, the amount shown to you already includes it unless CHS tells you before you pay (term 46). CHS will tell you first if this ever changes what you pay.",
  },
  {
    q: "Why was I asked to accept the Terms & Conditions again?",
    a: "Because the Terms changed. Each version of the Terms has a number, and when it changes everyone is asked to read and accept the new one once. You are shown what is new — for version 3 it is the request-first way of booking hotels, lodges and venues (term 11) together with term 36, refunds when the other side defaults — and then asked to scroll through and accept. Your acceptance is recorded permanently with the version number and the exact time, so there is always a clear record of what you agreed to and when. You will not be asked again unless the Terms change again. Version 4 (October 2026) adds the wallet-only payment rule, the wallet protections, the inspection cost rule, the release of sale money and the Rent to Own changes. Version 5 (October 2026) makes every Mortgage (Rent to Own) payment pass through CHS and holds the final payment until the property documents are handed over. Version 6 (October 2026) adds term 37: CHS keeps an exact date-and-time record of important events, and those records can be relied on as evidence in a dispute.",
  },
  {
    q: "What does a 'CHS Verified' or 'Verified Listing' label actually mean?",
    a: "For a property listed under Urgent & Emergency Sale, it means the listing and the owner have both genuinely passed CHS's ID and document verification before that label is shown. More generally, any sale listing's required legal documents must be independently verified by CHS before a buyer's payment can proceed at all.",
  },
  {
    q: "What if a property looks different from what I saw on the platform, or something is wrong with it?",
    a: "You can raise a real, direct dispute or fault report — CHS reviews both sides before making a ruling, rather than taking one party's word over the other's.",
  },
  {
    q: "What do I actually need to register?",
    a: "A real, valid NIN, plus a genuine photo or scan of an accepted ID (National ID/NIN slip, Voter's Card, International Passport, or Driver's Licence) with its real number entered — this is checked by CHS before your account is approved, not just collected and filed away.",
  },
  {
    q: "How do I close my account?",
    a: "From your Profile page, you can deactivate your account at any time. This genuinely hides your account and listings from CHS immediately — nothing is deleted, and logging back in reactivates it instantly.",
  },
  {
    q: "Where do my booking messages go, and where does the host see them?",
    a: "Every booking message goes through CHS first. CHS passes it on, and the other person is notified. The host finds it in Host console > Messages (with a number badge) and inside the booking under \"Details, services, messages & more\". The guest finds replies on My Bookings under the booking's Messages box. To ask for more guests or a new date, use the \"Open the change request form\" link in that Messages box.",
  },
  {
    q: "How do I buy several things from the Marketplace and pay?",
    a: "Open an item, choose its options and quantity, and tap Add to cart (or Buy now). Keep shopping; a cart bar stays at the bottom and your cart is kept on your phone even if you go back or close the page. Open the cart, check quantities, enter one delivery address and pay from your CHS wallet. If your wallet is short, tap Top up wallet inside the cart and come straight back. Your money is held by CHS until delivery is confirmed, and every order is listed under My Orders & Requests.",
  },
  {
    q: "The host says they never saw a booking request. What can CHS do?",
    a: "Once CHS has passed a request to the host, an admin can resend it from the Bookings tab. This gives the host a fresh reply window and a new notification. If the request is no longer needed, or the host has not answered, the admin can withdraw it, and both the host and the guest are told. If a request has expired, the admin can re-open it, provided the dates are still free. The admin screen shows the host's name and phone number, because the host must be logged in with that phone number to see the request.",
  },
  {
    q: "Can a payment happen by accident?",
    a: "No. Opening a page or a notification never pays anything. Every payment button first asks you to confirm the exact amount, and money leaves your wallet only after you tap \"Yes, pay\". If you did not tap it, nothing was charged. You can always check Wallet > history.",
  },
  {
    q: "Why does CHS ask for my transaction PIN when I pay?",
    a: "Paying from your wallet needs your 6-digit transaction PIN (the same PIN used to send money or withdraw), so nobody who picks up your unlocked phone can spend your money. If you have not set one yet, CHS asks you to create it at your first payment. Your approval lasts 2 minutes and works for one payment only. Five wrong tries lock the PIN for 30 minutes.",
  },
  {
    q: "A request was not seen by the other person. What can CHS do?",
    a: "On every request that CHS relays (bookings, rental applications, offers, marketplace quotes, rent-to-own) the admin can Resend it to whoever is waiting, whether that is the host, owner, seller, vendor, guest, tenant or buyer. Make sure you are logged in with the phone number shown on the admin card. If a request is no longer needed, CHS can Withdraw it with a reason. Both sides are told and nothing is charged. Paid items are refunded through the normal refund process instead.",
  },
  {
    q: "Can I choose my exact room, and keep my family on the same floor?",
    a: "Yes, when the hotel has set up its rooms. After you choose your dates, the booking form lists every room by floor, showing which are free and which are taken. Tap the room or rooms you want, or tap Keep us together and the system suggests free rooms on the same floor and closest to each other. If you pick nothing, the hotel gives you the next free room. Rooms must be of the same type in one request.",
  },
  {
    q: "When does the host get paid for a hotel or shortlet booking?",
    a: "In two parts. Your payment stays in CHS escrow. As agreed in the host terms, CHS can release a percentage of the host’s payout (normally 60%) before you arrive so they can prepare for you, and the balance is released when you arrive and confirm everything is as described, or automatically 24 hours after check-in. If the stay is cancelled or refunded, what was released is taken back from the host.",
  },
  {
    q: "What is the transaction PIN, and how is it different from my login PIN?",
    a: "Your login PIN opens your account. Your transaction PIN is a second, separate 6-digit PIN that you type every time you pay from your wallet. You set it as soon as you join (or the next time you open the app, if you joined earlier). It must be different from your login PIN, so that someone who learns your login PIN still cannot spend your money. Never share either PIN with anyone, including CHS staff. After 5 wrong tries the transaction PIN locks for 30 minutes.",
  },
  {
    q: "I forgot my PIN. How do I reset it?",
    a: "Use \"Forgot your PIN?\" on the login screen. Since CHS doesn't use email or SMS codes for this, you verify your identity with the real phone number and NIN you registered with, then set a brand new PIN immediately.",
  },
  {
    q: "Is my personal data safe?",
    a: "Sensitive documents — ID scans, selfies, legal paperwork — are stored in a real, private storage system, never a public link, and only ever opened through a fresh, time-limited access link generated at the moment someone with genuine permission views it.",
  },
];

export default function FaqContent() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {FAQ_ITEMS.map((item, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full text-left px-4 py-3 flex justify-between items-center gap-2"
          >
            <span className="text-sm font-semibold text-chs-charcoal">{item.q}</span>
            <span className="text-gray-400 text-lg shrink-0">{openIndex === i ? "−" : "+"}</span>
          </button>
          {openIndex === i && (
            <p className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">{item.a}</p>
          )}
        </div>
      ))}

      <div className="bg-[var(--zone-card)] rounded-xl p-4 mt-4 text-center">
        <p className="text-xs text-gray-500 mb-2">Still need help?</p>
        <Link href="/contact" className="text-sm font-semibold text-chs-red underline">Contact CHS Support</Link>
      </div>
    </div>
  );
}
