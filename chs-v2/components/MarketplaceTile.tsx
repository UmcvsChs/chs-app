"use client";

import Link from "next/link";

// One bold, compact entry into the Marketplace, placed once near the top of each dashboard (about 40px tall, never fixed to the screen).
export default function MarketplaceTile() {
  return (
    <Link href="/marketplace" className="flex items-center gap-2 bg-white rounded-lg border-l-4 border-chs-red px-2.5 py-1.5 shadow-sm">
      <span className="text-lg shrink-0" aria-hidden>🛒</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-extrabold text-chs-charcoal leading-tight">CHS Marketplace</span>
        <span className="block text-[10px] text-gray-500 leading-tight truncate">Materials, furniture &amp; appliances, delivered</span>
      </span>
      <span className="shrink-0 bg-chs-red text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full">Shop</span>
    </Link>
  );
}
