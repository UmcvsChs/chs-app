"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira, formatDateTime } from "@/lib/format";

// The host's side of a prepaid stay: where their payout stands, and — once the guest's check-in day has
// arrived — a way to ask CHS to release it if the guest has not confirmed. The payout is released at once
// when the guest confirms arrival, and automatically 24 hours after check-in if they say nothing.
interface ArrivalState {
  state: string; host_net: number; auto_release_at: string | null; confirmed_at: string | null;
  issue_note: string | null; release_requested_at: string | null; check_in: string;
}

export default function HostPayoutStatus({ bookingId }: { bookingId: string }) {
  const [s, setS] = useState<ArrivalState | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_arrival_state", { p_booking_id: bookingId });
    if (data) setS(data as ArrivalState);
  }, [bookingId]);

  useEffect(() => {
    // load() only sets state after its network call returns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!s || s.state === "not_applicable") return null;
  const autoAt = s.auto_release_at ? formatDateTime(s.auto_release_at) : null;

  async function ask() {
    setBusy(true); setError(null);
    const { error: e } = await supabase.rpc("request_shortlet_release", { p_booking_id: bookingId, p_note: note.trim() || null });
    setBusy(false);
    if (e) { setError(e.message); return; }
    await load();
  }

  const box = "mt-2 rounded-lg px-2.5 py-2 text-[11px]";
  if (s.state === "guest_confirmed") return <p className={`${box} text-green-700 bg-green-50`}>✓ Paid — your guest arrived and confirmed everything is as described. {formatNaira(s.host_net)} was released to your wallet.</p>;
  if (s.state === "auto_released") return <p className={`${box} text-green-700 bg-green-50`}>✓ Paid — {formatNaira(s.host_net)} was released to your wallet automatically (no problem reported within 24 hours of check-in).</p>;
  if (s.state === "released") return <p className={`${box} text-green-700 bg-green-50`}>✓ Paid — {formatNaira(s.host_net)} has been released to your wallet.</p>;
  if (s.state === "problem_reported") return <p className={`${box} text-chs-red bg-chs-amber-light`}>⚠ Your guest reported a problem on arrival{s.issue_note ? `: “${s.issue_note}”` : ""}. CHS is looking into it and will contact you; the payment stays held until it is resolved.</p>;
  if (s.state === "awaiting_arrival_day") return <p className={`${box} text-gray-600 bg-gray-50`}>💰 {formatNaira(s.host_net)} (your net payout) is held safely by CHS. It is released to you the moment your guest arrives on {s.check_in} and confirms everything is as described.</p>;
  if (s.state === "release_requested") return <p className={`${box} text-amber-700 bg-chs-amber-light`}>⏳ You asked CHS to release your {formatNaira(s.host_net)}. We have asked your guest to confirm{autoAt ? `; otherwise it is released automatically at ${autoAt}` : ""}.</p>;

  // awaiting_guest_confirmation
  return (
    <div className={`${box} bg-chs-amber-light`}>
      <p className="font-semibold text-chs-charcoal">💰 Your guest&apos;s check-in day has arrived.</p>
      <p className="text-gray-600 mt-0.5">{formatNaira(s.host_net)} (your net payout) is released as soon as your guest confirms they have arrived{autoAt ? `, or automatically at ${autoAt}` : ""}. If your guest is already in, you can ask CHS to release it now.</p>
      <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Optional note to CHS (e.g. guest checked in at 3pm)" className="w-full mt-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
      {error && <p className="text-chs-red mt-1">{error}</p>}
      <button onClick={ask} disabled={busy} className="w-full mt-1.5 py-1.5 rounded-full bg-chs-red text-white text-[11px] font-semibold disabled:opacity-50">{busy ? "Sending…" : "My guest has arrived — ask CHS to release my payment"}</button>
    </div>
  );
}
