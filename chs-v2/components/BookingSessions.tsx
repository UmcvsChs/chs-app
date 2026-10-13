"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BookedSession, fmtDay, fmtTime } from "@/lib/eventSessions";

// The dated sessions of an event booking (for example Friday 4 pm to 7 pm and Saturday 10 am to 5 pm).
// Shows nothing for bookings that are not made of sessions.
export default function BookingSessions({ bookingId, compact = false }: { bookingId: string; compact?: boolean }) {
  const [rows, setRows] = useState<BookedSession[] | null>(null);
  useEffect(() => {
    supabase.rpc("get_booking_sessions", { p_booking: bookingId }).then(({ data }) => setRows((data as BookedSession[]) || []));
  }, [bookingId]);
  if (!rows || rows.length === 0) return null;
  return (
    <div className={compact ? "mt-1" : "mt-1.5 rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-1.5"}>
      <p className="text-[10px] font-bold text-chs-charcoal">🕒 {rows.length === 1 ? "Event time" : `${rows.length} sessions`}</p>
      {rows.map((r) => (
        <p key={r.id} className="text-[11px] text-gray-600">{fmtDay(r.date)} · {fmtTime(r.start)} to {fmtTime(r.end)}{r.label ? ` · ${r.label}` : ""}</p>
      ))}
    </div>
  );
}
