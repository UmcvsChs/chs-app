"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import ShipmentCard, { type Shipment } from "@/components/ShipmentCard";

export default function MyDeliveries() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [ships, setShips] = useState<Shipment[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_shipments");
    if (error) { setErr(error.message); return; }
    setShips((data as Shipment[]) || []);
  }, []);
  useEffect(() => {
    if (loading) return;
    if (!session) { router.push("/login"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [loading, session, router, load]);

  const active = (ships || []).filter((s) => !["delivered", "cancelled"].includes(s.status));
  const past = (ships || []).filter((s) => ["delivered", "cancelled"].includes(s.status));
  return (
    <div className="min-h-screen bg-chs-cream pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4 flex items-center justify-between">
        <div><Link href="/" className="text-[11px] text-white/80">← Home</Link><p className="font-serif text-lg font-bold">📦 My deliveries</p><p className="text-[10px] text-white/70">One parcel per seller, tracked from payment to your door.</p></div>
        <div className="flex gap-3 items-center"><button onClick={load} className="text-[11px] underline">Refresh</button><Link href="/claims" className="text-[11px] underline">Problem reports</Link><Link href="/marketplace" className="text-[11px] underline">Marketplace</Link></div>
      </div>
      <div className="px-4 py-4 space-y-3">
        {err && <p className="text-xs text-chs-red">{err}</p>}
        {ships === null && !err && <p className="text-center text-xs text-gray-400 py-8">Loading…</p>}
        {ships && ships.length === 0 && <p className="text-center text-sm text-gray-400 py-10">No deliveries yet. Orders you place on the marketplace appear here.</p>}
        {active.length > 0 && <p className="text-xs font-bold text-chs-charcoal">On the way ({active.length})</p>}
        {active.map((s) => <ShipmentCard key={s.id} s={s} onChanged={load} />)}
        {past.length > 0 && <p className="text-xs font-bold text-chs-charcoal pt-2">Completed ({past.length})</p>}
        {past.map((s) => <ShipmentCard key={s.id} s={s} onChanged={load} />)}
        <p className="text-[10px] text-gray-400 text-center">For orders placed before delivery tracking began, see <Link href="/my-quote-requests" className="underline">My Requests</Link>.</p>
      </div>
    </div>
  );
}
