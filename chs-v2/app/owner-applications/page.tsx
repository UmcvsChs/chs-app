"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import NotificationBell from "@/components/NotificationBell";

// Real, new dedicated tab completing a direct client request: an
// owner previously had to hunt through every single property card to
// find a real application, however far down their list it sat.
// Every real rental application and purchase offer received now
// queues here in one place, most recent first, regardless of which
// property it's on.
interface RentalApp {
  id: string; status: string; created_at: string; applicant_full_name: string | null;
  properties: { title: string; location_area: string; owner_id: string }[] | null;
  tenant: { full_name: string }[] | null;
}
interface Offer {
  id: string; status: string; amount: number; payment_status: string; created_at: string;
  properties: { title: string; location_area: string; owner_id: string }[] | null;
}

export default function OwnerApplicationsPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [rentalApps, setRentalApps] = useState<RentalApp[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    if (!session) return;
    const { data: myProps } = await supabase.from("properties").select("id").eq("owner_id", session.user.id);
    const propIds = (myProps || []).map((p) => p.id);
    if (propIds.length === 0) { setLoading(false); return; }

    const [rentalRes, offerRes] = await Promise.all([
      supabase.from("rental_applications").select("id, status, created_at, applicant_full_name, properties(title, location_area, owner_id), tenant:profiles!rental_applications_tenant_id_fkey(full_name)")
        .in("property_id", propIds).order("created_at", { ascending: false }),
      supabase.from("offers").select("id, status, amount, payment_status, created_at, properties(title, location_area, owner_id)")
        .in("property_id", propIds).order("created_at", { ascending: false }),
    ]);
    setRentalApps((rentalRes.data as unknown as RentalApp[]) || []);
    setOffers((offerRes.data as unknown as Offer[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.push("/login"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  const needsAttention = (s: string) => s === "awaiting_owner_decision" || s === "pending";

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] zone-owner pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <Link href="/owner" className="text-xs text-white/70">← Back to Owner Dashboard</Link>
        <div className="flex justify-between items-center mt-1">
          <h1 className="font-serif text-lg font-bold">Recent Applications</h1>
          <NotificationBell />
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div>
          <p className="text-xs font-bold text-chs-charcoal mb-1.5">🏠 Rental Applications</p>
          {rentalApps.length === 0 ? (
            <p className="text-xs text-gray-400">No real rental applications yet.</p>
          ) : (
            rentalApps.map((a) => (
              <div key={a.id} className={`rounded-xl border p-3 mb-2 ${needsAttention(a.status) ? "bg-chs-amber-light border-chs-red" : "bg-white border-gray-200"}`}>
                <div className="flex justify-between items-start">
                  <p className="text-sm font-semibold text-chs-charcoal">{a.properties?.[0]?.title || "Property"}</p>
                  {needsAttention(a.status) && <span className="text-[9px] font-bold text-white bg-chs-red px-1.5 py-0.5 rounded-full">Needs you</span>}
                </div>
                <p className="text-[10px] text-gray-500">{a.applicant_full_name || a.tenant?.[0]?.full_name} · {new Date(a.created_at).toLocaleDateString()}</p>
                <p className="text-xs font-semibold text-gray-600 mt-1">{a.status.replace(/_/g, " ")}</p>
                <Link href="/owner" className="block text-center mt-1.5 py-1.5 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold">
                  Open on Owner Dashboard
                </Link>
              </div>
            ))
          )}
        </div>

        <div>
          <p className="text-xs font-bold text-chs-charcoal mb-1.5">🏡 Purchase Offers</p>
          {offers.length === 0 ? (
            <p className="text-xs text-gray-400">No real purchase offers yet.</p>
          ) : (
            offers.map((o) => (
              <div key={o.id} className={`rounded-xl border p-3 mb-2 ${needsAttention(o.status) ? "bg-chs-amber-light border-chs-red" : "bg-white border-gray-200"}`}>
                <div className="flex justify-between items-start">
                  <p className="text-sm font-semibold text-chs-charcoal">{o.properties?.[0]?.title || "Property"}</p>
                  {needsAttention(o.status) && <span className="text-[9px] font-bold text-white bg-chs-red px-1.5 py-0.5 rounded-full">Needs you</span>}
                </div>
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
    </div>
  );
}
