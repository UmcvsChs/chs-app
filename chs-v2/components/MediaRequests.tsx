"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { MediaRequest } from "@/types/mediaRequest";

const REQUEST_TYPES = ["More photos", "Video walkthrough", "General question"];

export default function MediaRequests({
  propertyId,
  answeredRequests,
}: {
  propertyId: string;
  answeredRequests: MediaRequest[];
}) {
  const { session } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [requestType, setRequestType] = useState(REQUEST_TYPES[0]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please describe what you'd like to know or see.");
      return;
    }
    if (!session) {
      setError("Please log in first to ask a question.");
      return;
    }
    setError(null);
    setSubmitting(true);

    // Deliberately anonymous — same real design as community feedback,
    // no identifier is ever attached, even though the person asking is
    // genuinely logged in when they submit this.
    const { error: insertError } = await supabase.from("media_requests").insert({
      property_id: propertyId,
      request_type: requestType,
      description: description.trim(),
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
      <p className="text-xs font-bold text-chs-charcoal mb-2">Questions & answers</p>

      {answeredRequests.length === 0 ? (
        <p className="text-xs text-gray-400 mb-3">No questions answered yet on this property.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {answeredRequests.map((r) => (
            <div key={r.id} className="bg-gray-50 rounded-lg p-2.5 text-xs">
              <p className="font-semibold text-chs-charcoal">Q: {r.description}</p>
              <p className="text-gray-600 mt-1">A: {r.answer}</p>
            </div>
          ))}
        </div>
      )}

      {submitted ? (
        <p className="text-xs text-chs-red">✓ Submitted — the owner or CHS will answer this soon.</p>
      ) : showForm ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <select
            value={requestType}
            onChange={(e) => setRequestType(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white"
          >
            {REQUEST_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What would you like to know or see?"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs"
          />
          {error && <p className="text-[10px] text-chs-red">{error}</p>}
          <button type="submit" disabled={submitting}
            className="w-full py-2 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
            {submitting ? "Submitting..." : "Ask (anonymous)"}
          </button>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)} className="text-[10px] font-semibold text-chs-red underline">
          Ask a question or request more photos/video
        </button>
      )}
    </div>
  );
}
