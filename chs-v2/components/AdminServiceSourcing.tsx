"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira, formatDateTime } from "@/lib/format";
import ServiceThread from "@/components/ServiceThread";

// CHS admin's side of "venue asks CHS to find a service". Admin proposes who supplies it and at what cost to the venue
// (or says it cannot), talks to the venue in a short thread, and confirms the provider once the venue has accepted.
// The guest never sees any of this: they see "the venue is arranging it" and then the venue's own price.

interface Row {
  id: string; booking_id: string; ref: string; property_title: string; host_name: string | null; host_phone: string | null; event_type: string | null;
  check_in: string; guests: number | null; guest_name: string; sessions: string | null; service: string; label: string; quantity: number | null; guest_note: string | null;
  status: "sourcing" | "quoted" | "supplied" | "requested"; chs_unable: boolean; supplier_cost: number | null; chs_provider: string | null; chs_provider_contact: string | null;
  guest_price: number | null; referred_at: string | null; quoted_at: string | null; provider_confirmed_at: string | null; messages: number; last_message: string | null; last_side: string | null;
}

function Card({ r, onChanged }: { r: Row; onChanged: () => void }) {
  const [cost, setCost] = useState(r.supplier_cost != null ? String(r.supplier_cost) : "");
  const [provider, setProvider] = useState(r.chs_provider || "");
  const [contact, setContact] = useState(r.chs_provider_contact || "");
  const [note, setNote] = useState("");
  const [why, setWhy] = useState("");
  const [thread, setThread] = useState(r.messages > 0 && r.last_side === "host");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function call(fn: string, args: Record<string, unknown>) {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onChanged();
  }

  const tag = r.status === "sourcing" ? { t: "Needs a proposal", c: "bg-red-100 text-red-700" }
    : r.status === "quoted" ? { t: "Waiting for the venue", c: "bg-amber-100 text-amber-800" }
    : { t: "Confirm the provider", c: "bg-green-100 text-green-800" };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-1.5">
      <div className="flex justify-between items-start gap-2">
        <p className="text-sm font-bold text-chs-charcoal">{r.label}{r.quantity ? ` × ${r.quantity}` : ""}</p>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${tag.c}`}>{tag.t}</span>
      </div>
      <p className="text-[11px] text-gray-600">{r.property_title} · {r.event_type || "Event"} · {r.guests ? `${r.guests} guests · ` : ""}Ref {r.ref}</p>
      <p className="text-[11px] text-gray-600">📅 {r.sessions || r.check_in}</p>
      <p className="text-[11px] text-gray-500">Venue: {r.host_name || "host"}{r.host_phone ? ` · ${r.host_phone}` : ""} · Client: {r.guest_name}</p>
      {r.guest_note && <p className="text-[11px] italic text-gray-500">Guest asked: “{r.guest_note}”</p>}
      {r.referred_at && <p className="text-[10px] text-gray-400">Referred {formatDateTime(r.referred_at)}</p>}
      {r.last_message && <p className="text-[11px] bg-gray-50 rounded px-2 py-1"><b>{r.last_side === "host" ? "Venue" : r.last_side === "admin" ? "You" : "Note"}:</b> {r.last_message}</p>}

      {r.status === "supplied" ? (
        <div className="bg-green-50 rounded-lg p-2 space-y-1">
          <p className="text-[11px] text-green-900">The venue accepted: {r.chs_provider} at {r.guest_price != null ? formatNaira(r.guest_price) : "?"}. The guest pays this through CHS; you pay the provider after the event, less your commission.</p>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the venue (optional, e.g. arrival time)" className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
          <button disabled={busy} onClick={() => call("admin_confirm_service_provider", { p_line: r.id, p_note: note.trim() || null })} className="px-3 py-1 rounded-full bg-green-600 text-white text-[10px] font-semibold disabled:opacity-50">✓ Provider is booked, tell the venue</button>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-2 space-y-1.5">
          <p className="text-[10px] font-bold text-gray-600">{r.status === "quoted" ? "Your proposal (change it to send a new one)" : "Propose a provider"}</p>
          <div className="grid grid-cols-2 gap-1">
            <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Who supplies it" className="border border-gray-300 rounded px-2 py-1 text-[11px]" />
            <input value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Price the provider agreed (naira)" className="border border-gray-300 rounded px-2 py-1 text-[11px]" />
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Provider contact (venue sees it)" className="border border-gray-300 rounded px-2 py-1 text-[11px] col-span-2" />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Details for the venue (hours, what is included)" className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
          <button disabled={busy || !provider.trim() || cost === ""} onClick={() => call("admin_quote_service", { p_line: r.id, p_cost: Number(cost), p_provider: provider.trim(), p_contact: contact.trim() || null, p_note: note.trim() || null })} className="px-3 py-1 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">Send proposal to the venue</button>
          <div className="flex gap-1">
            <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Cannot find anyone? Say why" className="flex-1 border border-gray-300 rounded px-2 py-1 text-[11px]" />
            <button disabled={busy || !why.trim()} onClick={() => call("admin_cannot_source", { p_line: r.id, p_note: why.trim() })} className="px-3 py-1 rounded-full border border-gray-400 text-[10px] font-semibold disabled:opacity-50">Cannot source</button>
          </div>
        </div>
      )}
      {err && <p className="text-[10px] text-red-600">{err}</p>}
      <button onClick={() => setThread(!thread)} className="text-[10px] underline text-gray-600">{thread ? "Hide" : "Open"} conversation with the venue{r.messages ? ` (${r.messages})` : ""}</button>
      {thread && <ServiceThread lineId={r.id} me="admin" onSent={onChanged} />}
    </div>
  );
}

interface Payout { id: string; status: string; provider_name: string | null; provider_contact: string | null; amount_due: number; paid_at: string | null; paid_ref: string | null; note: string | null; label: string; property_title: string; check_in: string; reference: string; payment_status: string }
interface Payouts { payouts: Payout[]; revenue: { held: number; earned: number; owed_to_providers: number; pending_to_providers: number } }

function PayoutRow({ p, onChanged }: { p: Payout; onChanged: () => void }) {
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function pay() {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("admin_mark_provider_paid", { p_payout: p.id, p_ref: ref });
    setBusy(false);
    if (error) setErr(error.message); else onChanged();
  }
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-2 space-y-1">
      <div className="flex justify-between gap-2">
        <p className="text-xs font-semibold text-chs-charcoal">{p.provider_name || "Provider"} · {p.label} · {formatNaira(p.amount_due)}</p>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${p.status === "owed" ? "bg-red-100 text-red-700" : p.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>{p.status === "owed" ? "Pay now" : p.status === "pending" ? "Event not yet held" : "Paid"}</span>
      </div>
      <p className="text-[10px] text-gray-500">{p.property_title} · {p.check_in} · {p.reference}{p.provider_contact ? ` · ${p.provider_contact}` : ""}</p>
      {p.note && <p className="text-[10px] text-amber-800">{p.note}</p>}
      {p.status === "paid" && <p className="text-[10px] text-green-700">Paid {p.paid_at ? formatDateTime(p.paid_at) : ""} · {p.paid_ref}</p>}
      {(p.status === "owed" || p.status === "pending") && (
        <div className="flex gap-1">
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Transfer reference" className="flex-1 border border-gray-300 rounded px-2 py-1 text-[11px]" />
          <button disabled={busy || !ref.trim()} onClick={pay} className="px-3 py-1 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">Mark paid</button>
        </div>
      )}
      {err && <p className="text-[10px] text-red-600">{err}</p>}
    </div>
  );
}

function PayoutsSection() {
  const [d, setD] = useState<Payouts | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc("admin_get_service_payouts");
    if (data) setD(data as Payouts);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  if (!d) return null;
  const r = d.revenue;
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-chs-charcoal">💰 Service money</p>
      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
        <div className="bg-white border border-gray-200 rounded-lg p-2"><p className="text-gray-500">Held by CHS</p><p className="font-bold">{formatNaira(r.held)}</p></div>
        <div className="bg-white border border-gray-200 rounded-lg p-2"><p className="text-gray-500">CHS earned (fees and commission)</p><p className="font-bold">{formatNaira(r.earned)}</p></div>
        <div className="bg-white border border-gray-200 rounded-lg p-2"><p className="text-gray-500">Owed to providers now</p><p className="font-bold">{formatNaira(r.owed_to_providers)}</p></div>
        <div className="bg-white border border-gray-200 rounded-lg p-2"><p className="text-gray-500">Providers, after their event</p><p className="font-bold">{formatNaira(r.pending_to_providers)}</p></div>
      </div>
      {d.payouts.length === 0 && <p className="text-[11px] text-gray-400">No provider payouts yet.</p>}
      {d.payouts.map((p) => <PayoutRow key={p.id + p.status} p={p} onChanged={load} />)}
    </div>
  );
}

export default function AdminServiceSourcing() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_get_service_sourcing");
    if (error) { setErr(error.message); return; }
    setRows((data as Row[]) || []);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (err) return <p className="text-xs text-red-600">{err}</p>;
  if (!rows) return <p className="text-xs text-gray-400">Loading…</p>;
  const group = (st: Row["status"], title: string) => {
    const g = rows.filter((r) => r.status === st);
    if (g.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-xs font-bold text-chs-charcoal">{title} ({g.length})</p>
        {g.map((r) => <Card key={r.id + r.status + r.messages + (r.quoted_at || "")} r={r} onChanged={load} />)}
      </div>
    );
  };
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-lg font-bold text-chs-charcoal">🤝 Service sourcing</h2>
        <p className="text-[11px] text-gray-500">Venues ask CHS to find providers (photographer, MC, caterer, ushers, decoration and so on). Propose who and the price the provider agreed; that is the price the guest sees. The guest pays CHS, CHS holds it, and after the event you pay the provider (price less commission) from the payouts list below.</p>
      </div>
      {rows.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Nothing waiting. When a venue asks for help sourcing a service, it appears here.</p>}
      {group("sourcing", "Venues waiting for a proposal")}
      {group("quoted", "Proposals waiting for the venue")}
      {group("supplied", "Accepted: confirm the provider")}
      <PayoutsSection />
    </div>
  );
}
