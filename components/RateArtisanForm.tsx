"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";

// The real, earned rating — only ever reachable once a job is genuinely
// resolved, left by the real client who requested it. Also carries the
// genuinely two-sided dispute option right alongside it, per the
// client's explicit instruction that a client can be difficult too.
export default function RateArtisanForm({
  faultReportId,
  artisanId,
  artisanUserId,
  session,
  alreadyRated,
  onDone,
}: {
  faultReportId: string;
  artisanId: string;
  artisanUserId: string;
  session: Session;
  alreadyRated: boolean;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"none" | "rate" | "dispute">("none");
  const [quality, setQuality] = useState(5);
  const [reliability, setReliability] = useState(5);
  const [conduct, setConduct] = useState(5);
  const [comment, setComment] = useState("");
  const [disputeText, setDisputeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitRating() {
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await supabase.from("artisan_ratings").insert({
      fault_report_id: faultReportId,
      artisan_id: artisanId,
      rated_by: session.user.id,
      quality_stars: quality,
      reliability_stars: reliability,
      conduct_stars: conduct,
      comment: comment.trim() || null,
    });
    setSubmitting(false);
    if (insertError) {
      setError("Could not submit your rating. Please try again.");
      return;
    }
    setMode("none");
    onDone();
  }

  async function submitDispute() {
    if (!disputeText.trim()) {
      setError("Please describe what happened.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await supabase.from("artisan_job_disputes").insert({
      fault_report_id: faultReportId,
      raised_by: session.user.id,
      against: artisanUserId,
      description: disputeText.trim(),
    });
    setSubmitting(false);
    if (insertError) {
      setError("Could not submit this dispute. Please try again.");
      return;
    }
    setMode("none");
    onDone();
  }

  if (alreadyRated) {
    return <p className="text-[10px] text-gray-400 mt-1">✓ You&apos;ve rated this job.</p>;
  }

  if (mode === "none") {
    return (
      <div className="flex gap-3 mt-1">
        <button onClick={() => setMode("rate")} className="text-[10px] font-semibold text-chs-red underline">Rate this job</button>
        <button onClick={() => setMode("dispute")} className="text-[10px] font-semibold text-gray-500 underline">Raise a dispute</button>
      </div>
    );
  }

  if (mode === "rate") {
    return (
      <div className="mt-2 bg-gray-50 rounded-lg p-2.5 space-y-2">
        {[
          { label: "Quality of work", value: quality, set: setQuality },
          { label: "Reliability", value: reliability, set: setReliability },
          { label: "Conduct & professionalism", value: conduct, set: setConduct },
        ].map((row) => (
          <div key={row.label}>
            <p className="text-[10px] text-gray-500">{row.label}</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => row.set(n)} className={`text-lg ${n <= row.value ? "text-chs-amber-dark" : "text-gray-300"}`}>★</button>
              ))}
            </div>
          </div>
        ))}
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Comment (optional)"
          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
        {error && <p className="text-[10px] text-chs-red">{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => setMode("none")} className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">Cancel</button>
          <button onClick={submitRating} disabled={submitting} className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
            {submitting ? "Submitting..." : "Submit rating"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 bg-gray-50 rounded-lg p-2.5 space-y-2">
      <textarea value={disputeText} onChange={(e) => setDisputeText(e.target.value)} rows={2}
        placeholder="Describe what happened — CHS will review both sides."
        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
      {error && <p className="text-[10px] text-chs-red">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => setMode("none")} className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">Cancel</button>
        <button onClick={submitDispute} disabled={submitting} className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
          {submitting ? "Submitting..." : "Submit dispute"}
        </button>
      </div>
    </div>
  );
}
