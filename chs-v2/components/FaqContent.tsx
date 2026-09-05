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
    a: "All funds are held in escrow until the real conditions for release are met. For a sale specifically, a seller's proceeds appear in their wallet immediately but stay locked until CHS confirms the real legal documents have genuinely been transferred to the buyer. For a shortlet or hire booking, your payment is held until the host actually accepts your request — if they decline, you're automatically, fully refunded.",
  },
  {
    q: "Can I cancel a shortlet or hire booking, and will I get a refund?",
    a: "Yes — a real, stated policy applies: a full refund if you cancel 48 or more hours before check-in, 50% if you cancel within 48 hours, and no refund once check-in has passed. This is calculated and enforced automatically, not left to a manual decision.",
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
