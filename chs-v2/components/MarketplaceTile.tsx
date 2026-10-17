"use client";

import Link from "next/link";

// One bold, compact entry into the Marketplace, placed once near the top of each dashboard (about 56px tall, never fixed to the screen).
export default function MarketplaceTile() {
  return (
    <Link href="/marketplace" className="flex items-center gap-2.5 bg-white rounded-xl border-l-4 border-chs-red px-3 py-2.5 shadow-sm">
      <span className="text-2xl shrink-0" aria-hidden>🛒</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-extrabold text-chs-charcoal leading-tight">CHS Marketplace</span>
        <span className="block text-[10px] text-gray-500 leading-tight truncate">Building materials, furniture &amp; appliances, delivered</span>
      </span>
      <span className="shrink-0 bg-chs-red text-white text-[11px] font-extrabold px-3 py-1.5 rounded-full">Shop</span>
    </Link>
  );
}
