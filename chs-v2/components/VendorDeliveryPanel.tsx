"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { useDeliveryCity } from "@/lib/delivery";
import DeliveryCityPicker from "@/components/DeliveryCityPicker";
import Link from "next/link";
import type { Shipment } from "@/components/ShipmentCard";
import { stageOf, parcelMoney, STAGE_STYLE, type Stage } from "@/lib/sellerOrders";

// Seller side: where you are and whether you offer free local delivery, plus every parcel to hand over and its delivery code step.
export default function VendorDeliveryPanel({ vendorCityId, vendorArea, freeLocal, freeMin, pickupAddress, onSaved }: {
  vendorCityId: number | null; vendorArea: string | null; freeLocal: boolean; freeMin: number; pickupAddress: string | null; onSaved: () => void;
}) {
  const { cities } = useDeliveryCity(undefined);
  const [city, setCity] = useState<number | null>(vendorCityId);
  const [area, setArea] = useState<string | null>(vendorArea);
  const [free, setFree] = useState(freeLocal);
  const [min, setMin] = useState<number>(freeMin || 0);
  const [addr, setAddr] = useState(pickupAddress || "");
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setMsg(null);
    if (!city) { setMsg("Please choose the city you ship from."); return; }
    const { error } = await supabase.rpc("vendor_set_delivery_terms", { p_city_id: city, p_free_local: free, p_free_min: min, p_pickup_address: addr, p_area: area });
    setMsg(error ? error.message : "Saved. Buyers see these terms straight away."); if (!error) onSaved();
  }
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
        <p className="text-xs font-bold text-chs-charcoal">📍 Where you ship from (state, LGA and neighbourhood), and free local delivery</p>
        <DeliveryCityPicker cities={cities} cityId={city} area={area} onChange={(id, a) => { setCity(id); setArea(a); }} compact />
        <p className="text-[10px] text-gray-500">Buyers see how far you are from them. Items from a seller in their own city arrive fastest and cheapest.</p>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} /> I deliver for free to buyers in my own city (I deliver myself, or build the cost into my prices)</label>
        {free && <div className="flex items-center gap-2 text-xs"><span>Only for orders from</span><input type="number" min={0} value={min} onChange={(e) => setMin(Number(e.target.value))} className="w-28 px-2 py-1.5 rounded-lg border border-gray-200 text-xs" /><span>(0 = every order)</span></div>}
        <textarea value={addr} onChange={(e) => setAddr(e.target.value)} rows={2} placeholder="Your pickup address, where CHS or a carrier collects your goods (optional)" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
        <button onClick={save} className="w-full py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold">Save delivery terms</button>
        {msg && <p className="text-[11px] text-chs-charcoal">{msg}</p>}
      </div>

    </div>
  );
}

// Top of the seller dashboard: how many orders need action, your held / paid money, and a way into each order.
export function VendorParcels() {
  const [ships, setShips] = useState<Shipment[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    supabase.rpc("get_vendor_shipments").then(({ data }) => { if (live) { setShips((data as Shipment[]) || []); setLoaded(true); } });
    return () => { live = false; };
  }, []);
  if (!loaded) return null;
  const count = (st: Stage[]) => ships.filter((x) => st.includes(stageOf(x))).length;
  const newN = count(["new"]), packedN = count(["packed"]), onway = count(["onway"]), delivered = count(["delivered"]);
  let held = 0, released = 0;
  ships.forEach((x) => { const m = parcelMoney(x); held += m.heldNet; released += m.releasedNet; });
  const action = ships.filter((x) => ["new", "packed", "problem"].includes(stageOf(x))).slice(0, 4);

  return (
    <div id="orders-to-send" className="px-4 pt-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-bold text-chs-charcoal">📦 My orders</p>
        <Link href="/vendor/orders" className="text-[11px] font-semibold text-chs-red">See all orders →</Link>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center mb-2">
        {[["New", newN, "text-chs-red"], ["Packed", packedN, "text-amber-700"], ["On the way", onway, "text-blue-700"], ["Delivered", delivered, "text-green-700"]].map(([l, n, c]) => (
          <Link href="/vendor/orders" key={String(l)} className="bg-white rounded-xl border border-gray-100 py-2"><p className={`text-lg font-bold ${c}`}>{n}</p><p className="text-[9px] uppercase font-bold text-gray-400">{l}</p></Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-white rounded-xl border border-gray-100 p-2.5"><p className="text-[9px] uppercase font-bold text-gray-400">Held by CHS (your share)</p><p className="text-sm font-bold text-amber-700">{formatNaira(held)}</p></div>
        <div className="bg-white rounded-xl border border-gray-100 p-2.5"><p className="text-[9px] uppercase font-bold text-gray-400">Paid out to you</p><p className="text-sm font-bold text-green-700">{formatNaira(released)}</p></div>
      </div>
      {action.length === 0 ? <p className="text-[11px] text-gray-400">No order is waiting for you right now.</p> : action.map((x) => (
        <Link key={x.id} href={`/vendor/orders/${x.id}`} className="flex items-center justify-between gap-2 bg-white rounded-xl border border-gray-100 p-3 mb-1.5 active:bg-gray-50">
          <div className="min-w-0">
            <p className="text-xs font-bold text-chs-charcoal">{x.reference} · {x.items.length} {x.items.length === 1 ? "item" : "items"}</p>
            <p className="text-[10px] text-gray-500 truncate">{x.items.map((it) => `${it.quantity} × ${it.name}`).join(", ")}</p>
          </div>
          <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${STAGE_STYLE[stageOf(x)]}`}>{stageOf(x) === "new" ? "Pack & send →" : stageOf(x) === "packed" ? "Dispatch →" : "View →"}</span>
        </Link>
      ))}
    </div>
  );
}
