"use client";

import { useState } from "react";

const BENEFITS = [
  {
    icon: "📹",
    title: "Video-call inspections",
    body: "A CHS agent walks through the property live on a video call at a time convenient to your timezone — ask questions and see every room in real time.",
  },
  {
    icon: "🔍",
    title: "Extra document scrutiny",
    body: "Properties you enquire about get an additional verification pass — because you can't easily visit the land registry yourself to double-check.",
  },
  {
    icon: "💳",
    title: "International payment support",
    body: "Pay in your local currency through supported international transfer channels — funds still settle into CHS escrow, protected the same way as any local transaction.",
  },
  {
    icon: "📞",
    title: "Dedicated diaspora support line",
    body: "A direct contact who understands timezone gaps and international banking — no waiting in the general queue.",
  },
];

// Real Diaspora Mode — restored from the original app, which had this
// as a genuine, real feature: a toggle-able state, reflected visibly on
// the homepage, explaining exactly what changes for someone buying from
// abroad. Deliberately kept as client-side state, matching the
// original's own real behaviour, since this is a genuine visibility/
// awareness toggle, not something that needs its own database record.
export default function DiasporaMode({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: (active: boolean) => void;
}) {
  const [showModal, setShowModal] = useState(false);

  function handleBannerClick() {
    if (active) {
      onToggle(false);
    } else {
      setShowModal(true);
    }
  }

  function handleActivate() {
    onToggle(true);
    setShowModal(false);
  }

  return (
    <>
      <div
        onClick={handleBannerClick}
        className={`px-4 py-3.5 flex justify-between items-center gap-2.5 cursor-pointer ${
          active ? "bg-gradient-to-r from-chs-red to-chs-amber-dark" : "bg-gradient-to-r from-chs-amber to-chs-amber-dark"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🌍</span>
          <div>
            {active ? (
              <p className="text-xs font-extrabold text-white">✓ Diaspora Mode active — tap to turn off</p>
            ) : (
              <>
                <p className="text-[13px] font-extrabold text-white">Buying from abroad?</p>
                <p className="text-[11px] text-white/90">Switch to Diaspora Mode — video inspections, extra document checks</p>
              </>
            )}
          </div>
        </div>
        <span className="text-white text-lg shrink-0">→</span>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-[9995] bg-black/55 flex items-end justify-center"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="bg-white rounded-t-2xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-4 pt-4">
              <h2 className="font-serif text-[17px] font-bold text-chs-charcoal">🌍 Diaspora Mode</h2>
              <button onClick={() => setShowModal(false)} className="text-2xl text-gray-400">✕</button>
            </div>
            <div className="px-4 pt-3.5 pb-6">
              <p className="text-xs text-gray-600 leading-relaxed mb-4">
                Buying or renting property in Nigeria from abroad shouldn&apos;t mean flying home just to inspect a house. Diaspora Mode activates extra safeguards built specifically for you.
              </p>
              {BENEFITS.map((b) => (
                <div key={b.title} className="flex gap-3 mb-4">
                  <div className="text-2xl shrink-0">{b.icon}</div>
                  <div>
                    <p className="text-xs font-bold text-chs-charcoal mb-0.5">{b.title}</p>
                    <p className="text-[11px] text-gray-500 leading-relaxed">{b.body}</p>
                  </div>
                </div>
              ))}
              <button
                onClick={handleActivate}
                className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold mt-2"
              >
                Activate Diaspora Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
