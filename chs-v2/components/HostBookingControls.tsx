"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// Two things a host can do to one confirmed booking:
//  - set a self check-in (lockbox / door) code, shown to the guest only after
//    they tap "I've arrived"
//  - cancel it, with a clear warning of the consequences first.

interface DefaultStatus { strikes: number; window_days: number; penalty_pct: number; next: "warning" | "penalty" | "suspension" }

export default function HostBookingControls({ bookingId, checkIn, onChanged }: { bookingId: string; checkIn: string; onChanged?: () => void }) {
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [status, setStatus] = useState<DefaultStatus | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [today] = useState(() => new Date(Date.now() + 3600000).toISOString().slice(0, 10)); // Lagos is UTC+1
  const canCancel = checkIn >= today;

  async function saveCode() {
    setCodeMsg(null);
    const { error } = await supabase.rpc("host_set_lockbox_code", { p_booking_id: bookingId, p_code: code.trim() });
    setCodeMsg(error ? error.message : code.trim() ? "Saved. The guest sees it only after tapping “I've arrived”." : "Code removed.");
  }

  async function openCancel() {
    setCancelling(true); setErr(null);
    const { data } = await supabase.rpc("get_host_default_status");
    setStatus(data as DefaultStatus);
  }

  async function confirmCancel() {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc("host_cancel_booking", { p_booking_id: bookingId, p_reason: reason.trim() });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const r = data as { action: string; refunded: number; penalty: number; suspended: boolean };
    setDone(r.suspended
      ? "Booking cancelled and the guest was refunded in full. This was your third cancellation, so your listing is suspended while CHS reviews it."
      : r.action === "penalty"
        ? "Booking cancelled and the guest was refunded in full. The penalty was applied to your wallet."
        : "Booking cancelled and the guest was refunded in full. This is a warning.");
    onChanged?.();
  }

  const consequence = status?.next === "warning"
    ? `This is a warning. A second cancellation within ${status.window_days} days costs ${status.penalty_pct}% of the booking value, and a third suspends your listing.`
    : status?.next === "penalty"
      ? `You already have ${status.strikes} cancellation in the last ${status.window_days} days. This one costs ${status.penalty_pct}% of the booking value, taken from your wallet and your next payouts. A third suspends your listing.`
      : status ? `You already have ${status.strikes} cancellations in the last ${status.window_days} days. This one suspends your listing while CHS reviews it.` : "";

  if (done) return <p className="text-[11px] text-green-700 font-semibold mt-2">✓ {done}</p>;

  return (
    <div className="mt-2 space-y-2">
      <div className="bg-gray-50 rounded-lg p-2">
        <p className="text-[10px] font-bold text-chs-charcoal">🔑 Self check-in code (optional)</p>
        <div className="flex gap-1.5 mt-1">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Lockbox or door code" className="flex-1 px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
          <button type="button" onClick={saveCode} className="px-3 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold">Save</button>
        </div>
        {codeMsg && <p className="text-[10px] text-gray-600 mt-1">{codeMsg}</p>}
      </div>

      {canCancel && !cancelling && (
        <button type="button" onClick={openCancel} className="text-[10px] text-chs-red underline">Cancel this confirmed booking</button>
      )}
      {cancelling && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
          <p className="text-[11px] font-bold text-red-800">Cancel a booking you confirmed?</p>
          <ul className="text-[10px] text-red-800 list-disc pl-4 mt-1 space-y-0.5">
            <li>The guest is refunded in full, and the bank processing fee is charged to you.</li>
            <li>The cancelled dates stay blocked on your calendar.</li>
            <li>{consequence || "Checking your record…"}</li>
          </ul>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Tell the guest why (required, no phone numbers). CHS passes it on."
            className="w-full mt-1.5 px-2 py-1.5 rounded border border-red-200 text-[11px]" />
          {err && <p className="text-[10px] text-chs-red mt-1">{err}</p>}
          <div className="flex gap-2 mt-1.5">
            <button type="button" disabled={busy || reason.trim().length < 10 || !status} onClick={confirmCancel} className="flex-1 py-2 rounded-full bg-chs-red text-white text-[11px] font-semibold disabled:opacity-50">
              {busy ? "Cancelling…" : "Yes, cancel and refund the guest"}
            </button>
            <button type="button" onClick={() => setCancelling(false)} className="px-3 py-2 rounded-full border border-gray-300 text-[11px] text-gray-600">Keep it</button>
          </div>
        </div>
      )}
    </div>
  );
}
