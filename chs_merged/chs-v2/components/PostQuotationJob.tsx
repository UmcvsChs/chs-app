"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// A real, manager-initiated maintenance job — restored, found
// completely missing during the systematic Manager dashboard
// comparison. Genuinely distinct from a tenant-reported fault: this
// is planned maintenance the manager starts directly, using the same
// real fault_reports table (property_id, no tenancy) already built.
const JOB_CATEGORIES = ["Plumbing", "Electrical", "Carpentry", "Painting", "Roofing", "Other"];

export default function PostQuotationJob({
  managedProperties,
  onDone,
}: {
  managedProperties: { id: string; title: string }[];
  onDone: () => void;
}) {
  const [show, setShow] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [category, setCategory] = useState(JOB_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [minQuotes, setMinQuotes] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!propertyId) {
      setError("Please select a property.");
      return;
    }
    if (!description.trim()) {
      setError("Please describe the job.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const { error: insertError } = await supabase.from("fault_reports").insert({
      property_id: propertyId,
      category,
      description: description.trim(),
      urgency: "medium",
      location_in_property: "Whole property",
      status: "gathering_quotes",
      min_quotes_required: minQuotes,
    });

    setSubmitting(false);
    if (insertError) {
      setError("Could not post this job. Please try again.");
      return;
    }
    setDescription("");
    setShow(false);
    onDone();
  }

  if (!show) {
    return (
      <button onClick={() => setShow(true)} className="w-full py-2.5 rounded-full bg-chs-red text-white text-xs font-semibold mb-3">
        + Post job for quotation
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 mb-3 space-y-2">
      <p className="text-xs font-bold text-chs-charcoal">Post a new job for quotation directly</p>
      <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}
        className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs bg-white">
        <option value="">Select property</option>
        {managedProperties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
      <select value={category} onChange={(e) => setCategory(e.target.value)}
        className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs bg-white">
        {JOB_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
      </select>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
        placeholder="Describe the job" className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs" />
      <div>
        <label className="text-[10px] text-gray-500">Minimum quotations required</label>
        <input type="number" min={1} value={minQuotes} onChange={(e) => setMinQuotes(parseInt(e.target.value) || 1)}
          className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs" />
      </div>
      {error && <p className="text-[10px] text-chs-red">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => setShow(false)} className="flex-1 py-2 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">Cancel</button>
        <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-2 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
          {submitting ? "Posting..." : "Post job"}
        </button>
      </div>
    </div>
  );
}
