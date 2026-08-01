"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { ShortletBooking } from "@/types/shortletBooking";
import { formatNaira } from "@/lib/format";
import { uploadDocument } from "@/lib/storage";

interface ShortletBookingFormProps {
  propertyId: string;
  pricePerNight: number;
  session: Session;
  onSuccess: () => void;
}

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
  const [guests, setGuests] = useState(1);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
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
    // Real guest verification — restored, found completely missing.
    // Genuinely required this time, unlike the original's version of
    // this specific field, which was only ever a fake toast message.
    if (!guestName.trim() || !guestPhone.trim() || !idFile) {
      setError("Please provide your name, phone number, and a valid ID for guest verification.");
      return;
    }

    const hasClientSideConflict = existingBookings.some((b) =>
      rangesOverlap(checkIn, checkOut, b.check_in, b.check_out)
    );
    if (hasClientSideConflict) {
      setError("Those dates are already booked. Please choose a different range.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const idDocumentUrl = await uploadDocument(idFile, session.user.id, "shortlet-guest-id");

    // Real, atomic booking + payment — restored, found genuinely
    // missing entirely. A booking previously could be created with no
    // real payment ever happening. Now genuinely debits the guest's
    // real wallet, held in escrow, matching the original's own real
    // promise — not released to the host until check-in is confirmed.
    const { data: bookingId, error: rpcError } = await supabase.rpc("book_shortlet_with_payment", {
      p_property_id: propertyId,
      p_guest_id: session.user.id,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_total_price: totalPrice,
      p_guests: guests,
      p_guest_full_name: guestName.trim(),
      p_guest_phone: guestPhone.trim(),
      p_guest_id_document_url: idDocumentUrl,
    });

    if (rpcError || !bookingId) {
      if (rpcError?.message?.includes("insufficient_balance")) {
        setError("Insufficient wallet balance for this booking. Please top up your wallet first.");
      } else if (rpcError?.message?.includes("exclude") || rpcError?.code === "23P01") {
        setError("Someone just booked those dates. Please choose a different range.");
      } else {
        setError("Could not complete this booking. Please try again.");
      }
      setSubmitting(false);
      loadExistingBookings();
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

      <div>
        <label className="text-xs font-semibold text-gray-600">Guests</label>
        <input type="number" min={1} value={guests} onChange={(e) => setGuests(parseInt(e.target.value) || 1)}
          className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>

      <div className="border-t border-gray-200 pt-3">
        <p className="text-xs font-bold text-chs-charcoal mb-1">Guest verification</p>
        <p className="text-[10px] text-gray-400 mb-2">Valid ID is required before check-in details are released. This protects both you and the host.</p>
        <div className="space-y-2">
          <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
            placeholder="Full name, as shown on your ID" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          <input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)}
            placeholder="08XXXXXXXXX" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setIdFile(e.target.files?.[0] || null)}
            className="w-full text-xs" />
        </div>
      </div>

      {nights > 0 && (
        <div className="border-t border-gray-200 pt-3">
          <p className="text-xs font-bold text-chs-charcoal mb-1">Price breakdown</p>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{formatNaira(pricePerNight)} × {nights} night{nights !== 1 ? "s" : ""}</span>
            <span className="font-bold text-chs-charcoal">{formatNaira(totalPrice)}</span>
          </div>
        </div>
      )}

      {nights > 0 && (
        <div className="bg-chs-amber-light rounded-lg p-3">
          <p className="text-xs font-bold text-chs-red">💳 CHS Wallet (recommended)</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Instant · Held in escrow until check-in confirmed</p>
        </div>
      )}

      {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}

      <button type="submit" disabled={submitting || loadingAvailability}
        className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
        {submitting ? "Processing payment..." : "Confirm & pay — instant confirmation"}
      </button>
    </form>
  );
}
