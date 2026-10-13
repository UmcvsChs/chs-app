"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

// The booking owner's side: start a split, share the code, watch it fill, pay the rest.
interface Split { code: string; status: string; needed: number; pooled: number; hold_expires_at: string | null; contributions: { who: string; amount: number; status: string; returned_back: number }[] }

export default function SplitPayment({ bookingId, status, onChanged }: { bookingId: string; status: string; onChanged: () => void }) {
  const [split, setSplit] = useState<Split | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_booking_split", { p_booking: bookingId });
    setSplit((data as Split | null) ?? null);
  }, [bookingId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function run(p: PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true); setErr(null);
    const { error } = await p;
    setBusy(false);
    if (error) setErr(error.message === "insufficient_balance" ? "NEEDS_FUNDS" : error.message); else { await load(); onChanged(); }
  }
  const link = split ? `${typeof window !== "undefined" ? window.location.origin : ""}/split/${split.code}` : "";
  async function share() {
    const text = `Please help me pay for my booking on CHS. Open ${link} (code ${split?.code}) and put in what you can from your CHS wallet. Your money is held safely and returned if we don't reach the full amount.`;
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  const paid = split?.status === "paid";
  if (status !== "awaiting_payment" && !paid) return null;
  const open = split?.status === "open";
  const remaining = split ? Number(split.needed) - Number(split.pooled) : 0;

  return (
    <div className="mt-2 border border-gray-200 rounded-xl p-3 text-xs bg-gray-50 space-y-1.5">
      {!split || (!open && !paid) ? (
        <>
          <p className="font-semibold text-chs-charcoal">Paying with others?</p>
          <p className="text-[11px] text-gray-500">Split this payment with friends and family. Each person pays their part from their own CHS wallet. The money is held by CHS until the full amount is raised, and goes back to them if it is not.</p>
          <button disabled={busy} onClick={() => run(supabase.rpc("open_booking_split", { p_booking: bookingId }))} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold">Split this payment</button>
        </>
      ) : (
        <>
          <p className="font-semibold text-chs-charcoal">{paid ? "Paid together" : "Split payment open"} · code {split.code}</p>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-chs-red" style={{ width: `${Math.min(100, Math.round((Number(split.pooled) / Number(split.needed)) * 100))}%` }} /></div>
          <p>{formatNaira(split.pooled)} of {formatNaira(split.needed)} raised{open ? ` · ${formatNaira(remaining)} to go` : ""}</p>
          {split.contributions.map((c, i) => <p key={i} className="text-[11px] text-gray-600">{c.who}: {formatNaira(c.amount)}{c.returned_back ? ` (${formatNaira(c.returned_back)} shared back from a refund)` : ""}</p>)}
          {open && (
            <div className="flex gap-2 flex-wrap pt-1">
              <button onClick={share} className="px-3 py-1.5 rounded-full border border-chs-charcoal text-[11px] font-semibold">{copied ? "Copied" : "Share link"}</button>
              <button disabled={busy} onClick={() => run(supabase.rpc("split_pay_rest", { p_booking: bookingId }))} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold">Pay the rest ({formatNaira(remaining)}) from my wallet</button>
              <button disabled={busy} onClick={() => run(supabase.rpc("cancel_booking_split", { p_booking: bookingId }))} className="px-3 py-1.5 rounded-full border text-[11px]">Stop splitting</button>
            </div>
          )}
          {open && split.hold_expires_at && <p className="text-[10px] text-gray-500">Everyone must finish before {new Date(split.hold_expires_at).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}, or all money is returned.</p>}
          {paid && <p className="text-[10px] text-gray-500">If this booking is ever cancelled, each person automatically gets their share of the refund back.</p>}
        </>
      )}
      {err === "NEEDS_FUNDS" ? <p className="text-red-600">Your wallet balance is too low. Fund it in the Wallet tab, then try again.</p> : err && <p className="text-red-600">{err}</p>}
    </div>
  );
}
