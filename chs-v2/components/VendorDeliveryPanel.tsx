"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { useDeliveryCity, MODE_LABEL, STATUS_LABEL } from "@/lib/delivery";
import DeliveryCityPicker from "@/components/DeliveryCityPicker";
import { StatusBar, Timeline, type Shipment } from "@/components/ShipmentCard";

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

// Every paid order the seller has to send, with the buttons to do it. Shown at the very top of the seller page.
export function VendorParcels({ onChanged }: { onChanged?: () => void }) {
  const [ships, setShips] = useState<Shipment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [carrier, setCarrier] = useState<Record<string, string>>({});
  const [track, setTrack] = useState<Record<string, string>>({});
  const [code, setCode] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_vendor_shipments");
    setShips((data as Shipment[]) || []); setLoaded(true);
  }, []);
  useEffect(() => { // eslint-disable-next-line react-hooks/set-state-in-effect
    load(); }, [load]);

  async function act(id: string, fn: string, args: Record<string, unknown>) {
    setBusyId(id); setMsg(null);
    const { error } = await supabase.rpc(fn, args);
    setBusyId(null);
    if (error) { setMsg(error.message); return; }
    setMsg("Done. The buyer and CHS have been notified.");
    load(); onChanged?.();
  }
  const todo = ships.filter((s) => !["delivered", "cancelled"].includes(s.status));
  const done = ships.filter((s) => ["delivered", "cancelled"].includes(s.status));
  if (!loaded || ships.length === 0) return null;

  return (
    <div id="orders-to-send" className="px-4 pt-4 space-y-3">
      <p className="text-xs font-bold text-chs-charcoal">📦 Orders to send / in delivery ({todo.length})</p>
      {todo.length === 0 && <p className="text-[11px] text-gray-400">Nothing waiting. New paid orders appear here the moment they are placed.</p>}
      {[...todo, ...done].map((s) => {
        const active = !["delivered", "cancelled"].includes(s.status);
        return (
          <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-3">
            <div className="flex justify-between gap-2">
              <div><p className="text-xs font-bold text-chs-charcoal">{s.reference} → {s.dest_area ? `${s.dest_area}, ` : ""}{s.dest}</p><p className="text-[10px] text-gray-500">{MODE_LABEL[s.mode]} · about {s.km} km · {s.weight_kg} kg</p></div>
              <span className="self-start text-[10px] font-bold px-2 py-0.5 rounded-full bg-chs-amber-light text-chs-amber-dark whitespace-nowrap">{STATUS_LABEL[s.status] || s.status}</span>
            </div>
            <StatusBar status={s.status} />
            <ul className="mt-2 text-[11px] text-gray-700">{s.items.map((it) => <li key={it.order_id}>• {it.quantity} × {it.name}{it.options && Object.keys(it.options).length ? ` (${Object.values(it.options).join(", ")})` : ""} · {formatNaira(it.amount)}</li>)}</ul>
            <p className="mt-1 text-[10px] text-gray-500">Deliver to: {s.dest_address}</p>
            {s.eta_max && active && <p className="text-[10px] text-gray-500">Buyer expects it by {new Date(s.eta_max).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}.</p>}
            {active && s.status === "awaiting_dispatch" && (
              <div className="mt-2 space-y-1.5">
                {s.mode !== "vendor_free" && <div className="grid grid-cols-2 gap-2">
                  <input value={carrier[s.id] || ""} onChange={(e) => setCarrier({ ...carrier, [s.id]: e.target.value })} placeholder="Carrier / CHS centre" className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
                  <input value={track[s.id] || ""} onChange={(e) => setTrack({ ...track, [s.id]: e.target.value })} placeholder="Waybill no. (optional)" className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
                </div>}
                <button disabled={busyId === s.id} onClick={() => act(s.id, "vendor_dispatch_shipment", { p_shipment: s.id, p_carrier: carrier[s.id] || null, p_tracking: track[s.id] || null })}
                  className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">{s.mode === "vendor_free" ? "I am taking it to the buyer now" : "I have handed it over"}</button>
              </div>
            )}
            {active && s.mode === "vendor_free" && s.status !== "awaiting_dispatch" && (
              <div className="mt-2 flex gap-2">
                <input value={code[s.id] || ""} onChange={(e) => setCode({ ...code, [s.id]: e.target.value })} inputMode="numeric" maxLength={6} placeholder="Buyer's 6-digit code" className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
                <button disabled={busyId === s.id || (code[s.id] || "").length !== 6} onClick={() => act(s.id, "vendor_confirm_with_code", { p_shipment: s.id, p_code: code[s.id] })} className="px-3 py-1.5 rounded-full bg-green-600 text-white text-xs font-semibold disabled:opacity-50">Confirm delivery</button>
              </div>
            )}
            {s.status === "delivered" && <p className="mt-2 text-[11px] text-green-700 font-semibold">✓ Delivered. CHS releases your payment next.</p>}
            {s.status === "problem" && <p className="mt-2 text-[11px] text-chs-red font-semibold">The buyer reported a problem. CHS is looking into it and will contact you.</p>}
            <button onClick={() => setOpen(open === s.id ? null : s.id)} className="mt-1 text-[10px] text-gray-500 underline">{open === s.id ? "Hide history" : "History"}</button>
            {open === s.id && <Timeline events={s.events} />}
          </div>
        );
      })}
      {msg && <p className="text-[11px] font-semibold text-chs-charcoal bg-white rounded-lg border border-gray-100 px-3 py-2">{msg}</p>}
    </div>
  );
}
