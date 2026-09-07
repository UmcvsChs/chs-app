"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import WalletQuickView from "@/components/WalletQuickView";
import NotificationBell from "@/components/NotificationBell";

// Real, new page completing a direct, serious client concern: an
// applied-for property used to leave no trace anywhere the applicant
// could easily find again — they had to scroll the homepage from
// scratch every time. Every real rental application and purchase
// offer a person has ever made now queues here permanently, the
// moment they apply, and every notification about it links straight
// back to this one place.
interface RentalApp {
  id: string; status: string; created_at: string;
  properties: { title: string; location_area: string }[] | null;
}
interface Offer {
  id: string; status: string; amount: number; payment_status: string; created_at: string;
  properties: { title: string; location_area: string }[] | null;
}

export default function MyApplicationsPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [rentalApps, setRentalApps] = useState<RentalApp[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    if (!session) return;
    const [rentalRes, offerRes] = await Promise.all([
      supabase.from("rental_applications").select("id, status, created_at, properties(title, location_area)")
        .eq("tenant_id", session.user.id).order("created_at", { ascending: false }),
      supabase.from("offers").select("id, status, amount, payment_status, created_at, properties(title, location_area)")
        .eq("buyer_id", session.user.id).order("created_at", { ascending: false }),
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

  function statusLabel(status: string) {
    const labels: Record<string, string> = {
      awaiting_guarantor_confirmation: "⏳ Awaiting your guarantor",
      awaiting_owner_decision: "⏳ With CHS for review",
      owner_decided_pending_relay: "⏳ Owner decided — CHS relaying",
      approved: "✓ Approved",
      owner_declined: "✗ Declined",
      pending: "⏳ Pending",
      accepted: "✓ Accepted",
      rejected: "✗ Rejected",
    };
    return labels[status] || status.replace(/_/g, " ");
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <div className="flex justify-between items-end mt-1 gap-2">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-lg font-bold">My Applications</h1>
            <NotificationBell />
          </div>
          {session && <WalletQuickView userId={session.user.id} />}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div>
          <p className="text-xs font-bold text-chs-charcoal mb-1.5">🏠 Rental Applications</p>
          {rentalApps.length === 0 ? (
            <p className="text-xs text-gray-400">No real rental applications yet.</p>
          ) : (
            rentalApps.map((a) => (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
                <p className="text-sm font-semibold text-chs-charcoal">{a.properties?.[0]?.title || "Property"}</p>
                <p className="text-[10px] text-gray-400">{a.properties?.[0]?.location_area} · {new Date(a.created_at).toLocaleDateString()}</p>
                <p className="text-xs font-semibold text-chs-red mt-1">{statusLabel(a.status)}</p>
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
              <div key={o.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
                <p className="text-sm font-semibold text-chs-charcoal">{o.properties?.[0]?.title || "Property"}</p>
                <p className="text-[10px] text-gray-400">{o.properties?.[0]?.location_area} · {new Date(o.created_at).toLocaleDateString()}</p>
                <p className="text-sm font-bold text-chs-charcoal mt-1">{formatNaira(o.amount)}</p>
                <p className="text-xs font-semibold text-chs-red mt-0.5">{statusLabel(o.status)}{o.payment_status === "paid" ? " · ✓ Paid" : ""}</p>
                {o.status === "accepted" && o.payment_status !== "paid" && (
                  <Link href={`/property/${o.id}`} className="block text-center mt-1.5 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                    Proceed to payment
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
