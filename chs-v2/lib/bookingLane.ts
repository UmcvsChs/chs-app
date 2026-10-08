import { formatNaira } from "@/lib/format";

// The booking flow is request-first: the guest sends a REQUEST (nothing is
// charged), CHS relays it to the host, the host confirms the dates are free,
// and only then does the guest pay, within a short window. How long each
// step may take depends on how soon the guest arrives — see the three lanes.
// The numbers always come from the server (booking_lane_info); nothing here
// is hard-coded.

export interface LaneInfo {
  lane: "standard" | "soon" | "express";
  days_until: number;
  manual_relay: boolean;
  relay_minutes: number;
  host_minutes: number;
  pay_minutes: number;
}

// What request_shortlet_booking / request_event_booking return.
export interface BookingRequestResult {
  booking_id: string;
  status: "awaiting_admin_relay" | "pending_host_review" | "confirmed";
  lane: "standard" | "soon" | "express" | "instant";
  relay_minutes: number | null;
  host_minutes: number;
  pay_minutes: number;
  total_to_pay: number;
  // Instant Confirm: the booking was confirmed and paid in one step.
  instant?: boolean;
  // Express: how many hotels were asked at once (1 to 3).
  express_asked?: number;
}

export function durationText(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

const TECHNICAL = /violates|constraint|function |column|syntax|permission denied|relation |duplicate key|null value/i;

// Turns whatever the server said into something a guest can act on. The
// server's own plain-English messages (arrival time needed, check-in in the
// past, room type unavailable…) are passed through; technical ones are not.
export function friendlyBookingError(
  message: string | undefined,
  ctx: { lane?: string; total?: number } = {},
  fallback = "Could not send your request. Please try again."
): string {
  const m = message || "";
  if (m.includes("insufficient_balance")) {
    const urgent = ctx.lane === "soon" || ctx.lane === "express";
    return urgent
      ? `For a stay this soon, your wallet must already hold ${ctx.total ? formatNaira(ctx.total) : "the full amount"} when you send the request — so a host is never asked to hold a room for someone who can't pay. Please top up your wallet, then send the request again.`
      : "Your wallet does not hold enough for this booking. Please top up your wallet first.";
  }
  if (m.includes("dates_unavailable")) {
    return "Those dates are no longer available — another guest has them booked or is holding them while the host replies. You have not been charged. Please choose different dates.";
  }
  if (m.includes("exclude") || m.includes("23P01")) {
    return "Someone just booked those dates. Please choose a different range.";
  }
  if (m && !TECHNICAL.test(m)) return m;
  return fallback;
}
