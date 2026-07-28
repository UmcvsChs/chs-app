"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export default function DemandRegistryForm() {
  const { session } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [summary, setSummary] = useState("");
  const [area, setArea] = useState("");
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!summary.trim()) {
      setError("Please describe what you're looking for.");
      return;
    }
    if (!session) {
      setError("Please log in first.");
      return;
    }
    setError(null);
    setSubmitting(true);

    // Genuinely anonymous — the real table has no user_id column at all,
    // by design; this is aggregate market signal, not tied to any one
    // person, even though logging in is required to submit it.
    const { error: insertError } = await supabase.from("demand_registry").insert({
      search_summary: summary.trim(),
      area_filter: area.trim() || null,
      min_price: minPrice || null,
      max_price: maxPrice || null,
    });

    if (insertError) {
      setError("Could not submit this. Please try again.");
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 mx-4 mt-3 text-center">
        <p className="text-xs text-chs-red">✓ Noted — CHS and owners can see this demand and list accordingly.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 mx-4 mt-3">
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="w-full text-xs font-semibold text-chs-red">
          Can&apos;t find what you&apos;re looking for? Tell us →
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <p className="text-xs font-bold text-chs-charcoal">What are you looking for?</p>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            placeholder="e.g. 2-bedroom flat for rent, must have borehole"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs"
          />
          <input
            type="text"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Preferred area (optional)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value === "" ? "" : parseInt(e.target.value))}
              placeholder="Min budget (₦)"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs"
            />
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value === "" ? "" : parseInt(e.target.value))}
              placeholder="Max budget (₦)"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs"
            />
          </div>
          {error && <p className="text-[10px] text-chs-red">{error}</p>}
          <button type="submit" disabled={submitting}
            className="w-full py-2 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      )}
    </div>
  );
}
