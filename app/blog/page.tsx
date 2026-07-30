"use client";

import { useState } from "react";
import Link from "next/link";

// Real blog articles, restored exactly from the original app — genuine,
// complete educational content, not placeholders.
const ARTICLES = [
  {
    key: "verification",
    icon: "🛡️",
    title: "How CHS verifies every property",
    body: [
      'Every property listed on CHS starts as "Pending Verification" — no transaction can proceed until our verification process is complete.',
      "Step 1 — Document review. The owner uploads their title document (Certificate of Occupancy, Survey Plan, Deed of Assignment, or equivalent) along with a valid ID.",
      "Step 2 — Government agency check. CHS's Government Liaison Officer submits the documents to the relevant state land registry and planning authority — in Kaduna, that's KADGIS (Kaduna Geographic Information Service) and KASUPDA (Kaduna State Urban Planning and Development Authority). We confirm the document is genuine and matches official records.",
      "Step 3 — Physical inspection. Where required, CHS contract staff visit the property to confirm it matches the photos and description provided.",
      'Step 4 — Verified badge. Once everything checks out, the property is marked "CHS Verified" and becomes available for transactions.',
      "No shortcuts. If a document can't be confirmed, the property stays pending — even if that means a delay.",
    ],
  },
  {
    key: "shortlet-intro",
    icon: "🛎️",
    title: "What is CHS Short-let?",
    body: [
      "CHS Short-let lets you book a fully furnished apartment for a night, a weekend, or a week — instead of a hotel room.",
      "Why people choose it: more space than a hotel room, a real kitchen, often cheaper for groups or families, and the privacy of having the whole place to yourself.",
      "Who it's for: business travellers, wedding guests, NYSC corps members settling in before camp, or anyone wanting a home-away-from-home for a short stay.",
      "How booking works: pick your dates on the live availability calendar, choose your guest count, and pay through CHS. Your payment is held safely until check-in is confirmed. Valid ID is required before check-in details are released — this protects both you and the host.",
      "Becoming a host: if you own an apartment sitting idle, you can list it as a short-let. You set your own nightly rate and manage your own calendar — CHS handles guest verification and payment collection for you.",
    ],
  },
  {
    key: "rent-savings",
    icon: "💰",
    title: "Understanding your Rent Savings Wallet",
    body: [
      "Paying a full year's rent in one lump sum is hard for most people. The Rent Savings Wallet lets you save gradually toward your next payment instead.",
      "How it works: add any amount, any time — ₦5,000 today, ₦20,000 next week, whatever you can manage. There's no minimum and no penalty for irregular contributions.",
      "Your landlord can see your progress (not your other financial details) — this builds trust and shows you're actively working toward payment, which can help if you ever need to discuss timing with them.",
      "You stay in control. The money is yours until you choose to apply it toward rent. Optional monthly auto-contributions are available if you'd rather not think about it manually.",
      "Why it matters: this turns a stressful annual lump sum into manageable pieces — the same principle as a savings plan, just built specifically around your rent.",
    ],
  },
];

export default function BlogPage() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openArticle = ARTICLES.find((a) => a.key === openKey);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <Link href="/" className="text-xs text-gray-400 mb-4 inline-block">← Back to homepage</Link>
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-6">CHS Insights</h1>

        {!openArticle ? (
          <div className="space-y-2">
            {ARTICLES.map((a) => (
              <button
                key={a.key}
                onClick={() => setOpenKey(a.key)}
                className="w-full text-left bg-white rounded-xl p-4 flex items-center gap-3"
              >
                <span className="text-2xl">{a.icon}</span>
                <span className="text-sm font-semibold text-chs-charcoal">{a.title}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-5">
            <button onClick={() => setOpenKey(null)} className="text-xs text-gray-400 mb-3">← All articles</button>
            <p className="text-4xl mb-2">{openArticle.icon}</p>
            <h2 className="font-serif text-xl font-bold text-chs-charcoal mb-1">{openArticle.title}</h2>
            <p className="text-[10px] text-gray-400 mb-4">CHS Insights</p>
            <div className="space-y-3">
              {openArticle.body.map((p, i) => (
                <p key={i} className="text-sm text-gray-600 leading-relaxed">{p}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
