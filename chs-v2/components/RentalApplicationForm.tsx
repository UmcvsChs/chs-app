"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";

interface RentalApplicationFormProps {
  propertyId: string;
  session: Session;
  onSuccess: () => void;
}

export default function RentalApplicationForm({
  propertyId,
  session,
  onSuccess,
}: RentalApplicationFormProps) {
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorPhone, setGuarantorPhone] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guarantorName.trim() || !guarantorPhone.trim()) {
      setError("Please enter your guarantor's name and phone number.");
      return;
    }
    if (!moveInDate) {
      setError("Please choose your preferred move-in date.");
      return;
    }

    setError(null);
    setSubmitting(true);

    // Genuinely starts at "pending" — CHS reviews documents first, then
    // the property's real owner makes the actual final decision. Never
    // treats admin's own review as the final word, unlike the original
    // app's first version of this same step.
    const { error: insertError } = await supabase.from("rental_applications").insert({
      property_id: propertyId,
      tenant_id: session.user.id,
      guarantor_name: guarantorName.trim(),
      guarantor_phone: guarantorPhone.trim(),
      move_in_date: moveInDate,
    });

    if (insertError) {
      setError("Could not submit your application. Please try again.");
      setSubmitting(false);
      return;
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-gray-500">
        CHS will review your documents, then the property owner makes the final decision on your
        application.
      </p>
      <div>
        <label className="text-xs font-semibold text-gray-600">Guarantor&apos;s full name</label>
        <input
          type="text"
          value={guarantorName}
          onChange={(e) => setGuarantorName(e.target.value)}
          placeholder="Full name"
          className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Guarantor&apos;s phone number</label>
        <input
          type="tel"
          value={guarantorPhone}
          onChange={(e) => setGuarantorPhone(e.target.value)}
          placeholder="08XXXXXXXXX"
          className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Preferred move-in date</label>
        <input
          type="date"
          value={moveInDate}
          onChange={(e) => setMoveInDate(e.target.value)}
          className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
        />
      </div>
      {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit application"}
      </button>
    </form>
  );
}
