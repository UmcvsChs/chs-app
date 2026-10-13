"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

// CHS admin's view of every hotel and lodge: what needs the admin today (requests to relay, host answers to release,
// a calendar nobody has confirmed), who is arriving or in the house, and how much guest money is being held.

interface Row {
  id: string; title: string; host_name: string | null; host_phone: string | null; rooms: number; calendar_confirmed_at: string | null; days_since_calendar: number | null;
  to_relay: number; with_host: number; replies_to_release: number; guest_to_pay: number; arriving_today: number; in_house: number; arriving_7d: number;
  payouts_held: number; amount_held: number; urgent: number; attention: number;
}

const chip = (cls: string, text: string) => <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cls}`}>{text}</span>;

export default function AdminHotels() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_get_hotels");
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
          <h2 className="font-serif text-lg font-bold text-chs-charcoal">🏨 Hotels &amp; Lodges</h2>
          <p className="text-[11px] text-gray-500">Every hotel and lodge on one screen, most urgent first. Relay requests and release payouts in <b>Bookings</b>; release host answers in <b>Host replies</b>; peak pricing and cancellation rules are in <b>Hotel Controls</b>.</p>
        </div>
        <button onClick={load} className="text-[10px] font-semibold text-chs-red underline whitespace-nowrap">🔄 Refresh</button>
      </div>
      {rows.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No hotels or lodges listed yet.</p>}
      {rows.map((r) => {
        const calendarStale = r.days_since_calendar === null || r.days_since_calendar >= 3;
        return (
          <div key={r.id} className={`bg-white rounded-xl border p-3 space-y-1 ${r.attention > 0 ? "border-chs-red" : "border-gray-200"}`}>
            <div className="flex justify-between items-start gap-2">
              <p className="text-sm font-bold text-chs-charcoal">{r.title}</p>
              <span className="text-[10px] text-gray-500 whitespace-nowrap">{r.rooms} room{r.rooms !== 1 ? "s" : ""}</span>
            </div>
            <p className="text-[11px] text-gray-500">Host: {r.host_name || "?"}{r.host_phone ? ` · ${r.host_phone}` : ""}</p>
            <div className="flex flex-wrap gap-1">
              {r.to_relay > 0 && <Link href="/admin?tab=shortletbookings" className="no-underline">{chip("bg-red-100 text-red-700 font-bold", `${r.to_relay} request${r.to_relay > 1 ? "s" : ""} to relay`)}</Link>}
              {r.replies_to_release > 0 && <Link href="/admin?tab=hostreplies" className="no-underline">{chip("bg-blue-100 text-blue-800 font-bold", `${r.replies_to_release} host answer${r.replies_to_release > 1 ? "s" : ""} to release`)}</Link>}
              {r.urgent > 0 && chip("bg-amber-100 text-amber-800 font-bold", `${r.urgent} urgent (arrives soon)`)}
              {r.with_host > 0 && chip("bg-gray-100 text-gray-700", `${r.with_host} with the host`)}
              {r.guest_to_pay > 0 && chip("bg-gray-100 text-gray-700", `${r.guest_to_pay} guest${r.guest_to_pay > 1 ? "s" : ""} to pay`)}
              {r.arriving_today > 0 && chip("bg-green-100 text-green-800", `${r.arriving_today} arriving today`)}
              {r.in_house > 0 && chip("bg-green-100 text-green-800", `${r.in_house} in the house`)}
              {r.arriving_7d > 0 && chip("bg-gray-100 text-gray-700", `${r.arriving_7d} arriving in 7 days`)}
              {r.payouts_held > 0 && chip("bg-gray-100 text-gray-700", `${r.payouts_held} stay${r.payouts_held > 1 ? "s" : ""} paid, ${formatNaira(r.amount_held)} held`)}
              {calendarStale && chip("bg-red-100 text-red-700", r.days_since_calendar === null ? "calendar never confirmed" : `calendar not confirmed for ${r.days_since_calendar} days`)}
              {r.attention === 0 && r.to_relay + r.with_host + r.guest_to_pay + r.in_house + r.arriving_7d + r.payouts_held === 0 && chip("bg-gray-100 text-gray-500", "Quiet: nothing needs you")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
