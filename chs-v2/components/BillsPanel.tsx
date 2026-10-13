"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import GuestEventQuote from "@/components/GuestEventQuote";

// Every quotation or bill a venue has sent the guest, in one place, with the instalments payable from the wallet.
interface Bill {
  quote_id: string; booking_id: string; title: string; check_in: string; status: string; total: number; valid_until: string; created_at: string; paid: number;
  next_due: { id: string; label: string; amount: number; due_date: string } | null;
}
const day = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00+01:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
const STATUS: Record<string, string> = { sent: "Waiting for your answer", accepted: "Accepted", declined: "Declined", expired: "Expired" };

export default function BillsPanel() {
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_bills");
    if (error) setErr(error.message); else setBills((data as Bill[]) || []);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!bills && !err) return <p className="text-xs text-gray-400 text-center py-10">Loading…</p>;
  const open = (bills || []).filter((b) => b.status === "sent" || (b.status === "accepted" && b.next_due));
  const rest = (bills || []).filter((b) => !open.includes(b));
  const owing = open.reduce((s, b) => s + (b.status === "accepted" ? Number(b.total) - Number(b.paid) : 0), 0);

  const card = (b: Bill) => (
    <div key={b.quote_id} className="bg-white rounded-xl border border-gray-200 p-3">
      <div className="flex justify-between gap-2">
        <p className="text-sm font-bold text-chs-charcoal">{b.title}</p>
        <span className="text-[10px] font-bold uppercase text-gray-500">{STATUS[b.status] || b.status}</span>
      </div>
      <p className="text-[11px] text-gray-500">Event/stay from {day(b.check_in)} · Total {formatNaira(b.total)} · Paid {formatNaira(b.paid)}</p>
      {b.status === "accepted" && b.next_due && <p className="text-[11px] font-semibold text-chs-red mt-0.5">Next: {b.next_due.label} {formatNaira(b.next_due.amount)} by {day(b.next_due.due_date)}</p>}
      <GuestEventQuote bookingId={b.booking_id} />
    </div>
  );

  return (
    <div className="px-4 py-4 space-y-3">
      {err && <p className="text-xs text-red-600">{err}</p>}
      {bills && bills.length === 0 && (
        <div className="text-center py-14">
          <p className="text-3xl mb-2">🧾</p>
          <p className="text-sm font-semibold text-chs-charcoal">No quotations or bills</p>
          <p className="text-xs text-gray-400 mt-1">When an event centre or hotel sends you a quotation for extra services (caterer, ushers, band, security), it appears here.</p>
        </div>
      )}
      {open.length > 0 && <p className="text-xs font-bold text-chs-charcoal">Needs you ({open.length}){owing > 0 ? ` · ${formatNaira(owing)} still to pay` : ""}</p>}
      {open.map(card)}
      {rest.length > 0 && <p className="text-xs font-bold text-chs-charcoal pt-2">Earlier</p>}
      {rest.map(card)}
    </div>
  );
}
