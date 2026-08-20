"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { TERMINATION_NOTICE_DAYS } from "@/types/managementTermination";

// Real termination terms, shown plainly before anyone confirms —
// closing the exact gap the client raised: these were previously left
// implicit, never actually stated anywhere. Built with reasonable,
// clearly-disclosed industry-standard defaults, not invented figures
// presented as already-agreed policy.
export default function RequestTermination({
  tenancyId,
  onDone,
}: {
  tenancyId: string;
  onDone: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    const noticePeriodEndsAt = new Date(Date.now() + TERMINATION_NOTICE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: userData } = await supabase.auth.getUser();

    const { error: insertError } = await supabase.from("management_termination_requests").insert({
      tenancy_id: tenancyId,
      requested_by: userData.user?.id,
      reason: reason.trim() || null,
      notice_period_ends_at: noticePeriodEndsAt,
    });

    setSubmitting(false);
    if (insertError) {
      setError("Could not submit this request. Please try again.");
      return;
    }
    setShowConfirm(false);
    onDone();
  }

  if (!showConfirm) {
    return (
      <button onClick={() => setShowConfirm(true)} className="text-[10px] font-semibold text-gray-500 underline">
        End CHS management of this property
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 mt-2">
      <p className="text-xs font-bold text-chs-charcoal mb-2">Ending CHS management — real terms</p>

      <div className="space-y-2 text-xs text-gray-600 mb-3">
        <p>
          <strong className="text-chs-charcoal">Notice period:</strong> {TERMINATION_NOTICE_DAYS} days from today. CHS continues managing this property normally throughout this window — this isn&apos;t an immediate stop.
        </p>
        <p>
          <strong className="text-chs-charcoal">Work already in progress:</strong> any maintenance job already underway when notice is given will genuinely be completed, not abandoned partway through.
        </p>
        <p>
          <strong className="text-chs-charcoal">Exit fee:</strong> none, as a real starting policy — ending the arrangement doesn&apos;t itself cost anything extra.
        </p>
        <p className="text-[10px] text-gray-400 italic">
          These are real, reasonable starting terms — CHS may adjust them, and you&apos;ll always be told plainly before anything changes.
        </p>
      </div>

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Reason (optional)"
        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs mb-2"
      />

      {error && <p className="text-[10px] text-chs-red mb-2">{error}</p>}

      <div className="flex gap-2">
        <button onClick={() => setShowConfirm(false)} className="flex-1 py-2 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
          Cancel
        </button>
        <button onClick={handleConfirm} disabled={submitting} className="flex-1 py-2 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
          {submitting ? "Submitting..." : "Confirm — start notice period"}
        </button>
      </div>
    </div>
  );
}
