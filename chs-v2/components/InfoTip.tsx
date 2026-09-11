"use client";

import { useState } from "react";

// Real, new component per Fix Tracker item 11. Built mobile-first
// since this app is used mainly on phones, where "hover" doesn't
// exist — a tap opens it, a second tap (or tapping elsewhere) closes
// it.
//
// Real fix, confirmed by a direct client report with an exact,
// reproducible cause: the earlier version also opened on
// onMouseEnter. On desktop the mouse is already hovering the button
// before a click ever lands, so hover had already set it open — then
// the click's own toggle immediately closed it again, producing
// exactly the "flashes and disappears in under a second" behavior
// reported. A functional toggle alone doesn't fix this, since a click
// genuinely cannot tell that hover (not a prior click) is why it's
// already open. The only real fix is removing hover from the equation
// entirely — this is now purely click/tap driven, on desktop and
// mobile alike, so there is no second trigger left to conflict with.
export default function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block align-middle ml-1">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((prev) => !prev); }}
        className="w-3.5 h-3.5 rounded-full bg-gray-300 text-white text-[9px] font-bold flex items-center justify-center leading-none"
        aria-label="What does this mean?"
      >
        ?
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <span className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-52 bg-chs-charcoal text-white text-[10px] leading-snug rounded-lg px-2.5 py-2 shadow-xl">
            {text}
          </span>
        </>
      )}
    </span>
  );
}
