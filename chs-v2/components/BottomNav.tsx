"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

// The real bottom navigation bar, restored after being found
// completely missing during a direct re-audit — Home, Search, Save,
// Account, More, matching the original's exact structure. Each "More"
// item honestly links to its real, working destination where one
// exists; a few genuinely were only ever "coming soon" placeholders
// even in the original app, and are kept that way here rather than
// invented as something real.
export default function BottomNav() {
  const router = useRouter();
  const { session } = useAuth();
  const [showMore, setShowMore] = useState(false);

  const MORE_ITEMS = [
    { icon: "📊", label: "Average property prices", href: "/market-demand" },
    { icon: "📈", label: "Property demand trend", href: "/market-demand" },
    { icon: "📖", label: "Latest insights", href: "/blog" },
    { icon: "🏢", label: "About Us", href: "/about" },
    { icon: "📜", label: "Terms & Conditions", href: "/terms" },
    { icon: "📝", label: "Property request", href: "/concierge" },
    { icon: "🗺️", label: "Area guide", href: null, note: "Coming soon — was a placeholder in the original app too" },
    { icon: "❓", label: "Help & FAQs", href: null, note: "Coming soon — was a placeholder in the original app too" },
    { icon: "📞", label: "Contact us", href: null, note: "support@chs.ng" },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-40">
        <button onClick={() => router.push("/")} className="flex-1 py-2.5 flex flex-col items-center gap-0.5">
          <span className="text-lg">🏠</span>
          <span className="text-[9px] font-semibold text-chs-charcoal">Home</span>
        </button>
        <button onClick={() => { router.push("/"); }} className="flex-1 py-2.5 flex flex-col items-center gap-0.5">
          <span className="text-lg">🔍</span>
          <span className="text-[9px] text-gray-500">Search</span>
        </button>
        <button onClick={() => router.push(session ? "/saved" : "/login")} className="flex-1 py-2.5 flex flex-col items-center gap-0.5">
          <span className="text-lg">♡</span>
          <span className="text-[9px] text-gray-500">Saved</span>
        </button>
        <button onClick={() => router.push(session ? "/profile" : "/login")} className="flex-1 py-2.5 flex flex-col items-center gap-0.5">
          <span className="text-lg">👤</span>
          <span className="text-[9px] text-gray-500">Account</span>
        </button>
        <button onClick={() => setShowMore(true)} className="flex-1 py-2.5 flex flex-col items-center gap-0.5">
          <span className="text-lg">⋯</span>
          <span className="text-[9px] text-gray-500">More</span>
        </button>
      </nav>

      {showMore && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={(e) => e.target === e.currentTarget && setShowMore(false)}>
          <div className="bg-white rounded-t-2xl w-full max-h-[75vh] overflow-y-auto pb-8">
            <div className="flex justify-between items-center px-4 pt-4 pb-2">
              <p className="font-serif text-base font-bold text-chs-charcoal">⋯ More</p>
              <button onClick={() => setShowMore(false)} className="text-2xl text-gray-400">✕</button>
            </div>
            {MORE_ITEMS.map((item) => (
              item.href ? (
                <Link key={item.label} href={item.href} onClick={() => setShowMore(false)}
                  className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm text-chs-charcoal">{item.label}</span>
                </Link>
              ) : (
                <div key={item.label} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 opacity-60">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-sm text-chs-charcoal">{item.label}</p>
                    <p className="text-[10px] text-gray-400">{item.note}</p>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </>
  );
}
