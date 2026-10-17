"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { MODE_LABEL, STATUS_LABEL } from "@/lib/delivery";

export interface ShipItem { order_id: string; reference: string; name: string; quantity: number; amount: number; payment_status: string; options: Record<string, string> | null; }
export interface ShipEvent { status: string; note: string | null; at: string; role: string | null; }
export interface Shipment {
  id: string; reference: string; status: string; mode: string; km: number; band: string; weight_kg: number; delivery_fee: number; insurance_fee: number;
  eta_min: string | null; eta_max: string | null; carrier: string | null; tracking_no: string | null; delivered_at: string | null; delivered_how: string | null; created_at: string;
  dest_address: string | null; origin: string | null; dest: string | null; vendor: string; hub: { name: string; address: string | null; phone: string | null } | null;
  delivery_code: string | null; items: ShipItem[]; events: ShipEvent[]; buyer?: string;
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
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [showLog, setShowLog] = useState(false);

  async function run(fn: string, args: Record<string, unknown>) {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setProblem(false); setConfirming(false); setNote(""); onChanged();
  }
  const open = !["delivered", "cancelled"].includes(s.status);
  const canConfirm = open && s.status !== "awaiting_dispatch";

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3">
      <div className="flex justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-chs-charcoal">{s.vendor}</p>
          <p className="text-[10px] text-gray-500">{s.reference} · {s.origin} → {s.dest} · about {s.km} km</p>
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
        {s.carrier ? ` · carrier ${s.carrier}${s.tracking_no ? ` (${s.tracking_no})` : ""}` : ""}
      </p>
      {s.mode === "hub_pickup" && s.hub && <p className="mt-1 text-[10px] bg-gray-50 rounded px-2 py-1 text-chs-charcoal">📍 Collect from: <b>{s.hub.name}</b>{s.hub.address ? `, ${s.hub.address}` : ""}{s.hub.phone ? ` · ${s.hub.phone}` : ""}. Bring your delivery code and a valid ID.</p>}
      {open && s.delivery_code && (
        <div className="mt-2 bg-chs-charcoal text-white rounded-lg px-3 py-2 text-center">
          <p className="text-[10px] opacity-80">Your delivery code. Give it only when you hold your goods.</p>
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
      {confirming && <p className="text-[10px] text-gray-500 mt-1">Confirming tells CHS to pay the seller. Only confirm when you have checked the goods.</p>}
      {problem && (
        <div className="mt-2 space-y-1.5">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What went wrong? (damaged, missing, wrong item, not arrived…)" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
          <div className="flex gap-2">
            <button onClick={() => run("buyer_report_problem", { p_shipment: s.id, p_note: note })} disabled={busy || note.trim().length < 5} className="flex-1 py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">Send to CHS</button>
            <button onClick={() => setProblem(false)} className="px-3 py-2 text-xs text-gray-500">Cancel</button>
          </div>
          <p className="text-[10px] text-gray-500">Payment to the seller stays on hold while CHS looks into it.</p>
        </div>
      )}
      <button onClick={() => setShowLog(!showLog)} className="mt-2 text-[10px] text-gray-500 underline">{showLog ? "Hide history" : "Show full history"}</button>
      {showLog && <Timeline events={s.events} />}
    </div>
  );
}
