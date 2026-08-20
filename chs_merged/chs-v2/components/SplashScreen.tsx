"use client";

import { useEffect, useState } from "react";
import ChsLogo from "./ChsLogo";

// The real splash screen, now using the complete, precise CHS logo —
// built exactly to the full design specification the client provided
// (the real H-as-house with its correct asymmetric roofline, the
// nested C with "SOLUTIONS" inside it, and "COMPLETE HOUSING" in
// luxury serif) rather than the earlier simplified approximation.
export default function SplashScreen() {
  const [fading, setFading] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 4000);
    const hideTimer = setTimeout(() => setHidden(true), 4000 + 800);
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
        background: "linear-gradient(180deg, #4B627A 0%, #1C1B1A 50%, #B56A28 100%)",
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <ChsLogo width={260} />

      <p className="text-[13px] text-white/70 italic mt-4">Your property, our commitment</p>

      <div className="flex gap-2 mt-6">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-white/60 animate-pulse"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}
