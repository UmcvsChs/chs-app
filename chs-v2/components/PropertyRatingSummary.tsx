"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Verified guest ratings for a stay or venue: only people who actually stayed can rate, so the average is real.
interface Summary { count: number; average: number; recent: { rating: number; comment: string; name: string; created_at: string }[] }

export default function PropertyRatingSummary({ propertyId }: { propertyId: string }) {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    supabase.rpc("get_property_rating_summary", { p_property: propertyId }).then(({ data }) => setS((data as Summary | null) ?? null));
  }, [propertyId]);
  if (!s || s.count === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-1.5">
      <p className="text-sm font-bold text-chs-charcoal">⭐ {s.average} <span className="text-xs font-normal text-gray-500">from {s.count} verified stay{s.count > 1 ? "s" : ""}</span></p>
      {s.recent.map((r, i) => (
        <p key={i} className="text-[11px] text-gray-600"><b>{r.name}</b> · {"★".repeat(r.rating)}<span className="text-gray-300">{"★".repeat(5 - r.rating)}</span> — {r.comment}</p>
      ))}
    </div>
  );
}
