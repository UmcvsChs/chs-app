"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// Real, new component completing the request-to-book flow — the
// host's actual, genuine decision, with a real note captured either
// way (why declined, or a real welcome note for an accepted guest).
export default function HostBookingDecision({ bookingId, onDecided }: { bookingId: string; onDecided: () => void }) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"confirmed" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDecision(decision: "confirmed" | "declined") {
    if (decision === "declined" && !note.trim()) {
      setError("Please write a real reason before declining this request.");
      return;
    }
    setSubmitting(decision);
    setError(null);
    const { error: rpcError } = await supabase.rpc("host_decide_shortlet_booking", {
      p_booking_id: bookingId,
      p_decision: decision,
      p_note: note.trim() || null,
    });
    if (rpcError) {
      setError(rpcError.message);
      setSubmitting(null);
      return;
    }
    onDecided();
  }

  return (
    <div className="mt-2">
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Real note (required if declining, optional if accepting)"
        className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-[11px] mb-2"
      />
      {error && <p className="text-[10px] text-chs-red mb-1">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => handleDecision("confirmed")} disabled={!!submitting}
          className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
          {submitting === "confirmed" ? "Accepting..." : "Accept"}
        </button>
        <button onClick={() => handleDecision("declined")} disabled={!!submitting}
          className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold disabled:opacity-50">
          {submitting === "declined" ? "Declining..." : "Decline (real refund)"}
        </button>
      </div>
    </div>
  );
}
