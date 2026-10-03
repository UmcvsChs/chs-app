"use client";

import RefundPolicyNotice from "./RefundPolicyNotice";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { ShortletBooking } from "@/types/shortletBooking";
import { formatNaira } from "@/lib/format";
import ValidatedInput from "@/components/ValidatedInput";
import { validatePhone, validateFullName } from "@/lib/validators";

interface ShortletBookingFormProps {
  propertyId: string;
  pricePerNight: number;
  session: Session;
  onSuccess: () => void;
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return new Date(startA) < new Date(endB) && new Date(startB) < new Date(endA);
}

// Real, comprehensive rebuild per direct, serious client feedback —
// this previously let a guest pay and be instantly confirmed with
// zero real host review, silently undercharged the guest's own real
// commission share, and never actually paid the host anything at
// all. Now shows the true, full cost before committing, and submits
// a real request the host must genuinely accept or decline — not an
// instant booking.
interface RealPricing {
  nights: number;
  base_amount: number;
  guest_commission_amount: number;
  security_deposit_required: boolean;
  security_deposit_amount: number;
  real_total_guest_pays: number;
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [pricing, setPricing] = useState<RealPricing | null>(null);
  const [houseRulesUrl, setHouseRulesUrl] = useState<string | null>(null);
  const [rulesAcknowledged, setRulesAcknowledged] = useState(false);

  useEffect(() => {
    loadExistingBookings();
    // Real, direct fix for a genuine, confirmed gap: house rules
    // could be uploaded by a host, but were never actually shown to
    // the guest anywhere in the real booking flow.
    supabase.rpc("get_house_rules_for_property", { p_property_id: propertyId }).then(({ data }) => setHouseRulesUrl(data));
    // Prefill the guest's name and phone from their own verified
    // profile — only where they haven't already typed something.
    supabase.from("profiles").select("full_name, phone").eq("id", session.user.id).single().then(({ data }) => {
      if (!data) return;
      if (data.full_name) setGuestName((cur) => cur || data.full_name);
      if (data.phone) setGuestPhone((cur) => cur || data.phone);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!checkIn || !checkOut || new Date(checkOut) <= new Date(checkIn)) {
      return;
    }
    supabase.rpc("get_real_shortlet_pricing", { p_property_id: propertyId, p_check_in: checkIn, p_check_out: checkOut, p_guest_id: session.user.id })
      .then(({ data }) => setPricing(data));
  }, [checkIn, checkOut, propertyId, session.user.id]);

  const validDateRange = checkIn && checkOut && new Date(checkOut) > new Date(checkIn);

  async function loadExistingBookings() {
    const { data } = await supabase
      .from("shortlet_bookings")
      .select("*")
      .eq("property_id", propertyId)
      .eq("status", "confirmed");
    setExistingBookings(data || []);
    setLoadingAvailability(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validDateRange || !pricing) {
      setError("Please choose your check-in and check-out dates.");
      return;
    }
    const guestNameCheck = validateFullName(guestName, "full name");
    if (!guestNameCheck.valid) { setError(guestNameCheck.message); return; }
    const guestPhoneCheck = validatePhone(guestPhone, { international: true });
    if (!guestPhoneCheck.valid) { setError(`Your phone number: ${guestPhoneCheck.message}`); return; }
    if (houseRulesUrl && !rulesAcknowledged) {
      setError("Please read and acknowledge the real house rules before requesting to book.");
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

    const { data: bookingId, error: rpcError } = await supabase.rpc("request_shortlet_booking", {
      p_property_id: propertyId,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_guests: guests,
      p_guest_full_name: guestName.trim(),
      p_guest_phone: validatePhone(guestPhone, { international: true }).value,
      // Deliberately null: the guest's identity is already verified by
      // CHS (required before this form even appears), and the ID
      // document itself is not passed on to hosts — the gate promises
      // guests that their ID is never shown to other users.
      p_guest_id_document_url: null,
      p_house_rules_acknowledged: rulesAcknowledged,
    });

    if (rpcError || !bookingId) {
      if (rpcError?.message?.includes("insufficient_balance")) {
        setError("Insufficient wallet balance for the real total (including CHS's commission). Please top up your wallet first.");
      } else if (rpcError?.message?.includes("exclude") || rpcError?.code === "23P01") {
        setError("Someone just booked those dates. Please choose a different range.");
      } else {
        setError("Could not complete this booking request. Please try again.");
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
        <p className="text-xs font-bold text-chs-charcoal mb-1">Guest details</p>
        <p className="text-[10px] text-green-700 mb-2">✓ Your identity is already verified by CHS — the host is told so, and you don&apos;t need to upload your ID again.</p>
        <div className="space-y-2">
          <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
            placeholder="Full name, as shown on your ID" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          <ValidatedInput kind="phoneIntl" value={guestPhone} onChange={setGuestPhone}
            placeholder="08XXXXXXXXX" className="w-full px-3 py-2.5 rounded-lg text-sm" />
        </div>
      </div>

      {pricing && validDateRange && (
        <div className="border-t border-gray-200 pt-3">
          <p className="text-xs font-bold text-chs-charcoal mb-1">Real price breakdown</p>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{formatNaira(pricePerNight)} × {pricing.nights} night{pricing.nights !== 1 ? "s" : ""}</span>
            <span>{formatNaira(pricing.base_amount)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>CHS service fee</span>
            <span>{formatNaira(pricing.guest_commission_amount)}</span>
          </div>
          {pricing.security_deposit_required && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>Refundable security deposit</span>
              <span>{formatNaira(pricing.security_deposit_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-chs-charcoal border-t border-gray-100 pt-1 mt-1">
            <span>Real total you&apos;ll pay</span>
            <span>{formatNaira(pricing.real_total_guest_pays)}</span>
          </div>
        </div>
      )}

      {pricing?.security_deposit_required && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-bold text-chs-charcoal">🛡️ Refundable security deposit</p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Since this is your first real stay at this property, a refundable {formatNaira(pricing.security_deposit_amount)} deposit
            applies — held safely and returned to you after checkout if no real damage is reported. Guests with 3+ real
            ratings never pay this.
          </p>
        </div>
      )}

      {pricing && validDateRange && (
        <div className="bg-chs-amber-light rounded-lg p-3">
          <p className="text-xs font-bold text-chs-red">⏳ Request to book — not an instant charge</p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            The real, full amount is held safely from your wallet the moment you request, but the host must genuinely
            review and accept before your stay is confirmed. If they decline, you are automatically, fully refunded.
          </p>
        </div>
      )}

      {houseRulesUrl && (
        <div className="border-t border-gray-200 pt-3">
          <p className="text-xs font-bold text-chs-charcoal mb-1">House Rules &amp; Regulations</p>
          <a href={houseRulesUrl} target="_blank" rel="noreferrer" className="text-[11px] text-chs-red underline block mb-2">
            📄 Read the real house rules for this property
          </a>
          <label className="flex items-start gap-2 text-[11px] text-chs-charcoal">
            <input type="checkbox" checked={rulesAcknowledged} onChange={(e) => setRulesAcknowledged(e.target.checked)} className="mt-0.5" />
            <span>I have read and agree to comply with the real house rules above.</span>
          </label>
        </div>
      )}

      <RefundPolicyNotice />

      {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}

      <button type="submit" disabled={submitting || loadingAvailability || !pricing || !validDateRange || (!!houseRulesUrl && !rulesAcknowledged)}
        className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
        {submitting ? "Sending your real request..." : "Request to book"}
      </button>
    </form>
  );
}
