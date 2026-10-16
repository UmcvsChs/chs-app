"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/format";

type Flow = "booking_guest" | "application" | "offer" | "quote" | "rto";
type Ev = { action: string; to_name: string | null; to_phone: string | null; note: string | null; created_at: string };

// One pair of buttons for every relayed conversation (bookings to the guest, tenant/owner, buyer/seller, marketplace,
// rent-to-own): "Resend" re-notifies whoever is waiting at this stage; "Withdraw" closes an unpaid request and tells both
// sides. Every use is recorded and shown below, with the recipient's name and phone so the right person is checked.
export default function AdminRelayActions({ flow, id, canWithdraw = true, onDone }: { flow: Flow; id: string; canWithdraw?: boolean; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);

  const loadEvents = useCallback(async () => {
    const { data } = await supabase.rpc("get_relay_events", { p_flow: flow, p_id: id });
    setEvents(Array.isArray(data) ? (data as unknown as Ev[]) : []);
  }, [flow, id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) loadEvents();
  }, [open, loadEvents]);

  async function resend() {
    setBusy(true); setErr(null); setMsg(null);
    const { data, error } = flow === "booking_guest"
      ? await supabase.rpc("admin_resend_booking_to_guest", { p_booking_id: id, p_note: note || null })
      : await supabase.rpc("admin_resend_relay", { p_flow: flow, p_id: id, p_note: note || null });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const d = data as { to_name?: string; to_phone?: string } | null;
    setMsg(`✓ Re-sent to ${d?.to_name || "the person"}${d?.to_phone ? ` (${d.to_phone})` : ""}. They must log in with this number to see it.`);
    setNote(""); loadEvents(); onDone?.();
  }
  async function withdraw() {
    if (!reason.trim()) { setErr("Please write a reason before withdrawing."); return; }
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await supabase.rpc("admin_withdraw_relay", { p_flow: flow, p_id: id, p_reason: reason });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg("✓ Withdrawn. Both sides have been told."); setReason(""); loadEvents(); onDone?.();
  }

  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen(!open)} className="text-[10px] font-semibold text-chs-red underline">
        {open ? "Hide" : "🔁 Resend / ↩️ Withdraw"}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 border border-gray-100 rounded-lg p-2 bg-gray-50">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note to add when re-sending" className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
          <button type="button" onClick={resend} disabled={busy} className="w-full py-1.5 rounded-full bg-chs-red text-white text-[11px] font-semibold disabled:opacity-50">{busy ? "Working…" : "🔁 Resend to the person waiting"}</button>
          {canWithdraw && (
            <>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for withdrawing (recorded)" className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
              <button type="button" onClick={withdraw} disabled={busy} className="w-full py-1.5 rounded-full bg-gray-200 text-gray-700 text-[11px] font-semibold disabled:opacity-50">↩️ Withdraw (both sides are told)</button>
            </>
          )}
          {msg && <p className="text-[10px] text-green-700 font-semibold">{msg}</p>}
          {err && <p className="text-[10px] text-chs-red">{err}</p>}
          {events.length > 0 && (
            <div className="text-[9px] text-gray-500 space-y-0.5">
              {events.map((e, i) => (
                <p key={i}>{e.action === "resent" ? "🔁 Re-sent" : "↩️ Withdrawn"} {formatDateTime(e.created_at)}{e.to_name ? ` · ${e.to_name}${e.to_phone ? " " + e.to_phone : ""}` : ""}{e.note ? ` — “${e.note}”` : ""}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
