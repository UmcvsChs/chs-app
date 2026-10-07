"use client";

import PaymentSafetyNotice from "@/components/PaymentSafetyNotice";
import { Req, Opt, RequiredLegend } from "@/components/FormMarks";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { calcInspectionFee, AREA_MEETING_POINTS } from "@/lib/inspectionFee";
import { formatNaira } from "@/lib/format";
import InfoTip from "./InfoTip";

interface InspectionBookingFormProps {
  propertyId: string;
  propertyLocation: string;
  session: Session;
  hasRoomVideos: boolean;
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
// Real, reliable conversion — a native browser time input's AM/PM
// display depends on the device's own locale settings, which is
// exactly why it looked inconsistent across devices; this custom
// picker produces the same real 24-hour value every time, regardless
// of device or browser.
function to24Hour(hour12: string, minute: string, ampm: "AM" | "PM"): string {
  let h = parseInt(hour12, 10);
  if (ampm === "AM" && h === 12) h = 0;
  if (ampm === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

function hasEnoughNotice(date: string, time24: string): boolean {
  if (!date || !time24) return false;
  const requested = new Date(`${date}T${time24}`);
  const minimumAllowed = new Date(Date.now() + 12 * 60 * 60 * 1000);
  return requested >= minimumAllowed;
}

export default function InspectionBookingForm({
  propertyId,
  propertyLocation,
  session,
  hasRoomVideos,
  onSuccess,
}: InspectionBookingFormProps) {
  const [date, setDate] = useState("");
  const [hour12, setHour12] = useState("9");
  const [minute, setMinute] = useState("00");
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");
  const [meetingPoint, setMeetingPoint] = useState("");
  const [timeline, setTimeline] = useState("ready_now");
  const [fundsReady, setFundsReady] = useState(true);
  const [decisionMaker, setDecisionMaker] = useState(true);
  // Real, direct client request: acknowledge the free room-video
  // alternative before booking a paid physical visit, when it exists.
  const [videosAcknowledged, setVideosAcknowledged] = useState(false);
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
    const time24 = to24Hour(hour12, minute, ampm);
    if (!date) {
      setError("Please choose a date.");
      return;
    }
    if (!meetingPoint.trim()) {
      setError("Please enter a meeting point.");
      return;
    }
    if (!hasEnoughNotice(date, time24)) {
      setError("Please choose a time at least 12 hours from now, so CHS and the owner have time to confirm.");
      return;
    }
    if (!videosAcknowledged) {
      setError("Please confirm you understand that the full transport cost is yours before booking a physical visit.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const { data: newInspection, error: insertError } = await supabase.from("inspections").insert({
      reference: generateReference(),
      property_id: propertyId,
      requester_id: session.user.id,
      requested_date: date,
      requested_time: time24,
      meeting_point: meetingPoint.trim(),
      transport_fee: fee.known ? fee.totalFee : null,
      status: "pending",
    }).select().single();

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

    // The real readiness questionnaire — see
    // backend-v2/56_buyer_readiness_score.sql. Doesn't block or delay
    // the booking itself; the score it feeds is only ever shown to the
    // property owner deciding how to prioritize their time, never used
    // to gate anyone.
    if (newInspection) {
      await supabase.rpc("submit_readiness_response", {
        p_request_type: "inspection",
        p_request_id: newInspection.id,
        p_timeline: timeline,
        p_funds_ready: fundsReady,
        p_decision_maker: decisionMaker,
      });
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="bg-chs-charcoal rounded-lg px-3 py-2.5">
        <p className="text-xs font-bold text-white">{hasRoomVideos ? "🎥 Real room videos are available — watch them first (free)" : "📷 See the property first — it costs nothing"}</p>
        <p className="text-[11px] text-white/70 mt-0.5">
          The photographs{hasRoomVideos ? " and videos" : ""} on this page are there so you can see the property without travelling, and you can ask the owner for more photos or a video, free of charge. A physical visit is only for when you are still not satisfied.
        </p>
        <label className="flex items-start gap-2 mt-2 text-[11px] text-white/90">
          <input type="checkbox" checked={videosAcknowledged} onChange={(e) => setVideosAcknowledged(e.target.checked)} className="mt-0.5" />
          <span>I have looked at what is online and I still choose to visit in person. I understand that the <b>full transport and logistics cost shown below is 100% mine</b> — the owner and CHS pay none of it. <Req /></span>
        </label>
      </div>

      <PaymentSafetyNotice variant="compact" />
      <div className="bg-chs-amber-light rounded-lg px-3 py-2.5">
        <p className="text-[10px] font-bold text-chs-amber-dark uppercase mb-1">🚗 Transport cost — calculated by distance<InfoTip term="inspection_booking_transport_fee" /></p>
        {fee.known ? (
          <>
            <p className="text-xs text-chs-amber-dark">
              About {fee.distanceKm} km each way, at ₦150 per km, there and back. It is worked out from where your CHS agent actually sets off to the property — so this is an estimate until your agent is assigned, when CHS confirms the final amount and tells you before the visit.
            </p>
            <p className="text-sm font-bold text-chs-amber-dark mt-1">Your transport cost: {formatNaira(fee.totalFee as number)} <span className="text-[10px] font-normal">(estimate · you pay 100%)</span></p>
            <p className="text-[10px] text-chs-amber-dark mt-1"><b>Nothing is taken now.</b> Once CHS confirms your agent and the final cost, you pay it from your CHS Wallet (My Inspections).</p>
          </>
        ) : (
          <p className="text-xs text-chs-amber-dark">
            CHS will quote the exact transport cost for this area, from where your agent sets off to the property and back, before the visit is confirmed. You bear <b>100%</b> of it — the owner and CHS pay none. <b>Nothing is taken now</b>; you pay from your CHS Wallet once it is quoted.
          </p>
        )}
      </div>

      <div>
        <RequiredLegend className="mb-1.5" />
        <label className="text-xs font-semibold text-gray-600">Preferred date <Req /></label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Preferred time <Req /></label>
        <div className="flex gap-2 mt-1">
          <select value={hour12} onChange={(e) => setHour12(e.target.value)}
            className="flex-1 px-2 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <select value={minute} onChange={(e) => setMinute(e.target.value)}
            className="flex-1 px-2 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
            {["00", "15", "30", "45"].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={ampm} onChange={(e) => setAmpm(e.target.value as "AM" | "PM")}
            className="flex-1 px-2 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Meeting point <Req /></label>
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

      <div className="bg-[var(--zone-card)] rounded-lg p-3 space-y-2.5">
        <p className="text-[10px] font-bold text-gray-500 uppercase">
          A few quick questions — helps the owner prioritize real, ready buyers and tenants
        </p>
        <div>
          <label className="text-xs font-semibold text-gray-600">When are you looking to move / finalize? <Opt /></label>
          <select value={timeline} onChange={(e) => setTimeline(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
            <option value="ready_now">Ready now</option>
            <option value="one_to_three_months">1–3 months</option>
            <option value="three_to_six_months">3–6 months</option>
            <option value="just_exploring">Just exploring for now</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={fundsReady} onChange={(e) => setFundsReady(e.target.checked)} />
          My deposit / funds are ready now <Opt />
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={decisionMaker} onChange={(e) => setDecisionMaker(e.target.checked)} />
          I&apos;m the one making this decision (not exploring on someone else&apos;s behalf) <Opt />
        </label>
      </div>

      {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !videosAcknowledged}
        className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50"
      >
        {submitting ? "Booking..." : "Book inspection"}
      </button>
    </form>
  );
}
