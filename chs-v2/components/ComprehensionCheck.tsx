"use client";

import { useState } from "react";

// Real, new fix per direct client request: this previously asked
// every single role the exact same 4 questions, regardless of what
// they were actually registering to do. Genuinely reframed to pull
// real questions from each role's own actual, relevant section of
// the real Terms & Conditions — a buyer is tested on sale protections,
// a tenant on rental protections, an agent on the conduct rules that
// actually govern them.

const UNIVERSAL_QUESTION = {
  q: "How does CHS protect your money when you pay for a property?",
  options: [
    { label: "The owner receives it immediately", correct: false },
    { label: "It is held safely in escrow until you confirm you've received what you paid for", correct: true },
    { label: "CHS keeps it permanently", correct: false },
  ],
};

const ROLE_QUESTIONS: Record<string, { q: string; options: { label: string; correct: boolean }[] }[]> = {
  buyer: [
    {
      q: "Before a property sale can proceed on CHS, what real checkpoint must happen first?",
      options: [
        { label: "Nothing — payment can be made immediately", correct: false },
        { label: "CHS reviews and approves the real sale documents at a genuine Sale Approvals checkpoint", correct: true },
        { label: "Only the agent needs to approve it", correct: false },
      ],
    },
    {
      q: "As a Buyer, what is CHS's real commission on a property sale?",
      options: [
        { label: "6.5% from the Buyer, 6% from the Seller", correct: true },
        { label: "A flat 10% split evenly", correct: false },
        { label: "There is no commission on sales", correct: false },
      ],
    },
    {
      q: "Can a CHS agent (acting on CHS's own commission structure) demand an inspection fee or caution fee that CHS has not published?",
      options: [
        { label: "Yes, CHS agents can set their own fees", correct: false },
        { label: "No — this is strictly prohibited and results in permanent suspension", correct: true },
        { label: "Only for premium listings", correct: false },
      ],
    },
  ],
  guest: [
    {
      q: "For a real shortlet or hotel/lodge booking, when does the host actually receive your payment?",
      options: [
        { label: "The moment you book", correct: false },
        { label: "Only after the conditions for release are met — funds are held in escrow", correct: true },
        { label: "A week after check-out", correct: false },
      ],
    },
    {
      q: "What is CHS's real commission on a Hotel & Lodge, Event Centre, or casual car park booking?",
      options: [
        { label: "A flat 6% from the Guest, 4% from the Host", correct: true },
        { label: "It changes every booking with no real published rate", correct: false },
        { label: "There is no commission on these bookings", correct: false },
      ],
    },
    {
      q: "Can a CHS agent (acting on CHS's own commission structure) demand an inspection fee or caution fee that CHS has not published?",
      options: [
        { label: "Yes, CHS agents can set their own fees", correct: false },
        { label: "No — this is strictly prohibited and results in permanent suspension", correct: true },
        { label: "Only for premium listings", correct: false },
      ],
    },
  ],
  tenant: [
    {
      q: "As a Tenant, what is CHS's real rental commission, and what real, honest thing changes from your second year onward?",
      options: [
        { label: "6% Tenant / 4% Landlord in year one; from year two, the tenant pays nothing further — only the landlord, at a reduced 3%", correct: true },
        { label: "The same 6%/4% split forever, with no real change", correct: false },
        { label: "Tenants never pay any commission", correct: false },
      ],
    },
    {
      q: "If you become genuinely unreachable, can a landlord or CHS serve you a real legal notice (like an eviction or court process) through your email or WhatsApp?",
      options: [
        { label: "No, this is never allowed under any circumstances", correct: false },
        { label: "Yes — if you agreed to it at registration and genuine attempts to reach you have failed", correct: true },
        { label: "Only if you reply and agree to receive it that way each time", correct: false },
      ],
    },
    {
      q: "Can a CHS agent or property manager demand undisclosed fees, caution money, or inspection charges from you as a Tenant?",
      options: [
        { label: "Yes, this is normal practice", correct: false },
        { label: "No — Agents and Property Managers must not extort Users under any real circumstance", correct: true },
        { label: "Only if the landlord approves it first", correct: false },
      ],
    },
  ],
  owner: [
    {
      q: "As an Owner, what do you personally warrant when you list a property on CHS?",
      options: [
        { label: "Nothing — CHS takes full responsibility for ownership claims", correct: false },
        { label: "That you hold clear authority to list or sell it, with all co-owners' consent if it's inherited/family property", correct: true },
        { label: "Only that the property physically exists", correct: false },
      ],
    },
    {
      q: "When is your buyer or tenant's payment actually released to you as the Owner?",
      options: [
        { label: "The instant they pay", correct: false },
        { label: "Only after the real conditions for release are met — funds are held in escrow until then", correct: true },
        { label: "48 hours after payment, automatically, regardless of anything else", correct: false },
      ],
    },
    {
      q: "If a dispute arises with a buyer or tenant, where is it resolved first?",
      options: [
        { label: "Directly in court, immediately", correct: false },
        { label: "Through CHS's real internal dispute process first, before arbitration or the courts", correct: true },
        { label: "Disputes are never actually resolved", correct: false },
      ],
    },
  ],
  agent: [
    {
      q: "Can a CHS agent demand undisclosed fees, caution money, or inspection charges from a Buyer or Tenant?",
      options: [
        { label: "Yes, this is normal and encouraged", correct: false },
        { label: "No — Agents and Property Managers must not extort Users; this results in permanent suspension", correct: true },
        { label: "Only for high-value properties", correct: false },
      ],
    },
    {
      q: "How does your real referral link and commission actually work on CHS?",
      options: [
        { label: "It sends buyers to your own personal page, outside CHS", correct: false },
        { label: "It always opens the property on CHS itself, and commission is credited automatically when a deal completes — no manual claim needed", correct: true },
        { label: "You must manually submit a claim for every single referral", correct: false },
      ],
    },
    {
      q: "Under CHS's agent-managed listing model, who pays CHS's commission?",
      options: [
        { label: "The buyer/tenant and owner both pay CHS directly on top of your fee", correct: false },
        { label: "Neither pays CHS directly — CHS takes a real, capped 3% only from your own commission earnings, once paid", correct: true },
        { label: "CHS charges no commission at all in this model", correct: false },
      ],
    },
  ],
  manager: [
    {
      q: "Can a CHS-affiliated property manager demand undisclosed fees, caution money, or inspection charges from a tenant?",
      options: [
        { label: "Yes, this is normal practice", correct: false },
        { label: "No — Agents and Property Managers must not extort Users; this results in permanent suspension", correct: true },
        { label: "Only with the owner's verbal approval", correct: false },
      ],
    },
    {
      q: "If a dispute arises on a property you manage, where is it resolved first?",
      options: [
        { label: "Directly in court, immediately", correct: false },
        { label: "Through CHS's real internal dispute process first, before arbitration or the courts", correct: true },
        { label: "Disputes are handled entirely by you, with no CHS involvement", correct: false },
      ],
    },
    {
      q: "What happens to an account found in real breach of these terms?",
      options: [
        { label: "Nothing — there are no real consequences", correct: false },
        { label: "CHS reserves the right to suspend or terminate it", correct: true },
        { label: "Only a warning is issued, regardless of severity", correct: false },
      ],
    },
  ],
};

function getQuestionsForRole(role: string) {
  const specific = ROLE_QUESTIONS[role] || ROLE_QUESTIONS.buyer;
  return [UNIVERSAL_QUESTION, ...specific];
}

export default function ComprehensionCheck({ role, onPassed }: { role: string; onPassed: (passed: boolean) => void }) {
  const QUESTIONS = getQuestionsForRole(role);
  const [answers, setAnswers] = useState<(number | null)[]>(QUESTIONS.map(() => null));
  const [checked, setChecked] = useState(false);

  function handleAnswer(qIdx: number, optIdx: number) {
    const next = [...answers];
    next[qIdx] = optIdx;
    setAnswers(next);
    setChecked(false);
    onPassed(false);
  }

  function handleCheck() {
    setChecked(true);
    const allCorrect = QUESTIONS.every((q, i) => answers[i] !== null && q.options[answers[i]!].correct);
    onPassed(allCorrect);
  }

  return (
    <div className="bg-gray-50 rounded-xl p-3 space-y-3">
      <p className="text-xs font-bold text-chs-charcoal">Quick comprehension check</p>
      <p className="text-[10px] text-gray-500">Please answer all questions correctly to confirm you understood the real terms that apply to you.</p>
      {QUESTIONS.map((q, qIdx) => (
        <div key={qIdx}>
          <label className="text-[11px] font-semibold text-gray-700">{qIdx + 1}. {q.q}</label>
          <select
            value={answers[qIdx] ?? ""}
            onChange={(e) => handleAnswer(qIdx, parseInt(e.target.value))}
            className="w-full mt-1 px-2.5 py-2 rounded-lg border border-gray-200 text-[11px] bg-white"
          >
            <option value="">Select an answer</option>
            {q.options.map((opt, optIdx) => (
              <option key={optIdx} value={optIdx}>{opt.label}</option>
            ))}
          </select>
          {checked && answers[qIdx] !== null && !q.options[answers[qIdx]!].correct && (
            <p className="text-[10px] text-chs-red mt-1">Not quite — please review and try again.</p>
          )}
        </div>
      ))}
      <button type="button" onClick={handleCheck} className="w-full py-2 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold">
        Check my answers
      </button>
    </div>
  );
}
