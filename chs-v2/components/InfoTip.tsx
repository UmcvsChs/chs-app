"use client";

import { useRef, useState } from "react";
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
//
// Real, direct client report from live mobile testing (owner
// dashboard, "Raise a Concern" tile near the left edge): the popup
// was centered on its trigger with a fixed CSS transform regardless
// of where that trigger actually sat on screen, so a trigger near the
// left edge pushed half the popup off-screen, cutting text off. Plain
// CSS centering can't know the real screen position; this now
// measures the trigger's actual position on open and clamps the
// popup within the viewport (with a safe margin), using position:
// fixed so it also escapes any parent's overflow:hidden.
interface InfoTipProps {
  text?: string;
  term?: string;
}

const POPUP_WIDTH = 208; // matches w-52
const EDGE_MARGIN = 12;

export default function InfoTip({ text, term }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const explanation = text || (term ? getGlossaryEntry(term)?.explanation : undefined);

  function openTooltip() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      let left = rect.left + rect.width / 2 - POPUP_WIDTH / 2;
      left = Math.max(EDGE_MARGIN, Math.min(left, window.innerWidth - POPUP_WIDTH - EDGE_MARGIN));
      setStyle({ position: "fixed", left, top: rect.top - 8, transform: "translateY(-100%)" });
    }
    setOpen(true);
  }

  if (!explanation) return null;

  return (
    <span className="relative inline-block align-middle ml-1">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); open ? setOpen(false) : openTooltip(); }}
        onMouseEnter={openTooltip}
        onMouseLeave={() => setOpen(false)}
        className="w-3.5 h-3.5 rounded-full bg-gray-300 text-white text-[9px] font-bold flex items-center justify-center leading-none"
        aria-label="What does this mean?"
      >
        ?
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <span
            style={style}
            className="z-50 w-52 bg-chs-charcoal text-white text-[10px] leading-snug rounded-lg px-2.5 py-2 shadow-xl"
          >
            {explanation}
          </span>
        </>
      )}
    </span>
  );
}
