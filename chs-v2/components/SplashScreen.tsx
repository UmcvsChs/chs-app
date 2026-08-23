"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

// Redesigned to genuinely fill the screen the way the reference app
// does — a bordered mark in its own frame, a real bold title, a real
// subtitle, and a tagline, rather than one small logo image floating
// alone in a large empty gradient. The mark itself (icon-512.png) was
// also regenerated with bolder, less padding — the earlier version's
// generous padding, correct for in-app display, was making Android's
// own auto-generated PWA splash (the very first frame, before this
// component even mounts) look small and centered in a void.
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
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center px-6 transition-opacity duration-[800ms]"
      style={{
        background: "linear-gradient(180deg, #4B627A 0%, #1C1B1A 50%, #B56A28 100%)",
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <div
        className="rounded-3xl p-6 mb-7"
        style={{ border: "2px solid rgba(255,255,255,0.35)" }}
      >
        <Image
          src="/icon-512.png"
          alt="CHS"
          width={140}
          height={140}
          priority
          style={{ width: 140, height: 140, borderRadius: 24 }}
        />
      </div>

      <h1 className="font-serif text-[34px] leading-tight font-bold text-white text-center tracking-wide">
        COMPLETE HOUSING
      </h1>
      <div className="w-16 h-[2px] bg-white/40 my-2" />
      <p className="text-lg font-semibold text-[#E8A33D] tracking-[0.2em] mb-4">SOLUTIONS</p>

      <p className="text-[13px] text-white/70 text-center max-w-[280px] leading-relaxed">
        Nigeria&apos;s trusted property platform — connecting owners, tenants, buyers, agents, and property managers nationwide.
      </p>
      <p className="text-[13px] text-white/60 italic mt-3">Your property, our commitment</p>

      <div className="flex gap-2 mt-7">
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
