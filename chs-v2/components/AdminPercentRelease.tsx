"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

// "Release a percentage to the host": the money stays in CHS escrow until an admin chooses to release a part of the host's
// payout (default 60%, can be raised or lowered). Two taps, with an optional note. The balance is released later in the
// normal way when the guest arrives and confirms. Everything is recorded and shown to the host.
export default function AdminPercentRelease({ bookingId, hostNet, alreadyReleased, defaultPct, onDone }: {
  bookingId: string; hostNet: number; alreadyReleased: number; defaultPct: number; onDone: () => void;
}) {
  const [pct, setPct] = useState(String(defaultPct || 60));
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const n = parseFloat(pct);
  const valid = !isNaN(n) && n > 0 && n <= 100;
  const amount = valid ? Math.round(hostNet * n) / 100 : 0;
  const left = Math.max(0, hostNet - alreadyReleased);

  async function release() {
    setBusy(true); setErr(null); setMsg(null);
    const { data, error } = await supabase.rpc("admin_release_booking_percentage", { p_booking: bookingId, p_pct: n, p_note: note || null });
    setBusy(false); setStep("idle");
    if (error) { setErr(error.message); return; }
    const d = data as { amount: number; host_name: string; still_held: number };
    setMsg(`✓ ${formatNaira(d.amount)} released to ${d.host_name}. ${formatNaira(d.still_held)} stays held.`);
    setNote("");
    onDone();
  }

  return (
    <div className="mt-1.5 border border-chs-amber rounded-lg p-2 bg-white">
      <p className="text-[10px] font-bold text-chs-charcoal">Release a percentage to the host</p>
      <p className="text-[9px] text-gray-500">Host payout {formatNaira(hostNet)} · already released {formatNaira(alreadyReleased)} · still held {formatNaira(left)}</p>
      <div className="flex items-center gap-1.5 mt-1">
        <input type="number" min={1} max={100} step="any" value={pct} onChange={(e) => { setPct(e.target.value); setStep("idle"); }} className="w-16 px-2 py-1 rounded border border-gray-200 text-[11px]" />
        <span className="text-[11px] text-gray-500">% = <b>{formatNaira(amount)}</b></span>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note to the host (recorded)" className="w-full mt-1 px-2 py-1 rounded border border-gray-200 text-[11px]" />
      {step === "idle" ? (
        <button type="button" disabled={!valid || left <= 0} onClick={() => setStep("confirm")} className="w-full mt-1.5 py-1.5 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-40">
          Release {valid ? n : ""}% to the host
        </button>
      ) : (
        <div className="flex gap-1.5 mt-1.5">
          <button type="button" disabled={busy} onClick={release} className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">{busy ? "Releasing…" : `Yes, release ${formatNaira(amount)} now`}</button>
          <button type="button" disabled={busy} onClick={() => setStep("idle")} className="px-3 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">Cancel</button>
        </div>
      )}
      {msg && <p className="text-[10px] text-green-700 font-semibold mt-1">{msg}</p>}
      {err && <p className="text-[10px] text-chs-red mt-1">{err}</p>}
    </div>
  );
}
