"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

// Real, new component per direct client request — a genuine,
// stated cancellation policy: full refund 48+ real hours before
// check-in, 50% within 48 hours, none on or after check-in. Every
// number is calculated and enforced server-side, never trusted from
// the client.
export default function CancelBookingButton({ bookingId, onCancelled, mode = "cancel" }: { bookingId: string; onCancelled: () => void; mode?: "cancel" | "withdraw" }) {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setSubmitting(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("cancel_shortlet_booking", { p_booking_id: bookingId });
    setSubmitting(false);
    if (rpcError || !data) {
      setError(rpcError?.message || "Could not cancel just now. Please try again.");
      return;
    }
    setResult(data.unpaid
      ? "Request withdrawn — nothing was charged, and the dates have been released."
      : `Cancelled — ${formatNaira(data.refund_amount)} refunded to your wallet (${data.refund_pct}% of your stay).`);
    onCancelled();
  }

  if (result) return <p className="text-[10px] text-gray-500 mt-2">{result}</p>;

  if (confirming) {
    return (
      <div className="mt-2 bg-chs-amber-light rounded-lg p-2">
        <p className="text-[10px] text-chs-charcoal mb-1.5">
          {mode === "withdraw"
            ? "Withdraw this request? Nothing has been charged, and the dates will be released for other guests."
            : "Real cancellation policy: full refund 48+ hours before check-in, 50% within 48 hours, none after check-in. The part not refunded compensates the host for the dates they held; CHS keeps its service fee on it."}
        </p>
        {error && <p className="text-[10px] text-chs-red mb-1.5">{error}</p>}
        <div className="flex gap-2">
          <button onClick={handleCancel} disabled={submitting} className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
            {submitting ? (mode === "withdraw" ? "Withdrawing..." : "Cancelling...") : (mode === "withdraw" ? "Yes, withdraw" : "Confirm cancellation")}
          </button>
          <button onClick={() => setConfirming(false)} className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
            {mode === "withdraw" ? "Keep request" : "Keep booking"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className="text-[10px] text-gray-400 underline mt-2 block">
      {mode === "withdraw" ? "Withdraw this request" : "Cancel this booking"}
    </button>
  );
}
