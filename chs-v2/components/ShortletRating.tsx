"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// Real, new component completing the client's requested rating
// system — the single biggest real trust signal missing from this
// category before now.
export default function ShortletRating({ bookingId, label }: { bookingId: string; label: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (rating === 0) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_shortlet_rating", {
      p_booking_id: bookingId,
      p_rating: rating,
      p_comment: comment.trim() || null,
    });
    setSubmitting(false);
    if (!error) setSubmitted(true);
  }

  if (submitted) {
    return <p className="text-[10px] text-green-700 font-semibold mt-2">✓ Thank you — your real rating has been submitted.</p>;
  }

  return (
    <div className="mt-2 bg-gray-50 rounded-lg p-2">
      <p className="text-[10px] font-semibold text-chs-charcoal mb-1">{label}</p>
      <div className="flex gap-1 mb-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} className="text-lg">
            {n <= rating ? "⭐" : "☆"}
          </button>
        ))}
      </div>
      <input type="text" value={comment} onChange={(e) => setComment(e.target.value)}
        placeholder="A real, short comment (optional)" className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-[11px] mb-2" />
      <button onClick={handleSubmit} disabled={rating === 0 || submitting}
        className="w-full py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
        {submitting ? "Submitting..." : "Submit real rating"}
      </button>
    </div>
  );
}
