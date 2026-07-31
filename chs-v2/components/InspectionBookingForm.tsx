"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { calcInspectionFee, AREA_MEETING_POINTS, CHS_OFFICE } from "@/lib/inspectionFee";
import { formatNaira } from "@/lib/format";

interface InspectionBookingFormProps {
  propertyId: string;
  propertyLocation: string;
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
  propertyLocation,
  session,
  onSuccess,
}: InspectionBookingFormProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [meetingPoint, setMeetingPoint] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The real, distance-based fee — restored exactly from the original
  // app: CHS Office at Leventis Roundabout as the fixed reference
  // point, calculated the moment the property's real location is
  // known, genuinely fair and split evenly, not an arbitrary flat fee.
  const fee = calcInspectionFee(propertyLocation);
  const suggestedMeetingPoints = fee.areaKey ? AREA_MEETING_POINTS[fee.areaKey] || [] : [];

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
      transport_fee: fee.perPersonFee,
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
      <div className="bg-chs-amber-light rounded-lg px-3 py-2.5">
        <p className="text-[10px] font-bold text-chs-amber-dark uppercase mb-1">🚗 Transport fee — calculated by distance</p>
        <p className="text-xs text-chs-amber-dark">
          ~{fee.distanceKm}km from {CHS_OFFICE} — {formatNaira(fee.totalFee)} round trip, split evenly.
        </p>
        <p className="text-sm font-bold text-chs-amber-dark mt-1">Your share: {formatNaira(fee.perPersonFee)}</p>
      </div>

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
        {suggestedMeetingPoints.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1 mb-1.5">
            {suggestedMeetingPoints.map((point) => (
              <button
                key={point}
                type="button"
                onClick={() => setMeetingPoint(point)}
                className={`text-[10px] px-2 py-1 rounded-full border ${
                  meetingPoint === point ? "bg-chs-red text-white border-chs-red" : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                {point}
              </button>
            ))}
          </div>
        )}
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
