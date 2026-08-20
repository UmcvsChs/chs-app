"use client";

import { useRef, useState } from "react";
import { SERVICE_TNC } from "@/types/serviceTnc";

// A real, genuine scroll-gated Terms & Conditions specific to the
// actual CHS service being engaged — restored, found completely
// missing during the systematic Service T&C comparison. Shows CHS's
// own real, specific remuneration for this exact service, and
// genuinely requires scrolling to the end before proceeding — not a
// button that's enabled from the start.
export default function ServiceTncGate({
  serviceType,
  onAccept,
  onCancel,
}: {
  serviceType: string;
  onAccept: () => void;
  onCancel: () => void;
}) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tnc = SERVICE_TNC[serviceType];

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 20) {
      setScrolledToEnd(true);
    }
  }

  if (!tnc) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <p className="text-lg font-serif font-bold">{tnc.title}</p>
        <p className="text-xs text-white/60 mt-0.5">Please read in full before proceeding</p>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2.5 mb-4">
          This engagement is a distinct professional service from standard CHS listing — please read every section below. You must scroll to the end before you can proceed.
        </p>

        <div className="bg-chs-charcoal rounded-xl p-3 mb-4">
          <p className="text-[10px] text-chs-amber-dark uppercase tracking-wide mb-1">CHS Remuneration for this service</p>
          <p className="text-xs text-white leading-relaxed">{tnc.fee}</p>
        </div>

        {tnc.sections.map((s) => (
          <div key={s.h} className="mb-4">
            <p className="text-xs font-bold text-chs-charcoal mb-1">{s.h}</p>
            <p className="text-[11px] text-gray-600 leading-relaxed">{s.body}</p>
          </div>
        ))}
        <div className="h-6" />
      </div>

      <div className="border-t border-gray-200 px-4 py-3.5 bg-white">
        <button
          onClick={onAccept}
          disabled={!scrolledToEnd}
          className="w-full py-3.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {scrolledToEnd ? "I agree — continue" : "Scroll to the end to continue"}
        </button>
        <button onClick={onCancel} className="w-full py-2.5 text-xs text-gray-400 mt-1">
          Cancel
        </button>
      </div>
    </div>
  );
}
