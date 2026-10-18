"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ClaimForm from "./ClaimForm";
import { STATUS_LABEL as CLAIM_STATUS, timeLeft } from "@/lib/claims";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { MODE_LABEL, STATUS_LABEL } from "@/lib/delivery";

export interface ShipItem { order_id: string; reference: string; name: string; quantity: number; amount: number; payment_status: string; options: Record<string, string> | null; unit_price?: number | null; vendor_commission?: number | null; vendor_paid?: number | null; }
export interface ShipEvent { status: string; note: string | null; at: string; role: string | null; }
export interface Shipment {
  id: string; reference: string; status: string; mode: string; km: number; band: string; weight_kg: number; delivery_fee: number; insurance_fee: number;
  eta_min: string | null; eta_max: string | null; carrier: string | null; tracking_no: string | null; delivered_at: string | null; delivered_how: string | null; created_at: string;
  dest_address: string | null; origin_area?: string | null; dest_area?: string | null; origin: string | null; dest: string | null; vendor: string; hub: { name: string; address: string | null; phone: string | null } | null;
  delivery_code: string | null; items: ShipItem[]; events: ShipEvent[]; buyer?: string | null;
  dispatch_method?: string | null; rider_name?: string | null; rider_phone?: string | null; vehicle_plate?: string | null; packed_at?: string | null; dispatched_at?: string | null; dispatch_expected?: string | null; dispatch_note?: string | null;
}

const d = (x: string | null) => (x ? new Date(x).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "");
const STEPS = ["awaiting_dispatch", "dispatched", "in_transit", "out_for_delivery", "delivered"];

export function StatusBar({ status }: { status: string }) {
  const idx = status === "at_origin_hub" ? 1 : status === "at_destination_hub" ? 3 : status === "delivered_by_carrier" ? 3 : STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-1 mt-2" aria-label={STATUS_LABEL[status] || status}>
      {STEPS.map((st, i) => <div key={st} className={`h-1.5 flex-1 rounded-full ${idx >= i && status !== "problem" && status !== "cancelled" ? "bg-green-500" : "bg-gray-200"}`} />)}
    </div>
  );
}

export function Timeline({ events }: { events: ShipEvent[] }) {
  return (
    <ol className="mt-2 space-y-1 border-l-2 border-gray-100 pl-3">
      {events.map((e, i) => (
        <li key={i} className="text-[10px] text-gray-600">
          <b className="text-chs-charcoal">{STATUS_LABEL[e.status] || e.status}</b> · {new Date(e.at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          {e.note && <span className="block text-gray-500">{e.note}</span>}
        </li>
      ))}
    </ol>
  );
}

// Buyer's view of one parcel (one seller's goods): where it is, the delivery code, confirm receipt or report a problem.
export default function ShipmentCard({ s, onChanged }: { s: Shipment; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [problem, setProblem] = useState(false);
  const [, setNote] = useState("");
  const [nowMs] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [claims, setClaims] = useState<{ id: string; reference: string; status: string; product: string; needs_me: boolean; seller_due_at: string | null; shipment_id: string }[]>([]);
  useEffect(() => {
    let live = true;
    supabase.rpc("get_my_marketplace_claims").then(({ data }) => { if (live) setClaims(((data as typeof claims) || []).filter((c) => c.shipment_id === s.id)); });
    return () => { live = false; };
  }, [s.id, s.status]);

  async function run(fn: string, args: Record<string, unknown>) {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setProblem(false); setConfirming(false); setNote(""); onChanged();
  }
  const open = !["delivered", "cancelled"].includes(s.status);
  const canConfirm = open && s.status !== "awaiting_dispatch" && s.status !== "problem";

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3">
      <div className="flex justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-chs-charcoal">{s.vendor}</p>
          <p className="text-[10px] text-gray-500">{s.reference} · {s.origin_area ? `${s.origin_area}, ` : ""}{s.origin} → {s.dest_area ? `${s.dest_area}, ` : ""}{s.dest} · about {s.km} km</p>
        </div>
        <span className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${s.status === "delivered" ? "bg-green-50 text-green-700" : s.status === "problem" ? "bg-red-50 text-chs-red" : "bg-chs-amber-light text-chs-amber-dark"}`}>{STATUS_LABEL[s.status] || s.status}</span>
      </div>
      <StatusBar status={s.status} />
      <ul className="mt-2 text-[11px] text-gray-700 space-y-0.5">
        {s.items.map((it) => <li key={it.order_id}>• {it.quantity} × {it.name}{it.options && Object.keys(it.options).length > 0 ? ` (${Object.values(it.options).join(", ")})` : ""} · {formatNaira(it.amount)}</li>)}
      </ul>
      <p className="mt-2 text-[10px] text-gray-500">
        {MODE_LABEL[s.mode] || s.mode} · {s.delivery_fee + s.insurance_fee === 0 ? "free delivery" : `delivery ${formatNaira(s.delivery_fee + s.insurance_fee)}`}
        {s.eta_max && open ? ` · expected ${s.eta_min === s.eta_max ? d(s.eta_max) : `${d(s.eta_min)} to ${d(s.eta_max)}`}` : ""}
      </p>
      {s.dispatch_method && s.status !== "awaiting_dispatch" && (
        <div className="mt-1.5 text-[11px] bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-2 text-chs-charcoal">
          <p className="font-bold">🚚 Who is bringing it</p>
          <p>{s.dispatch_method === "own_rider" ? "The seller's own rider / driver" : s.dispatch_method === "courier" ? "Courier / transport company" : "CHS collection centre"}{s.carrier && s.dispatch_method !== "chs_centre" ? `: ${s.carrier}` : ""}</p>
          {s.rider_name && <p>Rider / driver: <b>{s.rider_name}</b>{s.rider_phone ? <> · <a href={`tel:${s.rider_phone}`} className="underline">{s.rider_phone}</a></> : null}{s.vehicle_plate ? ` · vehicle ${s.vehicle_plate}` : ""}</p>}
          {s.tracking_no && <p>Waybill / tracking: <b>{s.tracking_no}</b></p>}
          {s.dispatch_expected && <p>Seller expects it to arrive on <b>{d(s.dispatch_expected)}</b></p>}
          {s.dispatch_note && <p className="text-gray-600">Note: {s.dispatch_note}</p>}
        </div>
      )}
      {s.status === "awaiting_dispatch" && s.packed_at && <p className="mt-1.5 text-[11px] text-green-700 font-semibold">✓ The seller has packed your goods and is arranging dispatch.</p>}
      {s.mode === "hub_pickup" && s.hub && <p className="mt-1 text-[10px] bg-gray-50 rounded px-2 py-1 text-chs-charcoal">📍 Collect from: <b>{s.hub.name}</b>{s.hub.address ? `, ${s.hub.address}` : ""}{s.hub.phone ? ` · ${s.hub.phone}` : ""}. Bring your delivery code and a valid ID.</p>}
      {open && s.delivery_code && (
        <div className="mt-2 bg-chs-charcoal text-white rounded-lg px-3 py-2 text-center">
          <p className="text-[10px] opacity-80">Check your goods first, then give this code. If anything is wrong, do not give the code. Tap &quot;Report a problem&quot; instead.</p>
          <p className="text-xl font-bold tracking-[0.3em]">{s.delivery_code}</p>
        </div>
      )}
      {err && <p className="text-xs text-chs-red mt-2">{err}</p>}
      {canConfirm && !problem && (
        <div className="mt-2 flex gap-2">
          {confirming ? (
            <button onClick={() => run("buyer_confirm_received", { p_shipment: s.id })} disabled={busy} className="flex-1 py-2 rounded-full bg-green-600 text-white text-xs font-semibold disabled:opacity-50">{busy ? "Saving…" : "Yes, I have everything. Confirm"}</button>
          ) : (
            <button onClick={() => setConfirming(true)} className="flex-1 py-2 rounded-full bg-chs-red text-white text-xs font-semibold">✓ I have received it</button>
          )}
          <button onClick={() => { setProblem(true); setConfirming(false); }} className="px-3 py-2 rounded-full border border-gray-300 text-xs font-semibold text-gray-600">Report a problem</button>
        </div>
      )}
      {s.status === "problem" && <p className="mt-2 text-[11px] text-chs-red font-semibold bg-red-50 rounded-lg px-2.5 py-2">⚠️ You reported a problem at the door. The payment to the seller stays on hold while the claim below is handled. You cannot mark this order as received until it is decided.</p>}
      {confirming && <p className="text-[10px] text-gray-500 mt-1">Confirming tells CHS to pay the seller. Only confirm when you have checked the goods.</p>}
      {problem && <ClaimForm s={s} onClose={() => setProblem(false)} />}
      {s.status === "delivered" && s.delivered_at && !problem && nowMs < new Date(s.delivered_at).getTime() + 7 * 86400000 && (
        <div className="mt-2">
          <button onClick={() => setProblem(true)} className="px-3 py-2 rounded-full border border-gray-300 text-xs font-semibold text-gray-600">Report a problem with this order</button>
          <p className="text-[10px] text-gray-500 mt-1">Damaged, wrong or missing items: within 48 hours of delivery. Faults that were not visible: within 7 days.</p>
        </div>
      )}
      {claims.length > 0 && (
        <div className="mt-2 space-y-1">
          {claims.map((c) => (
            <Link key={c.id} href={`/claims/${c.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-2">
              <span className="text-[11px] text-chs-charcoal"><b>{c.reference}</b> · {c.product}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(CLAIM_STATUS[c.status] || CLAIM_STATUS.open).cls}`}>{c.needs_me ? "Your answer needed" : (CLAIM_STATUS[c.status] || CLAIM_STATUS.open).text}</span>
            </Link>
          ))}
          {claims.some((c) => c.status === "open" && c.seller_due_at) && <p className="text-[10px] text-gray-500">Seller reply due: {timeLeft(claims.find((c) => c.status === "open")?.seller_due_at)}</p>}
        </div>
      )}
      <button onClick={() => setShowLog(!showLog)} className="mt-2 text-[10px] text-gray-500 underline">{showLog ? "Hide history" : "Show full history"}</button>
      {showLog && <Timeline events={s.events} />}
    </div>
  );
}
