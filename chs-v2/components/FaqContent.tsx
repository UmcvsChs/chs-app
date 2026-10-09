"use client";

import { useState } from "react";
import Link from "next/link";

// Real, new FAQ per a direct, confirmed gap — deliberately built from
// CHS's own real Terms & Conditions and actual, working features,
// not copied from any other platform's answers. Every answer here
// traces back to a real clause or a real, tested piece of CHS itself.
const FAQ_ITEMS = [
  {
    q: "How much does CHS actually charge?",
    a: "It depends on what you're doing, and it's always split between both sides — never charged twice for the same amount. Rent/lease: 6% from the tenant, 4% from the landlord (from year two onward, the tenant pays nothing further — only the landlord, at a reduced 3%). Sale: 6.5% from the buyer, 6% from the seller. Rent to Own: 5% buyer / 5.5% seller, charged on each real instalment as it's paid. Shortlet: a sliding scale by length of stay, from 7%/5% down to 5%/3%. Hotel, Event Centre, and hourly Car Park bookings: a flat 6%/4%. There is no separate inspection fee as standard.",
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
    a: "You send a request and nothing is charged. CHS passes it to the host, who confirms the dates are free. You are then notified and have a short window to pay from your CHS Wallet — your payment is held safely and is released to the host as soon as you arrive and confirm, with a short checklist in the app, that everything is as described (or automatically 24 hours after check-in if you do not respond). The time allowed depends on how soon you arrive: for a stay more than 3 days away the host has 24 hours and you have 6 hours to pay; for a stay in 1 to 3 days, 6 hours and 2 hours; for a stay starting today, 30 minutes and 20 minutes. If the host can't take you, doesn't reply, or you don't pay in time, the request simply lapses and you pay nothing. For a stay starting within 3 days your wallet must already hold the full amount when you send the request, so a host is never asked to hold a room for someone who can't pay.",
  },
  {
    q: "Can I contact the host (or the guest) directly?",
    a: "No — and that protects both sides. CHS relays every booking request and every message between a guest and a host. Your request goes to CHS first, and CHS passes it to the host. Until a booking is paid, CHS reviews each message before it is delivered, and phone numbers and email addresses are blocked at all times. A host sees only the guest's name and a CHS reference, never their phone number; a guest never sees who the host is. Once your booking is paid you can message through the booking itself, still without sharing contact details.",
  },
  {
    q: "When does the host get paid for a hotel, lodge or shortlet stay?",
    a: "As soon as you arrive. Booking is prepaid: you pay before your stay, CHS holds the money safely, and the moment you arrive and confirm in the app that the property is as described and each listed facility is present and working, the money is released to the host and both the host and CHS receive your confirmation. If you do not respond, it is released automatically 24 hours after check-in. If something is wrong, report a problem instead and the payment stays held while CHS looks into it. A host whose guest has arrived can also ask CHS to release it.",
  },
  {
    q: "What is the difference between an Artisan, a Vendor and a Service Provider?",
    a: "An Artisan does skilled trade work, such as plumbing, electrical work, carpentry or painting. A Vendor sells goods: furniture, electronics and home appliances, bedding and textiles, kitchen items, building materials or interior design items. A Service Provider offers a service: security, cleaning, fumigation and pest control, or facilities maintenance. Each has its own registration, and each is reviewed by CHS before it is shown to the public.",
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
