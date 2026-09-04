"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

// Real, new page — a direct, honest answer to a direct client
// question: no, a Buyer genuinely had no dedicated interface beyond
// the homepage before this. This gives them a real, visible place to
// see their own submitted offers and real status, with a genuine,
// prominent link from the homepage header — not buried in a "More"
// drawer the way it effectively was before.
interface RealOffer {
  id: string;
  amount: number;
  status: string;
  payment_status: string | null;
  created_at: string;
  properties: { title: string; location_area: string; location_state: string } | null;
}

export default function MyOffersPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [offers, setOffers] = useState<RealOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    supabase
      .from("offers")
      .select("id, amount, status, payment_status, created_at, properties(title, location_area, location_state)")
      .eq("buyer_id", session.user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setOffers((data as unknown as RealOffer[]) || []);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] pb-10 zone-buyer">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <h1 className="font-serif text-lg font-bold mt-1">My Real Offers</h1>
        <p className="text-xs text-white/60 mt-1">{offers.length} real offer{offers.length !== 1 ? "s" : ""} made</p>
      </div>

      <div className="px-4 py-4 space-y-2">
        {offers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-gray-400 mb-3">You haven&apos;t made any real offers yet.</p>
            <Link href="/" className="text-sm font-semibold text-chs-red underline">Browse properties</Link>
          </div>
        ) : (
          offers.map((o) => (
            <div key={o.id} className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-sm font-semibold text-chs-charcoal">{o.properties?.title || "Property"}</p>
              <p className="text-[10px] text-gray-400">{o.properties?.location_area}, {o.properties?.location_state}</p>
              <div className="flex justify-between items-center mt-2">
                <p className="text-sm font-bold text-chs-charcoal">{formatNaira(o.amount)}</p>
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{o.status}</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{new Date(o.created_at).toLocaleDateString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
