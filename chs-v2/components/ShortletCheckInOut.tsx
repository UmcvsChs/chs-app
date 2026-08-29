"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Report {
  id: string;
  report_type: string;
  rooms: Record<string, string>;
  status: string;
  tenant_confirmed: boolean;
  submitted_at: string;
}

// The real, direct fix for the single biggest shortlet dispute
// category — "the place wasn't as described" / "the guest damaged
// something." Reuses the exact Property Condition Report evidence
// mechanism already trusted for long-term tenancies.
export function HostShortletCheckInOut({ bookingId, propertyTitle }: { bookingId: string; propertyTitle: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [showForm, setShowForm] = useState<"check_in" | "check_out" | null>(null);
  const [rooms, setRooms] = useState<Record<string, string>>({ "Living area": "", "Bedroom": "", "Kitchen": "", "Bathroom": "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  async function loadReports() {
    const { data } = await supabase
      .from("condition_reports")
      .select("id, report_type, rooms, status, tenant_confirmed, submitted_at")
      .eq("shortlet_booking_id", bookingId)
      .order("submitted_at", { ascending: false });
    setReports((data as unknown as Report[]) || []);
  }

  async function handleSubmit(type: "check_in" | "check_out") {
    setSubmitting(true);
    setMessage(null);
    const { error } = await supabase.rpc("submit_shortlet_condition_report", {
      p_booking_id: bookingId,
      p_report_type: type,
      p_rooms: rooms,
    });
    setSubmitting(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`✓ ${type === "check_in" ? "Check-in" : "Check-out"} report submitted — awaiting guest confirmation.`);
    setShowForm(null);
    setRooms({ "Living area": "", "Bedroom": "", "Kitchen": "", "Bathroom": "" });
    loadReports();
  }

  const hasCheckIn = reports.some((r) => r.report_type === "check_in");
  const hasCheckOut = reports.some((r) => r.report_type === "check_out");

  return (
    <div className="mt-2 bg-white rounded-xl border border-gray-100 p-3">
      <p className="text-xs font-bold text-chs-charcoal mb-1.5">📋 Digital Check-In / Check-Out — {propertyTitle}</p>
      {message && <p className="text-[10px] text-gray-600 mb-2">{message}</p>}

      {reports.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {reports.map((r) => (
            <div key={r.id} className="flex justify-between items-center text-[11px] border-b border-gray-100 pb-1">
              <span className="text-gray-600">{r.report_type === "check_in" ? "Check-in report" : "Check-out report"}</span>
              <span className={`font-bold uppercase text-[9px] px-1.5 py-0.5 rounded-full ${
                r.status === "approved" ? "text-green-700 bg-green-50" : "text-chs-amber-dark bg-chs-amber-light"
              }`}>
                {r.status === "approved" ? "✓ Confirmed by guest" : "Awaiting guest"}
              </span>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="space-y-1.5">
          {Object.keys(rooms).map((room) => (
            <div key={room}>
              <label className="text-[10px] font-semibold text-gray-500">{room}</label>
              <input type="text" value={rooms[room]} onChange={(e) => setRooms({ ...rooms, [room]: e.target.value })}
                placeholder="Real condition — e.g. clean, no damage"
                className="w-full mt-0.5 px-2 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
            </div>
          ))}
          <div className="flex gap-2 mt-1">
            <button onClick={() => setShowForm(null)} className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
              Cancel
            </button>
            <button onClick={() => handleSubmit(showForm)} disabled={submitting}
              className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
              {submitting ? "Submitting..." : "Submit report"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => setShowForm("check_in")} disabled={hasCheckIn}
            className="flex-1 py-1.5 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-40">
            {hasCheckIn ? "✓ Check-in done" : "Submit check-in report"}
          </button>
          <button onClick={() => setShowForm("check_out")} disabled={hasCheckOut}
            className="flex-1 py-1.5 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-40">
            {hasCheckOut ? "✓ Check-out done" : "Submit check-out report"}
          </button>
        </div>
      )}
    </div>
  );
}

// The real guest-side counterpart — confirming the host's real
// condition report is what actually makes it count as evidence,
// exactly like the tenancy version already trusted.
export function GuestShortletConfirmation({ bookingId }: { bookingId: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  async function loadReports() {
    const { data } = await supabase
      .from("condition_reports")
      .select("id, report_type, rooms, status, tenant_confirmed, submitted_at")
      .eq("shortlet_booking_id", bookingId)
      .order("submitted_at", { ascending: false });
    setReports((data as unknown as Report[]) || []);
  }

  async function handleConfirm(reportId: string) {
    setConfirmingId(reportId);
    setMessage(null);
    const { error } = await supabase.rpc("confirm_shortlet_condition_report", { p_report_id: reportId });
    setConfirmingId(null);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("✓ Confirmed.");
    loadReports();
  }

  if (reports.length === 0) return null;

  return (
    <div className="mt-2 bg-white rounded-xl border border-gray-100 p-3">
      <p className="text-xs font-bold text-chs-charcoal mb-1.5">📋 Property Condition Reports</p>
      {message && <p className="text-[10px] text-gray-600 mb-2">{message}</p>}
      <div className="space-y-2">
        {reports.map((r) => (
          <div key={r.id} className="border-b border-gray-100 pb-2">
            <p className="text-[11px] font-semibold text-chs-charcoal mb-1">
              {r.report_type === "check_in" ? "Check-in report" : "Check-out report"}
            </p>
            {Object.entries(r.rooms || {}).map(([room, note]) => (
              note ? <p key={room} className="text-[10px] text-gray-500">{room}: {note}</p> : null
            ))}
            {r.status === "approved" ? (
              <p className="text-[10px] text-green-700 font-semibold mt-1">✓ You confirmed this report</p>
            ) : (
              <button onClick={() => handleConfirm(r.id)} disabled={confirmingId === r.id}
                className="mt-1.5 px-3 py-1 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
                {confirmingId === r.id ? "Confirming..." : "This matches — confirm"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
