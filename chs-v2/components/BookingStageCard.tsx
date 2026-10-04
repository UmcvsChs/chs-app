"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import CancelBookingButton from "@/components/CancelBookingButton";

// Where a guest's booking stands, in plain words, with a live countdown — and,
// when the host has confirmed the dates, the PAY button.
//
// Booking order: request (nothing charged) -> CHS relays to the host -> host
// confirms the dates are free -> guest pays within a short window -> confirmed.
// Used on both guest screens (My Bookings and the Guest dashboard) so a guest
// is never left guessing, or missing the window to pay.

export interface StageBooking {
  id: string;
  status: string;
  payment_status: string | null;
  hold_expires_at: string | null;
  booking_lane: string | null;
  expected_arrival_time: string | null;
  total_price: number;
  guest_commission_amount: number | null;
  security_deposit_amount: number | null;
  check_in: string;
  check_out: string;
}

const IN_FLIGHT = ["awaiting_admin_relay", "pending_host_review", "awaiting_payment"];

function countdown(expiresAt: string | null, now: number): { text: string; over: boolean; urgent: boolean } | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return { text: "time is up", over: true, urgent: true };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return { text: h > 0 ? `${h}h ${m}m` : `${Math.max(1, m)} min`, over: false, urgent: ms < 30 * 60000 };
}

export default function BookingStageCard({ booking: b, onChanged }: { booking: StageBooking; onChanged: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshed = useRef(false);

  const inFlight = IN_FLIGHT.includes(b.status);
  const paidAtRequest = b.payment_status === "held_escrow";   // an older pay-first request
  const due = b.total_price + (b.guest_commission_amount || 0) + (b.security_deposit_amount || 0);
  const left = inFlight ? countdown(b.hold_expires_at, now) : null;

  useEffect(() => {
    if (!inFlight) return;
    const timer = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(timer);
  }, [inFlight]);

  // When a deadline passes, reload once so the guest sees what became of it.
  useEffect(() => {
    if (left?.over && !refreshed.current) {
      refreshed.current = true;
      const t = setTimeout(onChanged, 4000);
      return () => clearTimeout(t);
    }
  }, [left?.over, onChanged]);

  async function pay() {
    setPaying(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("pay_for_booking", { p_booking_id: b.id });
    setPaying(false);
    if (rpcError) {
      setError(
        rpcError.message.includes("insufficient_balance")
          ? `Your wallet does not hold ${formatNaira(due)}. Top up your wallet, then come back to pay — your dates stay held until the time runs out.`
          : rpcError.message
      );
      return;
    }
    if (data?.status === "expired") {
      setError(data.message || "The payment window has passed, so the dates were released and nothing was charged.");
    }
    onChanged();
  }

  const chip = (label: string, tone: "amber" | "green" | "red" | "grey") => {
    const cls = { amber: "text-chs-red bg-chs-amber-light", green: "text-green-700 bg-green-50", red: "text-chs-red bg-red-50", grey: "text-gray-500 bg-gray-100" }[tone];
    return <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full inline-block mt-1 ${cls}`}>{label}</span>;
  };

  return (
    <div className="mt-1">
      {b.status === "awaiting_admin_relay" && (
        <>
          {chip("📨 With CHS", "amber")}
          <p className="text-[11px] text-gray-600 mt-1">CHS is passing your request to the host. <b>Nothing has been charged.</b>{left && !left.over ? ` Expected within ${left.text}.` : ""}</p>
        </>
      )}

      {b.status === "pending_host_review" && !paidAtRequest && (
        <>
          {chip("⏳ With the host", "amber")}
          <p className="text-[11px] text-gray-600 mt-1">
            The host is checking that these dates are free. You&apos;ll be asked to pay only after they confirm — <b>nothing has been charged.</b>
            {left && !left.over ? ` They have ${left.text} left to reply.` : ""}
          </p>
        </>
      )}

      {b.status === "pending_host_review" && paidAtRequest && (
        <>
          {chip("⏳ Awaiting host decision", "amber")}
          <p className="text-[11px] text-gray-600 mt-1">Your payment of {formatNaira(due)} is held safely. If the host declines or doesn&apos;t answer in time, you are refunded in full automatically.</p>
        </>
      )}

      {b.status === "awaiting_payment" && (
        <div className="mt-1.5 bg-green-50 border border-green-200 rounded-lg p-2.5">
          {chip("✅ Host confirmed — pay now", "green")}
          <p className="text-xs text-chs-charcoal mt-1">
            The host has confirmed your dates. Pay <b>{formatNaira(due)}</b> to secure them
            {left && !left.over ? <> — <span className={left.urgent ? "font-bold text-chs-red" : "font-semibold"}>{left.text} left</span></> : ""}.
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {formatNaira(b.total_price)} stay + {formatNaira(b.guest_commission_amount || 0)} CHS service fee
            {(b.security_deposit_amount || 0) > 0 ? ` + ${formatNaira(b.security_deposit_amount || 0)} refundable deposit` : ""}. Held safely by CHS; the host is paid only after your stay.
          </p>
          {error && (
            <p className="text-[11px] text-chs-red mt-1.5">
              {error} {error.includes("wallet") && <Link href="/wallet" className="font-semibold underline">Top up →</Link>}
            </p>
          )}
          <button onClick={pay} disabled={paying || !!left?.over}
            className="w-full mt-2 py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
            {paying ? "Paying…" : left?.over ? "Time is up" : `Pay ${formatNaira(due)} now`}
          </button>
        </div>
      )}

      {b.status === "confirmed" && chip(b.payment_status === "released" ? "✓ Stay completed — host paid" : "✓ Confirmed & paid", "green")}
      {b.status === "declined" && (
        <>
          {chip("Not accepted", "red")}
          <p className="text-[11px] text-gray-600 mt-1">{b.payment_status === "refunded" ? "You were refunded in full." : "Nothing was charged."}</p>
        </>
      )}
      {b.status === "expired" && (
        <>
          {chip("Expired", "grey")}
          <p className="text-[11px] text-gray-600 mt-1">The time to answer or pay ran out. <b>Nothing was charged</b> and the dates were released. You&apos;re welcome to send a new request.</p>
        </>
      )}
      {b.status === "cancelled" && chip("Cancelled", "grey")}

      {b.expected_arrival_time && inFlight && <p className="text-[10px] text-gray-400 mt-1">Your expected arrival: {b.expected_arrival_time}</p>}

      {inFlight && !paidAtRequest && (
        <CancelBookingButton bookingId={b.id} mode="withdraw" onCancelled={onChanged} />
      )}
      {(b.status === "confirmed" || (b.status === "pending_host_review" && paidAtRequest)) && (
        <CancelBookingButton bookingId={b.id} onCancelled={onChanged} />
      )}
    </div>
  );
}
