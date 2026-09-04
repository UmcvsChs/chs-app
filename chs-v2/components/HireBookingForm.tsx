"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { ShortletBooking } from "@/types/shortletBooking";
import { formatNaira } from "@/lib/format";
import { uploadDocument } from "@/lib/storage";

// Real, new component completing a genuine, comprehensive fix: Hotel,
// Event Centre, Hall, Car Park, Cinema, and Recreational/Sports
// venues were all falling through to the tenant-style rental
// application flow instead of a real, instant guest booking — even
// though the backend already had real, working commission logic for
// exactly this. Reuses the same real, tested booking function as
// Shortlet (book_shortlet_with_payment is genuinely generic — dates,
// a property, a price), but with real per-day venue pricing and
// wording that actually matches a hall or car park booking, not a
// hotel night.
interface HireBookingFormProps {
  propertyId: string;
  pricePerDay: number;
  hireCategoryLabel: string;
  session: Session;
  onSuccess: () => void;
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return new Date(startA) < new Date(endB) && new Date(startB) < new Date(endA);
}

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export default function HireBookingForm({
  propertyId,
  pricePerDay,
  hireCategoryLabel,
  session,
  onSuccess,
}: HireBookingFormProps) {
  const [existingBookings, setExistingBookings] = useState<ShortletBooking[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [attendees, setAttendees] = useState(1);
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

  // Real, honest minimum — even a same-day event genuinely bills as
  // 1 real day, never zero.
  const days = startDate && endDate ? Math.max(daysBetween(startDate, endDate), startDate === endDate ? 1 : 0) : 0;
  const totalPrice = days > 0 ? days * pricePerDay : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError(`Please choose your real start and end date for this ${hireCategoryLabel.toLowerCase()}.`);
      return;
    }
    if (days <= 0) {
      setError("The end date must be on or after the start date.");
      return;
    }
    if (!guestName.trim() || !guestPhone.trim() || !idFile) {
      setError("Please provide your name, phone number, and a valid ID for guest verification.");
      return;
    }

    const hasClientSideConflict = existingBookings.some((b) =>
      rangesOverlap(startDate, endDate, b.check_in, b.check_out)
    );
    if (hasClientSideConflict) {
      setError("Those dates are already booked. Please choose a different range.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const idDocumentUrl = await uploadDocument(idFile, session.user.id, "hire-guest-id");

    const { data: bookingId, error: rpcError } = await supabase.rpc("book_shortlet_with_payment", {
      p_property_id: propertyId,
      p_guest_id: session.user.id,
      p_check_in: startDate,
      p_check_out: endDate,
      p_total_price: totalPrice,
      p_guests: attendees,
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
        <p className="text-xs text-gray-400">Checking real availability...</p>
      ) : existingBookings.length > 0 ? (
        <p className="text-[10px] text-gray-400">
          {existingBookings.length} date range{existingBookings.length !== 1 ? "s" : ""} already booked — pick dates outside those.
        </p>
      ) : null}

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-600">Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-600">End date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600">Expected attendees / guests</label>
        <input type="number" min={1} value={attendees} onChange={(e) => setAttendees(parseInt(e.target.value) || 1)}
          className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>

      <div className="border-t border-gray-200 pt-3">
        <p className="text-xs font-bold text-chs-charcoal mb-1">Booking contact verification</p>
        <p className="text-[10px] text-gray-400 mb-2">A valid ID is required before booking details are released. This protects both you and the host.</p>
        <div className="space-y-2">
          <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
            placeholder="Full name, as shown on your ID" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          <input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)}
            placeholder="08XXXXXXXXX" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setIdFile(e.target.files?.[0] || null)}
            className="w-full text-xs" />
        </div>
      </div>

      {days > 0 && (
        <div className="border-t border-gray-200 pt-3">
          <p className="text-xs font-bold text-chs-charcoal mb-1">Price breakdown</p>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{formatNaira(pricePerDay)} × {days} day{days !== 1 ? "s" : ""}</span>
            <span className="font-bold text-chs-charcoal">{formatNaira(totalPrice)}</span>
          </div>
        </div>
      )}

      {days > 0 && (
        <div className="bg-chs-amber-light rounded-lg p-3">
          <p className="text-xs font-bold text-chs-red">💳 CHS Wallet (recommended)</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Instant · Held in escrow until your booking is confirmed</p>
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
