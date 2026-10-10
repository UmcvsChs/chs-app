"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// Owner dashboard: one tap to confirm a for-sale, rent or lease listing is still available. Unconfirmed listings are
// hidden from the public after 30 days.
export default function ListingAvailability({ propertyId, confirmedAt }: { propertyId: string; confirmedAt: string | null }) {
  const [at, setAt] = useState<string | null>(confirmedAt);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const days = at ? Math.floor((now - new Date(at).getTime()) / 86400000) : 0;
  const left = Math.max(0, 30 - days);

  async function confirm() {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("confirm_listing_available", { p_property_id: propertyId });
    setBusy(false);
    if (error) setErr(error.message); else { setAt(new Date().toISOString()); setNow(Date.now()); }
  }
  return (
    <div className={`mt-1.5 rounded-lg px-2.5 py-1.5 text-[10px] flex items-center justify-between gap-2 ${left <= 5 ? "bg-chs-amber-light" : "bg-gray-50"}`}>
      <span>{left === 0 ? "Hidden: confirm it is still available." : `Confirmed available. Visible for ${left} more day${left === 1 ? "" : "s"} unless you confirm again.`}</span>
      <button disabled={busy} onClick={confirm} className="shrink-0 px-2.5 py-1 rounded-full bg-chs-charcoal text-white font-semibold disabled:opacity-50">Confirm available</button>
      {err && <span className="text-red-600">{err}</span>}
    </div>
  );
}
