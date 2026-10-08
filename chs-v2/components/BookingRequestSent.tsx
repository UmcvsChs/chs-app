"use client";

import Link from "next/link";
import { formatNaira } from "@/lib/format";
import { BookingRequestResult, durationText } from "@/lib/bookingLane";

// What the guest sees right after sending a booking request. It must say what
// actually happened: a REQUEST was sent, nothing was charged, and what comes
// next. (This used to read "Booking confirmed — your dates are secured", which
// was never true of a request.)
export default function BookingRequestSent({ result }: { result: BookingRequestResult | null }) {
  if (result?.instant) {
    return (
      <div className="bg-white rounded-xl border border-green-200 p-4">
        <p className="text-sm font-semibold text-green-800 mb-1">⚡ Booking confirmed</p>
        <p className="text-xs text-gray-600">You paid <b>{formatNaira(result.total_to_pay)}</b> from your CHS wallet and your room is secured. CHS holds the money safely. The host is paid only after you arrive and confirm.</p>
        <p className="text-xs text-gray-600 mt-1.5">Your arrival pass is waiting in My Bookings. Show it at the front desk when you arrive.</p>
        <Link href="/my-bookings" className="inline-block mt-3 text-xs font-semibold text-chs-red underline">Open My Bookings →</Link>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      {result?.express_asked && result.express_asked > 1 && (
        <p className="text-xs font-semibold text-chs-red mb-1.5">⚡ Express: we asked {result.express_asked} hotels at once. The first to confirm wins and the others cancel on their own.</p>
      )}
      <p className="text-sm font-semibold text-chs-charcoal mb-1">✓ Request sent — nothing has been charged</p>
      {result ? (
        <>
          <p className="text-xs text-gray-600">
            {result.status === "awaiting_admin_relay"
              ? <>CHS will pass your request to the host shortly (within {durationText(result.relay_minutes ?? 0)}). The host then has {durationText(result.host_minutes)} to reply.</>
              : <>Your request is with the host, who has {durationText(result.host_minutes)} to reply.</>}
          </p>
          <p className="text-xs text-gray-600 mt-1.5">
            If they confirm, you will have <b>{durationText(result.pay_minutes)}</b> to pay <b>{formatNaira(result.total_to_pay)}</b> to secure your stay. If they can&apos;t take you, you pay nothing.
          </p>
          {result.lane !== "standard" && (
            <p className="text-xs text-chs-red font-semibold mt-1.5">
              {result.lane === "express" ? "⚡ Express" : "🕒 Soon"}: keep notifications on — you&apos;ll be told the moment the host answers, and the clock to pay starts then.
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-gray-600">The host will confirm the dates, and you pay only after they do.</p>
      )}
      <Link href="/my-bookings" className="inline-block mt-3 text-xs font-semibold text-chs-red underline">Track it in My Bookings →</Link>
    </div>
  );
}
