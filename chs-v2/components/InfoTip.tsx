"use client";

import { useState } from "react";
import { getGlossaryEntry } from "@/lib/featureGlossary";

// Real, new component per Fix Tracker item 11 — the "betting-app
// style" explainer the client described (hover on "1X2" or "over
// 2.5" and a real, plain-language note drops down). Built mobile-
// first since this app is used mainly on phones, where "hover"
// doesn't exist — a tap opens it, a second tap (or tapping elsewhere)
// closes it. Meant to sit right next to any real feature name, term,
// or button across any role's dashboard.
//
// Extended: originally every call site hand-typed its own `text`.
// This now ALSO accepts a `term` key looked up in
// lib/featureGlossary.ts — CHS's own real, previously-verified
// ~196-entry feature catalog, generated once rather than re-authored
// by hand for every remaining term. All 18 existing text= call sites
// are untouched and keep working exactly as before.
interface InfoTipProps {
  text?: string;
  term?: string;
}

export default function InfoTip({ text, term }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const explanation = text || (term ? getGlossaryEntry(term)?.explanation : undefined);

  if (!explanation) return null;

  return (
    <span className="relative inline-block align-middle ml-1">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="w-3.5 h-3.5 rounded-full bg-gray-300 text-white text-[9px] font-bold flex items-center justify-center leading-none"
        aria-label="What does this mean?"
      >
        ?
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <span className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-52 bg-chs-charcoal text-white text-[10px] leading-snug rounded-lg px-2.5 py-2 shadow-xl">
            {explanation}
          </span>
        </>
      )}
    </span>
  );
}
