"use client";

import { useEffect, useState } from "react";

export type Scope = "near" | "cheapest" | "anywhere";
export const SCOPES: { value: Scope; icon: string; title: string; short: string; body: string; best: string }[] = [
  { value: "near", icon: "📍", title: "Near me", short: "Near me",
    body: "Only sellers within about 30 km of your city. Delivery is the cheapest it can be (often free), it arrives in a day or two, and you can go and see the seller's reputation on CHS.",
    best: "Best for cement, iron rods, roofing sheets, tiles, sand and other heavy building materials, and for most everyday buying." },
  { value: "cheapest", icon: "💰", title: "Cheapest overall", short: "Cheapest",
    body: "Every seller in the country, ranked by the TOTAL you will pay: the price plus the delivery to your city. A low price far away can cost more than a fair price next door, so we add the two together for you.",
    best: "Best when you are comparing prices and can wait a few days." },
  { value: "anywhere", icon: "🇳🇬", title: "Anywhere in Nigeria", short: "Anywhere",
    body: "Every seller in the country, nearest first. Use it when you need a particular brand, model or specification that nobody near you stocks. Expect higher delivery cost and 3 to 8 days of travel for far sellers.",
    best: "Best for electronics, appliances and specific specifications. Not recommended for heavy materials: the delivery can cost more than the goods." },
];
const KEY = "chs_scope_guide_seen";

// Flashes the first time a buyer opens the marketplace, and any time from the "How searching works" button.
export default function SearchScopeGuide({ open, onClose, current, onPick }: { open: boolean; onClose: () => void; current: Scope; onPick: (s: Scope) => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start">
          <h2 className="font-serif text-base font-bold text-chs-charcoal">How do you want to search?</h2>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none" aria-label="Close">✕</button>
        </div>
        <p className="text-[11px] text-gray-600 mt-1">Where the seller is decides what delivery costs and how fast you get your goods. Pick the way that suits what you are buying. You can change it any time.</p>
        <div className="mt-3 space-y-2">
          {SCOPES.map((o) => (
            <button key={o.value} onClick={() => { onPick(o.value); onClose(); }} className={`w-full text-left rounded-xl border-2 p-3 ${current === o.value ? "border-chs-red bg-chs-amber-light" : "border-gray-200"}`}>
              <p className="text-sm font-bold text-chs-charcoal">{o.icon} {o.title}{current === o.value ? " (selected)" : ""}</p>
              <p className="text-[11px] text-gray-700 mt-0.5 leading-snug">{o.body}</p>
              <p className="text-[10px] text-chs-amber-dark font-semibold mt-1 leading-snug">{o.best}</p>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-500 mt-3">Tip: services such as installation and design are quoted by the seller, so they appear in every search.</p>
      </div>
    </div>
  );
}

export function useScopeGuide() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) { // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true); } } catch { /* ignore */ }
  }, []);
  const close = () => { setOpen(false); try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } };
  return { open, show: () => setOpen(true), close };
}
