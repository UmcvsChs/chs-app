"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import CurrencyInput from "./CurrencyInput";

interface RaiseDisputeFormProps {
  session: Session;
  tenancyId: string | null;
  againstUserId: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function RaiseDisputeForm({
  session,
  tenancyId,
  againstUserId,
  onSuccess,
  onCancel,
}: RaiseDisputeFormProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please describe the dispute.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const { error: insertError } = await supabase.from("disputes").insert({
      tenancy_id: tenancyId,
      raised_by: session.user.id,
      against: againstUserId,
      description: description.trim(),
      amount_in_dispute: amount || null,
    });

    if (insertError) {
      setError("Could not submit this dispute. Please try again.");
      setSubmitting(false);
      return;
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-gray-600">What happened?</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe the issue clearly — CHS will review both sides before ruling."
          className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Amount in dispute, if any (₦)</label>
        <CurrencyInput value={amount} onChange={setAmount} placeholder="Leave blank if not money-related" />
      </div>
      {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold">
          Cancel
        </button>
        <button type="submit" disabled={submitting}
          className="flex-1 py-2.5 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
          {submitting ? "Submitting..." : "Submit dispute"}
        </button>
      </div>
    </form>
  );
}
