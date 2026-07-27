"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";

interface InspectionBookingFormProps {
  propertyId: string;
  session: Session;
  onSuccess: () => void;
}

function generateReference(): string {
  // Matches the same "CHS-XXX-####" reference style already used
  // throughout the original app for real, trackable records.
  return "CHS-INS-" + Math.floor(1000 + Math.random() * 9000);
}

// Mirrors the real, database-enforced rule already built into the
// `inspections` table — at least 12 hours' notice — checked here too,
// so someone gets a clear, immediate message instead of a confusing
// raw database error if they pick a time too soon.
function hasEnoughNotice(date: string, time: string): boolean {
  if (!date || !time) return false;
  const requested = new Date(`${date}T${time}`);
  const minimumAllowed = new Date(Date.now() + 12 * 60 * 60 * 1000);
  return requested >= minimumAllowed;
}

export default function InspectionBookingForm({
  propertyId,
  session,
  onSuccess,
}: InspectionBookingFormProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [meetingPoint, setMeetingPoint] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !time) {
      setError("Please choose a date and time.");
      return;
    }
    if (!meetingPoint.trim()) {
      setError("Please enter a meeting point.");
      return;
    }
    if (!hasEnoughNotice(date, time)) {
      setError("Please choose a time at least 12 hours from now, so CHS and the owner have time to confirm.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const { error: insertError } = await supabase.from("inspections").insert({
      reference: generateReference(),
      property_id: propertyId,
      requester_id: session.user.id,
      requested_date: date,
      requested_time: time,
      meeting_point: meetingPoint.trim(),
    });

    if (insertError) {
      // The database's own 12-hour rule is the final, authoritative
      // safety net — if it ever rejects something the check above
      // missed, this surfaces that honestly rather than silently fail.
      setError(
        insertError.message.includes("min_12_hours_notice")
          ? "Please choose a time at least 12 hours from now."
          : "Could not book this inspection. Please try again."
      );
      setSubmitting(false);
      return;
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-gray-600">Preferred date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Preferred time</label>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Meeting point</label>
        <input
          type="text"
          value={meetingPoint}
          onChange={(e) => setMeetingPoint(e.target.value)}
          placeholder="e.g. Main gate of the estate"
          className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
        />
      </div>
      {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50"
      >
        {submitting ? "Booking..." : "Book inspection"}
      </button>
    </form>
  );
}
