"use client";

import { formatNaira } from "@/lib/format";
import { LaneInfo, durationText } from "@/lib/bookingLane";

// Shown on the booking forms once dates are chosen: says plainly that sending
// the form charges nothing, and what happens next and how long each step has.
// (It replaces older wording that described money being held at request time.)
export default function BookingFlowNotice({ info, total }: { info: LaneInfo | null; total: number }) {
  if (!info) return null;
  const urgent = info.lane !== "standard";
  return (
    <div className="bg-chs-amber-light rounded-lg p-3">
      <p className="text-xs font-bold text-chs-red">📨 Send a request — nothing is charged now</p>
      <ol className="text-[11px] text-gray-600 mt-1.5 space-y-1 list-decimal pl-4">
        <li>
          {info.manual_relay
            ? <>CHS passes your request to the host (within {durationText(info.relay_minutes)}).</>
            : <>Your request goes straight to the host.</>}
        </li>
        <li>The host confirms the dates are free — they have {durationText(info.host_minutes)} to reply.</li>
        <li>
          Then you pay <b>{formatNaira(total)}</b> within {durationText(info.pay_minutes)} to secure your stay. Until you pay, no money leaves your wallet — and if the host can&apos;t take you, you pay nothing.
        </li>
      </ol>
      {urgent && (
        <p className="text-[11px] text-chs-red font-semibold mt-2">
          {info.lane === "express" ? "⚡ Same-day booking" : "🕒 Your stay starts soon"}: your wallet must already hold {formatNaira(total)} when you send this request, so a host is never asked to hold a room for someone who can&apos;t pay.
        </p>
      )}
    </div>
  );
}
