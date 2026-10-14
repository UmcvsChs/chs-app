"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import BookingSessions from "@/components/BookingSessions";

// CHS admin's view of every live EVENT CENTRE booking: where it stands, the sessions booked, the services the guest
// asked for and who is dealing with them, the venue's quotation, and the service money CHS is holding.

interface Row {
  id: string; ref: string; property_title: string; host_name: string | null; guest_name: string | null; event_type: string | null; guests: number | null; tier: string | null;
  check_in: string; check_out: string; status: string; payment_status: string | null; time_slots: boolean; reply_pending: string | null; amount: number; hold_expires_at: string | null; advance_paid?: number; advance_paid_at?: string | null; advance_pct?: number | null; advance_recover_due?: number; property_id?: string; risk_class?: string; docs_count?: number; permitted_capacity?: number | null; capacity_verified?: boolean | null; guests_n?: number | null;
  services_total: number; services_waiting_host: number; services_with_chs: number; services_to_relay: number; services_unpaid: number;
  quote_status: string | null; quote_total: number | null; service_money_held: number; changes_open: number;
}

const STAGE: Record<string, { t: string; c: string }> = {
  awaiting_admin_relay: { t: "Waiting for you to relay", c: "bg-red-100 text-red-700" },
  pending_host_review: { t: "With the host", c: "bg-amber-100 text-amber-800" },
  awaiting_payment: { t: "Guest to pay", c: "bg-blue-100 text-blue-800" },
  confirmed: { t: "Confirmed & paid", c: "bg-green-100 text-green-800" },
};

export default function AdminEventCentres() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  async function releaseAdvance(id: string) {
    if (!window.confirm("Release the advance to the venue and its services now? This pays the venue's advance into its wallet and puts the provider advances on your payout list.")) return;
    setBusyId(id); setNote(null);
    const { data, error } = await supabase.rpc("admin_release_event_advance", { p_booking: id });
    setBusyId(null);
    if (error) { setNote(error.message); return; }
    setNote(Number(data) > 0 ? `Advance released: ${formatNaira(Number(data))} paid to the venue. Provider advances are in Service sourcing → payouts.` : "Nothing was released (already paid, not paid by the guest, or advance is switched off).");
    load();
  }
  async function verifyCapacity(r: Row) {
    const v = window.prompt(`Verified capacity for ${r.property_title} (check the operating permit):`, r.permitted_capacity ? String(r.permitted_capacity) : "");
    if (!v || !r.property_id) return;
    const { error } = await supabase.rpc("admin_verify_event_capacity", { p_property: r.property_id, p_capacity: Number(v) });
    if (error) setNote(error.message); else { setNote("Capacity verified."); load(); }
  }
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_get_event_centres");
    if (error) { setErr(error.message); return; }
    setRows((data as Row[]) || []);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  if (err) return <p className="text-xs text-red-600">{err}</p>;
  if (!rows) return <p className="text-xs text-gray-400">Loading…</p>;
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-start gap-2">
        <div>
          <h2 className="font-serif text-lg font-bold text-chs-charcoal">🎉 Event Centres</h2>
          <p className="text-[11px] text-gray-500">Every live event-centre booking in one place. To relay a request or release a payout use <b>Bookings</b>; to release the host&apos;s answers use <b>Host replies</b>; to source a service use <b>Service sourcing</b>. Hotels, lodges and shortlets are in the same Bookings tab, tagged by type.</p>
        </div>
        <button onClick={load} className="text-[10px] font-semibold text-chs-red underline whitespace-nowrap">🔄 Refresh</button>
      </div>
      {note && <p className="text-[11px] text-blue-800 bg-blue-50 rounded px-2 py-1">{note}</p>}
      {rows.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No live event-centre bookings right now.</p>}
      {rows.map((r) => {
        const st = STAGE[r.status] || { t: r.status, c: "bg-gray-100 text-gray-600" };
        return (
          <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-3 space-y-1">
            <div className="flex justify-between items-start gap-2">
              <p className="text-sm font-bold text-chs-charcoal">{r.property_title}</p>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${st.c}`}>{st.t}</span>
            </div>
            <p className="text-[11px] text-gray-600">{r.event_type || "Event"}{r.guests ? ` · ${r.guests} guests` : ""}{r.tier ? ` · ${r.tier}` : ""} · Ref {r.ref}</p>
            {r.time_slots ? <BookingSessions bookingId={r.id} compact /> : <p className="text-[11px] text-gray-600">📅 {r.check_in}{r.check_out !== r.check_in ? ` to ${r.check_out}` : ""}</p>}
            <div className="flex flex-wrap items-center gap-1">
              {r.risk_class && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${r.risk_class === "enhanced" ? "bg-red-100 text-red-700" : r.risk_class === "managed" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>{r.risk_class === "enhanced" ? "Enhanced review: ask for permits and a safety plan" : r.risk_class === "managed" ? "Managed event" : "Routine event"}</span>}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">📎 {r.docs_count || 0} document{(r.docs_count || 0) === 1 ? "" : "s"}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${r.capacity_verified ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{r.permitted_capacity ? `Capacity ${r.permitted_capacity}${r.capacity_verified ? " ✓" : " (not verified)"}` : "Capacity not declared"}</span>
              <button onClick={() => verifyCapacity(r)} className="text-[10px] underline text-chs-red">{r.capacity_verified ? "Change" : "Verify capacity"}</button>
            </div>
            <p className="text-[11px] text-gray-500">Host: {r.host_name || "?"} · Guest: {r.guest_name || "?"}</p>
            <p className="text-sm font-bold text-chs-charcoal">{formatNaira(r.amount)} <span className="text-[10px] font-normal text-gray-500">{r.payment_status === "held_escrow" || r.payment_status === "released" ? "· hall paid" : "· hall not paid yet"}</span></p>
            {r.status === "confirmed" && r.payment_status === "held_escrow" && (
              r.advance_paid_at
                ? <p className="text-[11px] text-green-800 bg-green-50 rounded px-2 py-1">✅ Advance ({r.advance_pct}%) paid to the venue: {formatNaira(r.advance_paid || 0)}. Balance after the event.{(r.advance_recover_due || 0) > 0 ? ` To recover: ${formatNaira(r.advance_recover_due || 0)}.` : ""}</p>
                : <div className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1"><p className="text-[11px] text-gray-700 flex-1">Advance goes out automatically 48 hours before the event.</p><button disabled={busyId === r.id} onClick={() => releaseAdvance(r.id)} className="text-[10px] px-2 py-1 rounded-full bg-chs-charcoal text-white font-semibold disabled:opacity-50">Release advance now</button></div>
            )}
            {r.reply_pending && <p className="text-[11px] text-blue-800 bg-blue-50 rounded px-2 py-1">📨 The host has answered. <Link href="/admin?tab=hostreplies" className="underline font-semibold">Release it to the guest</Link></p>}
            <div className="flex flex-wrap gap-1 pt-0.5">
              {r.services_total > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">{r.services_total} service{r.services_total > 1 ? "s" : ""}</span>}
              {r.services_waiting_host > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">{r.services_waiting_host} waiting for the host</span>}
              {r.services_with_chs > 0 && <Link href="/admin?tab=servicesourcing" className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 underline">{r.services_with_chs} with CHS to source</Link>}
              {r.services_to_relay > 0 && <Link href="/admin?tab=hostreplies" className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 underline">{r.services_to_relay} answer{r.services_to_relay > 1 ? "s" : ""} to relay</Link>}
              {r.services_unpaid > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">{r.services_unpaid} priced, not yet paid</span>}
              {r.quote_status && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">Quotation {r.quote_status}{r.quote_total ? `: ${formatNaira(r.quote_total)}` : ""}</span>}
              {r.changes_open > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">{r.changes_open} change request{r.changes_open > 1 ? "s" : ""} open</span>}
              {r.service_money_held > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-800">{formatNaira(r.service_money_held)} service money held</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
