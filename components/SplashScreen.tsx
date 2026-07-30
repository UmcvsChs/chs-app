"use client";

import { useEffect, useState } from "react";

// The real splash screen, restored exactly from the original app — the
// genuine full gradient (steel-blue → dark charcoal → amber), the H
// rendered as a small house shape, the real tagline, and the exact
// real timing (2.8 seconds, then an 0.8-second fade) — not
// approximated from a description, but rebuilt directly from the
// original's own real CSS and JS.
export default function SplashScreen() {
  const [fading, setFading] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2800);
    const hideTimer = setTimeout(() => setHidden(true), 2800 + 800);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center transition-opacity duration-[800ms]"
      style={{
        background: "linear-gradient(180deg, #4A6883 0%, #161310 42%, #1E1B16 52%, #8A5220 72%, #d9661c 100%)",
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      {/* The real "CHS" mark, with the H rendered as a small house
          shape — two posts and a triangular roof — exactly matching
          the original's real design. */}
      <div className="flex items-center font-serif text-[38px] font-bold text-white leading-none">
        <span>C</span>
        <span className="relative inline-block mx-1" style={{ width: "0.62em", height: "0.78em" }}>
          <span className="absolute bottom-0 bg-white" style={{ left: "0.08em", width: "0.1em", height: "0.62em" }} />
          <span className="absolute bottom-0 bg-white" style={{ right: "0.08em", width: "0.1em", height: "0.62em" }} />
          <span
            className="absolute top-0 left-1/2"
            style={{
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "0.34em solid transparent",
              borderRight: "0.34em solid transparent",
              borderBottom: "0.3em solid white",
            }}
          />
        </span>
        <span>S</span>
      </div>

      <p className="font-serif text-[22px] font-extrabold text-white tracking-wide mb-1 mt-2">CHS</p>
      <p className="text-[11px] text-gray-300 tracking-[3px] uppercase mb-8">Complete Housing Solutions</p>
      <p className="text-[13px] text-gray-400 italic">Your property, our commitment</p>

      <div className="flex gap-2 mt-6">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}
