"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// Real, new component per direct client request — a genuine,
// stated cancellation policy: full refund 48+ real hours before
// check-in, 50% within 48 hours, none on or after check-in. Every
// number is calculated and enforced server-side, never trusted from
// the client.
export default function CancelBookingButton({ bookingId, onCancelled }: { bookingId: string; onCancelled: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleCancel() {
    setSubmitting(true);
    const { data, error } = await supabase.rpc("cancel_shortlet_booking", { p_booking_id: bookingId });
    setSubmitting(false);
    if (!error && data) {
      setResult(`Cancelled — ${data.refund_pct}% refunded to your wallet.`);
      onCancelled();
    }
  }

  if (result) return <p className="text-[10px] text-gray-500 mt-2">{result}</p>;

  if (confirming) {
    return (
      <div className="mt-2 bg-chs-amber-light rounded-lg p-2">
        <p className="text-[10px] text-chs-charcoal mb-1.5">
          Real cancellation policy: full refund 48+ hours before check-in, 50% within 48 hours, none after check-in.
        </p>
        <div className="flex gap-2">
          <button onClick={handleCancel} disabled={submitting} className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
            {submitting ? "Cancelling..." : "Confirm cancellation"}
          </button>
          <button onClick={() => setConfirming(false)} className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
            Keep booking
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className="text-[10px] text-gray-400 underline mt-2 block">
      Cancel this booking
    </button>
  );
}
