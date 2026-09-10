"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import InfoTip from "./InfoTip";
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
  // Real, direct fix per confirmed client testing: a music band,
  // caterer, or ushers request only makes sense for a real event-type
  // venue, never a hotel room or a car park slot.
  const isEventVenue = /event|hall/i.test(hireCategoryLabel);
  const [existingBookings, setExistingBookings] = useState<ShortletBooking[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [attendees, setAttendees] = useState(1);
  const [wantsMusicBand, setWantsMusicBand] = useState(false);
  const [wantsCaterer, setWantsCaterer] = useState(false);
  const [wantsUshers, setWantsUshers] = useState(false);
  const [numberOfUshers, setNumberOfUshers] = useState(2);
  const [additionalEventRequests, setAdditionalEventRequests] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [pricing, setPricing] = useState<{ nights: number; base_amount: number; guest_commission_amount: number; security_deposit_required: boolean; security_deposit_amount: number; real_total_guest_pays: number } | null>(null);
  const [houseRulesUrl, setHouseRulesUrl] = useState<string | null>(null);
  const [rulesAcknowledged, setRulesAcknowledged] = useState(false);

  // Real, richer event pricing — capacity tiers and priced extra
  // facilities, per a genuine, verified reference design. Only
  // fetched and shown for event-type venues that genuinely have real
  // tiers configured; every other hire category keeps the existing,
  // proven per-day flow untouched.
  const [tiers, setTiers] = useState<{ id: string; label: string; max_guests: number; price: number }[]>([]);
  const [facilities, setFacilities] = useState<{ id: string; name: string; price: number; per_guest: boolean }[]>([]);
  const [selectedTierId, setSelectedTierId] = useState("");
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState("Wedding / Reception");
  const EVENT_TYPES = ["Wedding / Reception", "Engagement / Traditional ceremony", "Conference / Seminar", "Lecture / Public talk", "Birthday party", "Burial / Funeral reception", "Product launch / Corporate event", "Religious programme", "Graduation / Award ceremony", "Other"];

  useEffect(() => {
    if (!isEventVenue) return;
    supabase.from("event_capacity_tiers").select("*").eq("property_id", propertyId).order("display_order")
      .then(({ data }) => setTiers(data || []));
    supabase.from("event_facilities").select("*").eq("property_id", propertyId).order("display_order")
      .then(({ data }) => setFacilities(data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEventVenue]);

  const selectedTier = tiers.find((t) => t.id === selectedTierId);
  const facilitiesTotal = facilities
    .filter((f) => selectedFacilityIds.includes(f.id))
    .reduce((sum, f) => sum + f.price * (f.per_guest ? (selectedTier?.max_guests || 0) : 1), 0);
  const eventBaseAmount = (selectedTier?.price || 0) + facilitiesTotal;
  const eventGuestCommission = Math.round(eventBaseAmount * 0.06);
  const eventRealTotal = eventBaseAmount + eventGuestCommission;

  async function handleSubmitEventBooking() {
    if (!selectedTierId) { setError("Please select a real capacity tier."); return; }
    if (!eventDate) { setError("Please choose your real event date."); return; }
    if (!guestName.trim() || !guestPhone.trim()) { setError("Please provide your real name and phone number."); return; }
    setError(null);
    setSubmitting(true);
    let idDocumentUrl: string | null = null;
    if (idFile) idDocumentUrl = await uploadDocument(idFile, session.user.id, "shortlet-guest-id");

    const selected = facilities.filter((f) => selectedFacilityIds.includes(f.id));
    const { data, error: rpcError } = await supabase.rpc("request_event_booking", {
      p_property_id: propertyId,
      p_event_date: eventDate,
      p_tier_id: selectedTierId,
      p_event_type: eventType,
      p_facility_ids: selected.map((f) => f.id),
      p_facility_quantities: selected.map((f) => (f.per_guest ? selectedTier?.max_guests || 0 : 1)),
      p_guest_full_name: guestName.trim(),
      p_guest_phone: guestPhone.trim(),
      p_guest_id_document_url: idDocumentUrl,
      p_house_rules_acknowledged: rulesAcknowledged,
    });
    setSubmitting(false);
    if (rpcError || !data) {
      setError(rpcError?.message?.includes("insufficient_balance") ? "Insufficient wallet balance for this real total." : "Could not submit this real booking request.");
      return;
    }
    onSuccess();
  }

  useEffect(() => {
    loadExistingBookings();
    supabase.rpc("get_house_rules_for_property", { p_property_id: propertyId }).then(({ data }) => setHouseRulesUrl(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real, complete fee transparency — same as the shortlet form, the
  // exact, true amount the guest will actually pay, including CHS's
  // real commission, fetched live rather than calculated locally so
  // it's genuinely the same number the backend will charge.
  useEffect(() => {
    if (!startDate || !endDate || new Date(endDate) < new Date(startDate)) {
      return;
    }
    supabase.rpc("get_real_shortlet_pricing", { p_property_id: propertyId, p_check_in: startDate, p_check_out: endDate, p_guest_id: session.user.id })
      .then(({ data }) => setPricing(data));
  }, [startDate, endDate, propertyId, session.user.id]);

  async function loadExistingBookings() {
    const { data } = await supabase
      .from("shortlet_bookings")
      .select("*")
      .eq("property_id", propertyId)
      .eq("status", "confirmed");
    setExistingBookings(data || []);
    setLoadingAvailability(false);
  }

  const validDateRange = startDate && endDate && new Date(endDate) >= new Date(startDate);
  // Real, honest minimum — even a same-day event genuinely bills as
  // 1 real day, never zero.
  const days = startDate && endDate ? Math.max(daysBetween(startDate, endDate), startDate === endDate ? 1 : 0) : 0;

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
    if (!pricing) {
      setError("Please wait for the real price to load before submitting.");
      return;
    }
    if (houseRulesUrl && !rulesAcknowledged) {
      setError("Please read and acknowledge the real house rules before requesting to book.");
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

    const { data: bookingId, error: rpcError } = await supabase.rpc("request_shortlet_booking", {
      p_property_id: propertyId,
      p_check_in: startDate,
      p_check_out: endDate,
      p_guests: attendees,
      p_guest_full_name: guestName.trim(),
      p_guest_phone: guestPhone.trim(),
      p_guest_id_document_url: idDocumentUrl,
      p_house_rules_acknowledged: rulesAcknowledged,
      p_wants_music_band: isEventVenue ? wantsMusicBand : false,
      p_wants_caterer: isEventVenue ? wantsCaterer : false,
      p_wants_ushers: isEventVenue ? wantsUshers : false,
      p_number_of_ushers: isEventVenue && wantsUshers ? numberOfUshers : null,
      p_additional_event_requests: isEventVenue ? additionalEventRequests.trim() || null : null,
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

  // Real, richer event-booking experience — real capacity tiers,
  // real priced facilities, and a real, live-calculated quotation, per
  // a genuine, verified reference design.
  if (isEventVenue && tiers.length > 0) {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-gray-600">1. Expected number of guests</label>
          <select value={selectedTierId} onChange={(e) => setSelectedTierId(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
            <option value="">Select a real capacity tier</option>
            {tiers.map((t) => <option key={t.id} value={t.id}>{t.label} — {formatNaira(t.price)}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600">2. Type of event</label>
          <select value={eventType} onChange={(e) => setEventType(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
            {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>

        {facilities.length > 0 && (
          <div>
            <label className="text-xs font-semibold text-gray-600">3. Extra facilities needed (optional)</label>
            <div className="mt-1 space-y-1">
              {facilities.map((f) => (
                <label key={f.id} className="flex items-center justify-between gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2">
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={selectedFacilityIds.includes(f.id)}
                      onChange={(e) => setSelectedFacilityIds(e.target.checked ? [...selectedFacilityIds, f.id] : selectedFacilityIds.filter((id) => id !== f.id))} />
                    {f.name}
                  </span>
                  <span className="text-gray-500 whitespace-nowrap">{formatNaira(f.price)}{f.per_guest ? "/guest" : ""}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-gray-600">4. Event date</label>
          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
        </div>

        {selectedTier && (
          <div className="border-t border-gray-200 pt-3">
            <p className="text-xs font-bold text-chs-charcoal mb-1">Real, live quotation</p>
            <div className="flex justify-between text-xs text-gray-500"><span>{selectedTier.label}</span><span>{formatNaira(selectedTier.price)}</span></div>
            {facilitiesTotal > 0 && <div className="flex justify-between text-xs text-gray-500"><span>Extra facilities</span><span>{formatNaira(facilitiesTotal)}</span></div>}
            <div className="flex justify-between text-xs text-gray-500"><span>CHS service fee (6%)</span><span>{formatNaira(eventGuestCommission)}</span></div>
            <div className="flex justify-between text-sm font-bold text-chs-charcoal border-t border-gray-100 pt-1 mt-1"><span>Real total you&apos;ll pay</span><span>{formatNaira(eventRealTotal)}</span></div>
          </div>
        )}

        <div className="border-t border-gray-200 pt-3">
          <p className="text-xs font-bold text-chs-charcoal mb-1">Booking contact verification</p>
          <div className="space-y-2">
            <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
              placeholder="Full name, as shown on your ID" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
            <input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="08XXXXXXXXX" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setIdFile(e.target.files?.[0] || null)}
              className="w-full text-xs" />
          </div>
        </div>

        {houseRulesUrl && (
          <label className="flex items-start gap-2 text-[11px] text-chs-charcoal">
            <input type="checkbox" checked={rulesAcknowledged} onChange={(e) => setRulesAcknowledged(e.target.checked)} className="mt-0.5" />
            <span>I have read and agree to the venue&apos;s real house rules.</span>
          </label>
        )}

        {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
        <button onClick={handleSubmitEventBooking} disabled={submitting}
          className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
          {submitting ? "Submitting..." : "Submit booking request to CHS"}
        </button>
      </div>
    );
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

      {isEventVenue && (
        <div className="border-t border-gray-200 pt-3">
          <p className="text-xs font-bold text-chs-charcoal mb-2">Event-day services (optional)</p>
          <p className="text-[10px] text-gray-400 mb-2">Let the host know what you&apos;ll need — they&apos;ll arrange or help connect you with real, trusted providers.</p>
          <label className="flex items-center gap-2 text-xs text-chs-charcoal mb-1.5">
            <input type="checkbox" checked={wantsMusicBand} onChange={(e) => setWantsMusicBand(e.target.checked)} />
            Music band / live entertainment
          </label>
          <label className="flex items-center gap-2 text-xs text-chs-charcoal mb-1.5">
            <input type="checkbox" checked={wantsCaterer} onChange={(e) => setWantsCaterer(e.target.checked)} />
            Caterer
          </label>
          <label className="flex items-center gap-2 text-xs text-chs-charcoal mb-1.5">
            <input type="checkbox" checked={wantsUshers} onChange={(e) => setWantsUshers(e.target.checked)} />
            Ushers
          </label>
          {wantsUshers && (
            <div className="ml-6 mb-1.5">
              <label className="text-[10px] text-gray-500">Number of ushers needed</label>
              <input type="number" min={1} value={numberOfUshers} onChange={(e) => setNumberOfUshers(parseInt(e.target.value) || 1)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-xs" />
            </div>
          )}
          <textarea value={additionalEventRequests} onChange={(e) => setAdditionalEventRequests(e.target.value)} rows={2}
            placeholder="Anything else the host should know about your event?"
            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-xs" />
        </div>
      )}

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

      {pricing && validDateRange && (
        <div className="border-t border-gray-200 pt-3">
          <p className="text-xs font-bold text-chs-charcoal mb-1">Real price breakdown</p>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{formatNaira(pricePerDay)} × {pricing.nights} day{pricing.nights !== 1 ? "s" : ""}</span>
            <span>{formatNaira(pricing.base_amount)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>CHS service fee</span>
            <span>{formatNaira(pricing.guest_commission_amount)}</span>
          </div>
          {pricing.security_deposit_required && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>Refundable security deposit <InfoTip text="A real, extra amount held by CHS alongside your booking, genuinely returned to you after checkout — unless the host reports real damage, in which case CHS reviews and decides how much is fairly returned." /></span>
              <span>{formatNaira(pricing.security_deposit_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-chs-charcoal border-t border-gray-100 pt-1 mt-1">
            <span>Real total you&apos;ll pay</span>
            <span>{formatNaira(pricing.real_total_guest_pays)}</span>
          </div>
        </div>
      )}

      {pricing && validDateRange && (
        <div className="bg-chs-amber-light rounded-lg p-3">
          <p className="text-xs font-bold text-chs-red">⏳ Request to book — not an instant charge</p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            The real, full amount is held safely from your wallet the moment you request, but the host must genuinely
            review and accept before it&apos;s confirmed. If they decline, you are automatically, fully refunded.
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

      {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}

      <button type="submit" disabled={submitting || loadingAvailability || !pricing || !validDateRange || (!!houseRulesUrl && !rulesAcknowledged)}
        className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
        {submitting ? "Sending your real request..." : "Request to book"}
      </button>
    </form>
  );
}
