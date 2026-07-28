"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { ShortletBooking } from "@/types/shortletBooking";
import { formatNaira } from "@/lib/format";

interface ShortletBookingFormProps {
  propertyId: string;
  pricePerNight: number;
  session: Session;
  onSuccess: () => void;
}

// Genuinely checks the two date ranges for overlap client-side first —
// this is a helpful, fast, upfront check, but NOT the real protection.
// The real protection is the database's own exclusion constraint, which
// this client-side check can never fully replace (a race condition
// between two nearly-simultaneous bookings is only truly prevented at
// the database level).
function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return new Date(startA) < new Date(endB) && new Date(startB) < new Date(endA);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export default function ShortletBookingForm({
  propertyId,
  pricePerNight,
  session,
  onSuccess,
}: ShortletBookingFormProps) {
  const [existingBookings, setExistingBookings] = useState<ShortletBooking[]>([]);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(true);

  useEffect(() => {
    loadExistingBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadExistingBookings() {
    const { data } = await supabase
      .from("shortlet_bookings")
      .select("*")
      .eq("property_id", propertyId)
      .eq("status", "confirmed");
    setExistingBookings(data || []);
    setLoadingAvailability(false);
  }

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const totalPrice = nights > 0 ? nights * pricePerNight : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkIn || !checkOut) {
      setError("Please choose your check-in and check-out dates.");
      return;
    }
    if (nights <= 0) {
      setError("Check-out must be after check-in.");
      return;
    }

    // The helpful, fast, upfront check — catches the obvious case
    // immediately, before ever reaching the server.
    const hasClientSideConflict = existingBookings.some((b) =>
      rangesOverlap(checkIn, checkOut, b.check_in, b.check_out)
    );
    if (hasClientSideConflict) {
      setError("Those dates are already booked. Please choose a different range.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const { error: insertError } = await supabase.from("shortlet_bookings").insert({
      property_id: propertyId,
      guest_id: session.user.id,
      check_in: checkIn,
      check_out: checkOut,
      total_price: totalPrice,
    });

    if (insertError) {
      // The real protection catching what the client-side check might
      // have missed — genuinely possible if someone else's booking was
      // confirmed in the brief moment between this page loading and this
      // submission. The database's exclusion constraint rejects this
      // with a specific, recognisable error, surfaced here honestly
      // rather than a raw technical message.
      if (insertError.message.includes("exclude") || insertError.code === "23P01") {
        setError("Someone just booked those dates. Please choose a different range.");
      } else {
        setError("Could not complete this booking. Please try again.");
      }
      setSubmitting(false);
      loadExistingBookings(); // refresh so the newly-taken dates show as unavailable
      return;
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {loadingAvailability ? (
        <p className="text-xs text-gray-400">Checking availability...</p>
      ) : existingBookings.length > 0 ? (
        <p className="text-[10px] text-gray-400">
          {existingBookings.length} date range{existingBookings.length !== 1 ? "s" : ""} already booked — pick dates outside those.
        </p>
      ) : null}

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-600">Check-in</label>
          <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-600">Check-out</label>
          <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
        </div>
      </div>

      {nights > 0 && (
        <p className="text-sm font-bold text-chs-charcoal">
          {nights} night{nights !== 1 ? "s" : ""} — {formatNaira(totalPrice)}
        </p>
      )}

      {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}

      <button type="submit" disabled={submitting || loadingAvailability}
        className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
        {submitting ? "Booking..." : "Book now"}
      </button>
    </form>
  );
}
