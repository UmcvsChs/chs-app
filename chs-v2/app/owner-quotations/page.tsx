"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import NotificationBell from "@/components/NotificationBell";

// Real, new dedicated tab per direct client request: every real
// purchase offer/quotation on land or property, split out from
// rental applications into its own real, permanent place.
interface Offer {
  id: string; status: string; amount: number; payment_status: string; created_at: string;
  buyer_full_name: string | null;
  properties: { title: string; location_area: string; owner_id: string }[] | null;
}

export default function OwnerQuotationsPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    if (!session) return;
    const { data: myProps } = await supabase.from("properties").select("id").eq("owner_id", session.user.id);
    const propIds = (myProps || []).map((p) => p.id);
    if (propIds.length === 0) { setLoading(false); return; }

    const { data } = await supabase.from("offers")
      .select("id, status, amount, payment_status, created_at, buyer_full_name, properties(title, location_area, owner_id)")
      .in("property_id", propIds).neq("status", "awaiting_admin_review").order("created_at", { ascending: false });
    setOffers((data as unknown as Offer[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.push("/login"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  const needsAttention = (s: string) => s === "pending";

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] zone-owner pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <Link href="/owner" className="text-xs text-white/70">← Back to Owner Dashboard</Link>
        <div className="flex justify-between items-center mt-1">
          <h1 className="font-serif text-lg font-bold">Recent Property Quotation</h1>
          <NotificationBell />
        </div>
        <p className="text-xs text-white/60 mt-1">Every real offer/quotation on your land or property, most recent first.</p>
      </div>

      <div className="px-4 py-4">
        {offers.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">No real quotations yet.</p>
        ) : (
          offers.map((o) => (
            <div key={o.id} className={`rounded-xl border p-3 mb-2 ${needsAttention(o.status) ? "bg-chs-amber-light border-chs-red" : "bg-white border-gray-200"}`}>
              <div className="flex justify-between items-start">
                <p className="text-sm font-semibold text-chs-charcoal">{o.properties?.[0]?.title || "Property"}</p>
                {needsAttention(o.status) && <span className="text-[9px] font-bold text-white bg-chs-red px-1.5 py-0.5 rounded-full">Needs you</span>}
              </div>
              <p className="text-[10px] text-gray-500">{o.buyer_full_name} · {new Date(o.created_at).toLocaleString()}</p>
              <p className="text-sm font-bold text-chs-charcoal mt-1">{formatNaira(o.amount)}</p>
              <p className="text-xs font-semibold text-gray-600">{o.status}{o.payment_status === "paid" ? " · ✓ Paid" : ""}</p>
              <Link href="/owner" className="block text-center mt-1.5 py-1.5 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold">
                Open on Owner Dashboard
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
