"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { CommunityFeedback as CommunityFeedbackType } from "@/types/communityFeedback";

const RELATION_OPTIONS = ["Current tenant", "Former tenant", "Neighbour", "Visited the area", "Other"];

export default function CommunityFeedback({
  propertyId,
  approvedFeedback,
}: {
  propertyId: string;
  approvedFeedback: CommunityFeedbackType[];
}) {
  const { session } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [relation, setRelation] = useState(RELATION_OPTIONS[0]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) {
      setError("Please share what you know about this property or area.");
      return;
    }
    setError(null);
    setSubmitting(true);

    // Deliberately anonymous — the table itself has no column to even
    // store who submitted this, by design, so there's genuinely nothing
    // to attach here beyond the note itself.
    const { error: insertError } = await supabase.from("community_feedback").insert({
      property_id: propertyId,
      relation,
      note: note.trim(),
    });

    if (insertError) {
      setError("Could not submit this. Please try again.");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 mt-4">
      <p className="text-xs font-bold text-chs-charcoal mb-2">Community feedback</p>

      {approvedFeedback.length === 0 ? (
        <p className="text-xs text-gray-400 mb-3">No community feedback yet on this property.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {approvedFeedback.map((f) => (
            <div key={f.id} className="bg-gray-50 rounded-lg p-2.5 text-xs">
              <p className="text-gray-700">{f.note}</p>
              <p className="text-[10px] text-gray-400 mt-1">— {f.relation}</p>
            </div>
          ))}
        </div>
      )}

      {submitted ? (
        <p className="text-xs text-chs-red">✓ Thank you — CHS will review this before it appears publicly.</p>
      ) : showForm && session ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <select
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white"
          >
            {RELATION_OPTIONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="What do you know about this property or area?"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs"
          />
          {error && <p className="text-[10px] text-chs-red">{error}</p>}
          <button type="submit" disabled={submitting}
            className="w-full py-2 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
            {submitting ? "Submitting..." : "Submit feedback (anonymous)"}
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="text-[10px] font-semibold text-chs-red underline"
        >
          Share what you know (anonymous)
        </button>
      )}
    </div>
  );
}
