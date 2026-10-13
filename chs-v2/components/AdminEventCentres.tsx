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
  check_in: string; check_out: string; status: string; payment_status: string | null; time_slots: boolean; reply_pending: string | null; amount: number; hold_expires_at: string | null;
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
            <p className="text-[11px] text-gray-500">Host: {r.host_name || "?"} · Guest: {r.guest_name || "?"}</p>
            <p className="text-sm font-bold text-chs-charcoal">{formatNaira(r.amount)} <span className="text-[10px] font-normal text-gray-500">{r.payment_status === "held_escrow" || r.payment_status === "released" ? "· hall paid" : "· hall not paid yet"}</span></p>
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
