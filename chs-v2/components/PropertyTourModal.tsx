"use client";

import { useState } from "react";

// Real, new "Take a Tour" experience per direct client instruction:
// the whole real point is letting someone genuinely decide from home
// whether a property is worth an in-person visit — a click-through
// gallery of every real photo (and the video, when one exists), ending
// in a direct, real "satisfied, I want to proceed" or "not for me"
// choice, rather than one static photo with no way to see more.
export default function PropertyTourModal({
  photos,
  videoUrl,
  propertyTitle,
  onClose,
  onSatisfied,
  onNotSatisfied,
}: {
  photos: string[];
  videoUrl?: string | null;
  propertyTitle: string;
  onClose: () => void;
  onSatisfied: () => void;
  onNotSatisfied: () => void;
}) {
  const slides = [...photos, ...(videoUrl ? [videoUrl] : [])];
  const [index, setIndex] = useState(0);
  const [showDecision, setShowDecision] = useState(false);
  const isVideo = videoUrl && index === slides.length - 1;

  function next() {
    if (index < slides.length - 1) {
      setIndex(index + 1);
    } else {
      setShowDecision(true);
    }
  }
  function prev() {
    if (index > 0) setIndex(index - 1);
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      <div className="flex justify-between items-center px-4 py-3 text-white">
        <p className="text-sm font-semibold truncate pr-2">{propertyTitle}</p>
        <button onClick={onClose} className="text-2xl leading-none">✕</button>
      </div>

      {!showDecision ? (
        <>
          <div className="flex-1 flex items-center justify-center px-2">
            {isVideo ? (
              <video controls autoPlay className="max-h-full max-w-full rounded-lg" src={slides[index]} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slides[index]} alt={`${propertyTitle} — ${index + 1}`} className="max-h-full max-w-full object-contain rounded-lg" />
            )}
          </div>
          <div className="flex justify-between items-center px-4 py-4">
            <button onClick={prev} disabled={index === 0}
              className="px-4 py-2 rounded-full bg-white/15 text-white text-xs font-semibold disabled:opacity-30">
              ← Back
            </button>
            <p className="text-white/70 text-xs">{index + 1} / {slides.length}</p>
            <button onClick={next}
              className="px-4 py-2 rounded-full bg-chs-red text-white text-xs font-semibold">
              {index === slides.length - 1 ? "Finish tour →" : "Next →"}
            </button>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-lg font-bold text-white mb-2">How did that look to you?</p>
          <p className="text-sm text-white/70 mb-6">Based on this real tour, are you satisfied enough to proceed, or would you rather keep looking?</p>
          <button onClick={onSatisfied} className="w-full max-w-xs py-3 rounded-full bg-chs-red text-white text-sm font-semibold mb-3">
            ✓ Yes, I&apos;m satisfied — proceed
          </button>
          <button onClick={onNotSatisfied} className="w-full max-w-xs py-3 rounded-full bg-white/15 text-white text-sm font-semibold">
            Not for me — keep browsing
          </button>
        </div>
      )}
    </div>
  );
}
