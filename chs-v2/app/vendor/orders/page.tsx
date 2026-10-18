"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import NotificationBell from "@/components/NotificationBell";
import type { Shipment } from "@/components/ShipmentCard";
import { stageOf, parcelMoney, STAGE_LABEL, STAGE_STYLE, type Stage } from "@/lib/sellerOrders";

type Filter = "todo" | "onway" | "delivered" | "all";
const FILTERS: { key: Filter; label: string }[] = [{ key: "todo", label: "To pack / send" }, { key: "onway", label: "On the way" }, { key: "delivered", label: "Delivered" }, { key: "all", label: "All orders" }];

export default function SellerOrdersPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [ships, setShips] = useState<Shipment[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("todo");
  const [cstats, setCstats] = useState<{ lines: number; claims: number; upheld: number; rate: number; warn: number; review: number; min_orders: number; status: string } | null>(null);
  const [claimsOpen, setClaimsOpen] = useState<{ total: number; needMe: number }>({ total: 0, needMe: 0 });

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_vendor_shipments");
    if (error) { setErr(error.message); return; }
    setShips((data as Shipment[]) || []);
    const cl = await supabase.rpc("get_vendor_marketplace_claims");
    const rows = ((cl.data as { status: string; needs_me: boolean }[]) || []).filter((c) => c.status !== "decided" && c.status !== "withdrawn");
    const cs = await supabase.rpc("get_vendor_claim_stats");
    setCstats(cs.data as typeof cstats);
    setClaimsOpen({ total: rows.length, needMe: rows.filter((c) => c.needs_me).length });
  }, []);
  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.push("/login"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [authLoading, session, router, load]);

  const stats = useMemo(() => {
    const list = ships || [];
    const count = (st: Stage[]) => list.filter((s) => st.includes(stageOf(s))).length;
    let held = 0, released = 0, commission = 0;
    list.forEach((s) => { const m = parcelMoney(s); held += m.heldNet; released += m.releasedNet; if (m.paid) commission += m.commission; });
    return { newN: count(["new"]), packedN: count(["packed"]), onway: count(["onway"]), delivered: count(["delivered"]), problem: count(["problem"]), held, released, commission };
  }, [ships]);

  const shown = (ships || []).filter((s) => {
    const st = stageOf(s);
    if (filter === "todo") return st === "new" || st === "packed" || st === "problem";
    if (filter === "onway") return st === "onway";
    if (filter === "delivered") return st === "delivered";
    return true;
  });

  return (
    <div className="min-h-screen zone-market-browse bg-[var(--zone-bg)] pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <Link href="/vendor" className="text-xs text-white/80">← My shop dashboard</Link>
        <div className="flex items-center gap-2 mt-1"><h1 className="font-serif text-lg font-bold">My orders</h1><NotificationBell /></div>
        <p className="text-[10px] text-white/70">Every order from your buyers: pack it, send it, follow it to delivery, and see your money.</p>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {cstats && cstats.claims > 0 && (
          <div className={`rounded-xl border p-3 ${cstats.status === "ok" ? "bg-white border-gray-100" : cstats.status === "warning" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-chs-red"}`}>
            <p className="text-xs font-bold text-chs-charcoal">Buyer problem reports, last 90 days: {cstats.claims} on {cstats.lines} order line(s){cstats.lines >= cstats.min_orders ? ` = ${cstats.rate}%` : ""}</p>
            <p className="text-[11px] text-gray-600">{cstats.status === "ok" ? "Your rate is healthy. Good packing and honest descriptions keep it low." : cstats.status === "warning" ? `Your claim rate is above ${cstats.warn}%. Check your packing and product quality. Above ${cstats.review}% CHS reviews your listings and early part-payments stop.` : `Your claim rate is above ${cstats.review}%. CHS is reviewing your listings and early part-payments are stopped.`}</p>
          </div>
        )}
        {claimsOpen.total > 0 && (
          <Link href="/claims" className="block rounded-xl border-2 border-chs-red bg-red-50 p-3">
            <p className="text-xs font-bold text-chs-red">⚠️ {claimsOpen.total} open problem report{claimsOpen.total > 1 ? "s" : ""} from buyers{claimsOpen.needMe ? ` · ${claimsOpen.needMe} need${claimsOpen.needMe > 1 ? "" : "s"} your reply` : ""}</p>
            <p className="text-[10px] text-gray-600">Reply on time or CHS decides on the buyer&apos;s evidence. Tap to open →</p>
          </Link>
        )}
        <div className="grid grid-cols-4 gap-2 text-center">
          {[["New", stats.newN, "text-chs-red"], ["Packed", stats.packedN, "text-amber-700"], ["On the way", stats.onway, "text-blue-700"], ["Delivered", stats.delivered, "text-green-700"]].map(([l, n, c]) => (
            <div key={String(l)} className="bg-white rounded-xl border border-gray-100 py-2"><p className={`text-lg font-bold ${c}`}>{n}</p><p className="text-[9px] uppercase font-bold text-gray-400">{l}</p></div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-gray-100 p-2.5"><p className="text-[9px] uppercase font-bold text-gray-400">Held by CHS (your share)</p><p className="text-sm font-bold text-amber-700">{formatNaira(stats.held)}</p></div>
          <div className="bg-white rounded-xl border border-gray-100 p-2.5"><p className="text-[9px] uppercase font-bold text-gray-400">Paid out to you</p><p className="text-sm font-bold text-green-700">{formatNaira(stats.released)}</p></div>
          <div className="bg-white rounded-xl border border-gray-100 p-2.5"><p className="text-[9px] uppercase font-bold text-gray-400">Commission paid</p><p className="text-sm font-bold text-chs-red">{formatNaira(stats.commission)}</p></div>
        </div>
        <div className="flex gap-3 text-[11px] font-semibold">
          <Link href="/vendor?tab=earnings" className="text-chs-red underline">My total earnings</Link>
          <Link href="/vendor?tab=sales" className="text-chs-red underline">My sales</Link>
          <Link href="/vendor?tab=commission" className="text-chs-red underline">Commission paid</Link>
        </div>

        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={`shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap ${filter === f.key ? "bg-chs-charcoal text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
              {f.label}{f.key === "todo" && stats.newN + stats.packedN > 0 ? ` (${stats.newN + stats.packedN})` : ""}
            </button>
          ))}
        </div>

        {err && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{err}</p>}
        {ships === null && !err && <p className="text-xs text-gray-400">Loading your orders…</p>}
        {ships !== null && shown.length === 0 && <p className="text-xs text-gray-400 py-4">{filter === "todo" ? "Nothing waiting for you. New paid orders appear here the moment a buyer pays." : "No orders here yet."}</p>}

        {shown.map((s) => {
          const st = stageOf(s); const m = parcelMoney(s);
          return (
            <Link key={s.id} href={`/vendor/orders/${s.id}`} className="block bg-white rounded-xl border border-gray-100 p-3 active:bg-gray-50">
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-chs-charcoal">{s.reference}</p>
                  <p className="text-[10px] text-gray-500">{new Date(s.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })} · to {s.dest_area ? `${s.dest_area}, ` : ""}{s.dest}</p>
                </div>
                <span className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STAGE_STYLE[st]}`}>{STAGE_LABEL[st]}</span>
              </div>
              <ul className="mt-1.5 text-[11px] text-gray-700">{s.items.slice(0, 3).map((it) => <li key={it.order_id}>• {it.quantity} × {it.name}</li>)}{s.items.length > 3 && <li className="text-gray-400">+ {s.items.length - 3} more</li>}</ul>
              <div className="mt-2 flex justify-between items-end">
                <p className="text-[10px] text-gray-500">Order {formatNaira(m.gross)} · you receive <b className="text-chs-charcoal">{formatNaira(m.net)}</b></p>
                <span className="text-[11px] font-semibold text-chs-red">Open order →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
