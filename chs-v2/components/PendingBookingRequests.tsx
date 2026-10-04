"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import HostBookingDecision from "@/components/HostBookingDecision";
import { durationText } from "@/lib/bookingLane";

// The one place an owner or host sees PAID booking requests that are waiting
// for their answer — shown at the very top of both the Owner and the Host
// dashboards.
//
// Why it exists: a guest (Philips Edward) paid for a hotel room; admin could
// see it, and the owner received a notification saying "review and accept or
// decline" — but the owner dashboard only loaded bookings that were already
// confirmed or active, so the request appeared nowhere. The only Accept/Decline
// buttons lived on a different dashboard the owner had no reason to open.
//
// A request is open for 24 hours. After that it expires and the guest is
// refunded in full automatically, so the countdown is shown plainly.

interface Req {
  id: string;
  property_title: string;
  guest_full_name: string;
  guest_phone: string;
  guest_verified: boolean;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number | null;
  total_price: number;
  host_commission_amount: number;
  net_if_accepted: number;
  created_at: string;
  expires_at: string | null;
  room_label: string | null;
  room_type_name: string | null;
  wants_music_band: boolean | null;
  wants_caterer: boolean | null;
  wants_ushers: boolean | null;
  number_of_ushers: number | null;
  additional_event_requests: string | null;
  event_type: string | null;
  selected_tier_label: string | null;
  facilities_total: number | null;
  is_paid: boolean;
  booking_lane: string | null;
  expected_arrival_time: string | null;
  pay_minutes: number | null;
}

function timeLeft(expiresAt: string | null): { text: string; urgent: boolean } | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { text: "Expiring now", urgent: true };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return { text: h > 0 ? `${h}h ${m}m left to answer` : `${m} minutes left to answer`, urgent: ms < 3 * 3600000 };
}

export default function PendingBookingRequests() {
  const [requests, setRequests] = useState<Req[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_booking_requests");
    if (!error) setRequests((data as Req[]) || []);
  }, []);

  useEffect(() => {
    // load() only sets state after its network call returns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Keep the countdowns honest, and notice requests that arrive or expire.
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  if (requests.length === 0) return null;

  return (
    <div id="booking-requests" className="px-4 pt-4">
      <div className="bg-chs-amber-light border-2 border-chs-red rounded-xl p-3">
        <p className="text-sm font-bold text-chs-red">
          🔔 {requests.length} booking request{requests.length !== 1 ? "s" : ""} awaiting your decision
        </p>
        <p className="text-[11px] text-gray-600 mt-0.5 mb-2">
          {requests.some((r) => !r.is_paid)
            ? "Confirm that the dates are free. The guest has not paid yet — they pay once you confirm, and the money reaches you only after the stay. Answer before the deadline or the request lapses (nothing is charged)."
            : "Each guest has already paid — the money is held safely in escrow and reaches you only after the stay. Answer before the deadline, or the request expires and the guest is refunded in full."}
          {requests.some((r) => r.is_paid) && requests.some((r) => !r.is_paid) ? " Requests marked “paid” were paid when sent, under the older order; the rest are unpaid." : ""}
        </p>

        {requests.map((r) => {
          const left = timeLeft(r.expires_at);
          const hasExtras = r.wants_music_band || r.wants_caterer || r.wants_ushers || r.additional_event_requests;
          return (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
              <p className="text-sm font-semibold text-chs-charcoal">{r.property_title}</p>
              {(r.room_type_name || (r.room_label && r.room_label !== "Whole property")) && (
                <p className="text-[11px] text-gray-500">
                  {[r.room_type_name, r.room_label && r.room_label !== "Whole property" ? `room ${r.room_label}` : null].filter(Boolean).join(" · ")}
                </p>
              )}
              {r.selected_tier_label && <p className="text-[11px] text-gray-500">{r.event_type ? `${r.event_type} · ` : ""}{r.selected_tier_label}</p>}

              {r.booking_lane && r.booking_lane !== "standard" && (
                <p className={`text-[10px] font-bold mt-1 ${r.booking_lane === "express" ? "text-chs-red" : "text-amber-700"}`}>
                  {r.booking_lane === "express" ? "⚡ EXPRESS — guest arrives today" : "🕒 Guest arrives soon"}
                  {r.expected_arrival_time ? ` · expected about ${r.expected_arrival_time}` : ""}
                </p>
              )}
              {r.booking_lane === "standard" && r.expected_arrival_time && <p className="text-[10px] text-gray-500 mt-1">Expected arrival about {r.expected_arrival_time}</p>}
              <p className="text-xs text-chs-charcoal mt-1.5">
                {r.guest_full_name} · {r.guest_phone}
                {r.guest_verified && <span className="ml-1.5 text-[10px] font-semibold text-green-700">✓ identity verified by CHS</span>}
              </p>
              <p className="text-[11px] text-gray-500">
                {r.check_in} → {r.check_out} · {r.nights} night{r.nights !== 1 ? "s" : ""}{r.guests ? ` · ${r.guests} guest${r.guests !== 1 ? "s" : ""}` : ""}
              </p>
              <p className="text-[11px] text-gray-700 mt-1">
                You receive <b>{formatNaira(r.net_if_accepted)}</b> {r.is_paid ? "if you accept" : "after the stay, once the guest has paid"}
                <span className="text-gray-400"> (booking {formatNaira(r.total_price)} less CHS commission {formatNaira(r.host_commission_amount)})</span>
              </p>

              {hasExtras && (
                <div className="bg-gray-50 rounded-lg px-2 py-1.5 mt-1.5">
                  <p className="text-[9px] font-bold text-chs-charcoal uppercase mb-0.5">🎉 Event-day requests</p>
                  {r.wants_music_band && <p className="text-[10px] text-gray-700">🎵 Music band / live entertainment</p>}
                  {r.wants_caterer && <p className="text-[10px] text-gray-700">🍽️ Caterer</p>}
                  {r.wants_ushers && <p className="text-[10px] text-gray-700">🙋 {r.number_of_ushers || "?"} usher(s)</p>}
                  {r.additional_event_requests && <p className="text-[10px] text-gray-600 italic mt-0.5">&quot;{r.additional_event_requests}&quot;</p>}
                </div>
              )}

              {left && (
                <p className={`text-[11px] font-semibold mt-1.5 ${left.urgent ? "text-chs-red" : "text-amber-700"}`}>
                  ⏳ {left.text}{r.expires_at ? ` (by ${new Date(r.expires_at).toLocaleString()})` : ""}
                </p>
              )}

              {!r.is_paid && r.pay_minutes ? (
                <p className="text-[10px] text-gray-500 mt-1.5">When you confirm, the guest has {durationText(r.pay_minutes)} to pay; if they don&apos;t, the dates reopen automatically.</p>
              ) : null}
              <HostBookingDecision bookingId={r.id} onDecided={load} unpaid={!r.is_paid} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
