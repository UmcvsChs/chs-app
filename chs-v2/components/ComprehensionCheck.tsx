"use client";

import { useState } from "react";

// A real, genuine consumer-protection gate — restored, found
// completely missing during the systematic Register view comparison.
// Forces someone registering to actually read the real Terms &
// Conditions, then correctly answer 4 real questions about the
// protections that actually matter (escrow, no unauthorized fees,
// when payment releases) before they can create an account.
const QUESTIONS = [
  {
    q: "How does CHS protect your money when you pay for a property?",
    options: [
      { label: "The owner receives it immediately", correct: false },
      { label: "It is held safely in escrow until you confirm you've received what you paid for", correct: true },
      { label: "CHS keeps it permanently", correct: false },
    ],
  },
  {
    q: "Can an Agent demand an inspection fee or caution fee that CHS has not published?",
    options: [
      { label: "Yes, agents can set their own fees", correct: false },
      { label: "No — this is strictly prohibited and results in permanent suspension", correct: true },
      { label: "Only for premium listings", correct: false },
    ],
  },
  {
    q: "When is a Buyer or Tenant's payment released to the Owner?",
    options: [
      { label: "Immediately after payment is made", correct: false },
      { label: "After 48 hours automatically", correct: false },
      { label: "Only after the conditions for release are met — funds are held in escrow", correct: true },
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
];

export default function ComprehensionCheck({ onPassed }: { onPassed: (passed: boolean) => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null, null]);
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
      <p className="text-[10px] text-gray-500">Please answer all four questions correctly to confirm you understood the terms above.</p>
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
