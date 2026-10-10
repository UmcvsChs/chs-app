"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Admin review aid: what is missing from a listing and which risk signals it shows (new or unverified owner,
// possible duplicate, price far from similar listings). The database refuses to approve a listing that is
// missing a required item; this just shows the reviewer why.
interface Flag { level: "block" | "warn"; text: string }

export default function ListingRiskFlags({ propertyId }: { propertyId: string }) {
  const [flags, setFlags] = useState<Flag[] | null>(null);
  useEffect(() => {
    supabase.rpc("get_listing_risk_flags", { p_property_id: propertyId }).then(({ data }) => setFlags((data as Flag[]) ?? []));
  }, [propertyId]);
  if (flags === null) return null;
  if (flags.length === 0) return <p className="text-[10px] text-green-700 mt-1.5">✓ Complete: price, location, photos, video and contact are present. No risk signals.</p>;
  return (
    <div className="mt-1.5 space-y-1">
      {flags.map((f, i) => (
        <p key={i} className={`text-[10px] rounded-lg px-2 py-1 ${f.level === "block" ? "bg-red-50 text-red-700 font-semibold" : "bg-amber-50 text-amber-800"}`}>
          {f.level === "block" ? "⛔ " : "⚠️ "}{f.text}
        </p>
      ))}
    </div>
  );
}
