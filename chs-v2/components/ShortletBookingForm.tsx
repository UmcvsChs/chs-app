"use client";

import { Req, RequiredLegend } from "@/components/FormMarks";
import RefundPolicyNotice from "./RefundPolicyNotice";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import BookingFlowNotice from "@/components/BookingFlowNotice";
import { BookingRequestResult, LaneInfo, friendlyBookingError } from "@/lib/bookingLane";
import { formatNaira } from "@/lib/format";
import ValidatedInput from "@/components/ValidatedInput";
import { validatePhone, validateFullName } from "@/lib/validators";

interface ShortletBookingFormProps {
  propertyId: string;
  pricePerNight: number;
  session: Session;
  onSuccess: (result: BookingRequestResult) => void;
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
  price_per_night: number;
  base_amount: number;
  guest_commission_amount: number;
  security_deposit_required: boolean;
  security_deposit_amount: number;
  real_total_guest_pays: number;
  peak_nights?: number;
  peak_names?: string[] | null;
  min_stay?: number | null;
}

interface ExpressAlternative {
  id: string;
  title: string;
  location_area: string | null;
  location_lga: string | null;
  price_per_night: number;
  instant: boolean;
  has_house_rules: boolean;
}

export default function ShortletBookingForm({
  propertyId,
  pricePerNight,
  session,
  onSuccess,
}: ShortletBookingFormProps) {
  // Room types the host has set up (e.g. Executive, Standard). Guests choose
  // a type; the system assigns a free room of that type.
  const [roomOptions, setRoomOptions] = useState<{ id: string; name: string; price: number | null; maxGuests: number | null }[]>([]);
  const [roomTypeId, setRoomTypeId] = useState("");
  const [calendarKey, setCalendarKey] = useState(0);
  // How soon the guest arrives decides how quickly each step must happen.
  const [laneInfo, setLaneInfo] = useState<LaneInfo | null>(null);
  const [arrivalTime, setArrivalTime] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(1);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pricing, setPricing] = useState<RealPricing | null>(null);
  const [houseRulesUrl, setHouseRulesUrl] = useState<string | null>(null);
  const [rulesAcknowledged, setRulesAcknowledged] = useState(false);
  // Instant Confirm: the host pre-approved bookings, so the guest pays and is
  // confirmed at once — no waiting for a reply.
  const [isInstant, setIsInstant] = useState(false);
  // Express: for a same-day stay the guest may ask up to 2 more hotels at once.
  const [alternatives, setAlternatives] = useState<ExpressAlternative[]>([]);
  const [alsoAsk, setAlsoAsk] = useState<string[]>([]);

  useEffect(() => {
    supabase.rpc("property_is_instant", { p_property_id: propertyId }).then(({ data }) => setIsInstant(data === true));
  }, [propertyId]);

  useEffect(() => {
    Promise.all([
      supabase.from("room_types").select("id, name, max_guests, price_per_night, sort_order").eq("property_id", propertyId).eq("active", true).order("sort_order"),
      supabase.from("property_units").select("room_type_id").eq("property_id", propertyId).eq("active", true),
    ]).then(([typesRes, unitsRes]) => {
      const units = unitsRes.data || [];
      const options = (typesRes.data || [])
        .filter((t) => units.some((u) => u.room_type_id === t.id))
        .map((t) => ({ id: t.id as string, name: t.name as string, price: t.price_per_night as number | null, maxGuests: t.max_guests as number | null }));
      if (units.some((u) => !u.room_type_id)) {
        options.push({ id: "", name: options.length > 0 ? "Standard room" : "Whole property", price: null, maxGuests: null });
      }
      setRoomOptions(options);
      if (options.length === 1) setRoomTypeId(options[0].id);
    });
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPricing(null);
      return;
    }
    supabase.rpc("get_real_shortlet_pricing", {
      p_property_id: propertyId, p_check_in: checkIn, p_check_out: checkOut,
      p_guest_id: session.user.id, p_room_type_id: roomTypeId || null,
    }).then(({ data }) => setPricing(data));
  }, [checkIn, checkOut, propertyId, session.user.id, roomTypeId]);

  useEffect(() => {
    if (!checkIn || !checkOut || new Date(checkOut) <= new Date(checkIn)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLaneInfo(null);
      return;
    }
    supabase.rpc("booking_lane_info", { p_check_in: checkIn }).then(({ data }) => setLaneInfo((data as LaneInfo) || null));
  }, [checkIn, checkOut]);

  const validDateRange = checkIn && checkOut && new Date(checkOut) > new Date(checkIn);
  const showExpress = !isInstant && laneInfo?.lane === "express" && !!validDateRange;

  useEffect(() => {
    if (!showExpress) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAlternatives([]); setAlsoAsk([]);
      return;
    }
    supabase.rpc("get_express_alternatives", { p_property_id: propertyId, p_check_in: checkIn, p_check_out: checkOut })
      .then(({ data }) => setAlternatives((data as ExpressAlternative[]) || []));
  }, [showExpress, propertyId, checkIn, checkOut]);

  function toggleAlt(id: string) {
    setAlsoAsk((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 2 ? cur : [...cur, id]);
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

    if (laneInfo?.lane === "express" && !arrivalTime) {
      setError("For a same-day booking, please tell the hotel roughly what time you will arrive.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const cleanPhone = validatePhone(guestPhone, { international: true }).value;

    if (isInstant) {
      const { data: inst, error: instError } = await supabase.rpc("book_instant_shortlet", {
        p_property_id: propertyId, p_check_in: checkIn, p_check_out: checkOut, p_guests: guests,
        p_guest_full_name: guestName.trim(), p_guest_phone: cleanPhone, p_guest_id_document_url: null,
        p_house_rules_acknowledged: rulesAcknowledged, p_room_type_id: roomTypeId || null,
        p_expected_arrival_time: arrivalTime || null,
      });
      if (instError || !inst) {
        setError(friendlyBookingError(instError?.message, { lane: "express", total: pricing.real_total_guest_pays }, "Could not complete your booking. Nothing was charged. Please try again."));
        setSubmitting(false);
        setCalendarKey((k) => k + 1);
        return;
      }
      onSuccess({
        booking_id: (inst as { booking_id: string }).booking_id, status: "confirmed", lane: "instant",
        relay_minutes: null, host_minutes: 0, pay_minutes: 0,
        total_to_pay: (inst as { total_paid?: number }).total_paid ?? pricing.real_total_guest_pays, instant: true,
      });
      return;
    }

    if (showExpress && alsoAsk.length > 0) {
      const { data: ex, error: exError } = await supabase.rpc("request_express_booking", {
        p_property_ids: [propertyId, ...alsoAsk], p_check_in: checkIn, p_check_out: checkOut, p_guests: guests,
        p_guest_full_name: guestName.trim(), p_guest_phone: cleanPhone, p_guest_id_document_url: null,
        p_house_rules_acknowledged: rulesAcknowledged, p_primary_room_type_id: roomTypeId || null,
        p_expected_arrival_time: arrivalTime || null,
      });
      if (exError || !ex) {
        setError(friendlyBookingError(exError?.message, { lane: laneInfo?.lane, total: pricing.real_total_guest_pays }));
        setSubmitting(false);
        setCalendarKey((k) => k + 1);
        return;
      }
      onSuccess({
        booking_id: (ex as { group_id: string }).group_id, status: "awaiting_admin_relay", lane: "express",
        relay_minutes: laneInfo?.relay_minutes ?? null, host_minutes: laneInfo?.host_minutes ?? 0,
        pay_minutes: laneInfo?.pay_minutes ?? 0, total_to_pay: pricing.real_total_guest_pays,
        express_asked: (ex as { asked: number }).asked,
      });
      return;
    }

    const { data: requestResult, error: rpcError } = await supabase.rpc("request_shortlet_booking", {
      p_property_id: propertyId,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_guests: guests,
      p_guest_full_name: guestName.trim(),
      p_guest_phone: cleanPhone,
      // Deliberately null: the guest's identity is already verified by
      // CHS (required before this form even appears), and the ID
      // document itself is not passed on to hosts — the gate promises
      // guests that their ID is never shown to other users.
      p_guest_id_document_url: null,
      p_house_rules_acknowledged: rulesAcknowledged,
      p_room_type_id: roomTypeId || null,
      p_expected_arrival_time: arrivalTime || null,
    });

    if (rpcError || !requestResult) {
      setError(friendlyBookingError(rpcError?.message, { lane: laneInfo?.lane, total: pricing.real_total_guest_pays }));
      setSubmitting(false);
      setCalendarKey((k) => k + 1);
      return;
    }

    onSuccess(requestResult as BookingRequestResult);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {roomOptions.length > 1 && (
        <div>
          <p className="text-xs font-bold text-chs-charcoal mb-1">Choose a room type</p>
          <div className="space-y-1.5">
            {roomOptions.map((o) => (
              <label key={o.id || "any"} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 cursor-pointer ${roomTypeId === o.id ? "border-chs-red bg-chs-amber-light" : "border-gray-200 bg-white"}`}>
                <span className="flex items-center gap-2">
                  <input type="radio" name="room-type" checked={roomTypeId === o.id} onChange={() => setRoomTypeId(o.id)} />
                  <span>
                    <span className="block text-xs font-semibold text-chs-charcoal">{o.name}</span>
                    {o.maxGuests && <span className="block text-[10px] text-gray-400">Up to {o.maxGuests} guests</span>}
                  </span>
                </span>
                <span className="text-xs font-bold text-chs-charcoal whitespace-nowrap">{formatNaira(o.price ?? pricePerNight)}<span className="text-[9px] font-normal text-gray-400">/night</span></span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-bold text-chs-charcoal mb-1">Choose your dates</p>
        <AvailabilityCalendar
          key={`${roomTypeId}-${calendarKey}`}
          propertyId={propertyId}
          roomTypeId={roomTypeId || null}
          mode="range"
          checkIn={checkIn}
          checkOut={checkOut}
          onChange={(ci, co) => { setCheckIn(ci); setCheckOut(co); }}
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600">Guests <Req /></label>
        <input type="number" min={1} value={guests} onChange={(e) => setGuests(parseInt(e.target.value) || 1)}
          className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>

      <div className="border-t border-gray-200 pt-3">
        <p className="text-xs font-bold text-chs-charcoal mb-1">Guest details</p>
        <RequiredLegend className="mb-1.5" />
        <p className="text-[10px] text-green-700 mb-2">✓ Your identity is already verified by CHS — the host is told so, and you don&apos;t need to upload your ID again.</p>
        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-gray-500">Full name <Req /></label>
          <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
            placeholder="Full name, as shown on your ID" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          <label className="text-[10px] font-semibold text-gray-500">Phone number <Req /></label>
          <ValidatedInput kind="phoneIntl" value={guestPhone} onChange={setGuestPhone}
            placeholder="08XXXXXXXXX" className="w-full px-3 py-2.5 rounded-lg text-sm" />
        </div>
      </div>

      {pricing && validDateRange && (
        <div className="border-t border-gray-200 pt-3">
          <p className="text-xs font-bold text-chs-charcoal mb-1">Real price breakdown</p>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{formatNaira(pricing.price_per_night ?? pricePerNight)} × {pricing.nights} night{pricing.nights !== 1 ? "s" : ""}</span>
            <span>{formatNaira(pricing.base_amount)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>CHS service fee</span>
            <span>{formatNaira(pricing.guest_commission_amount)}</span>
          </div>
          {!!pricing.peak_nights && pricing.peak_nights > 0 && (
            <p className="text-[10px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 mt-1">
              📈 {pricing.peak_nights} of your nights fall in a busy period{pricing.peak_names && pricing.peak_names.length > 0 ? ` (${pricing.peak_names.join(", ")})` : ""}, so the host&apos;s peak rate applies to them. The price above already includes it.
            </p>
          )}
          {pricing.min_stay && pricing.min_stay > 1 && (
            <p className="text-[10px] text-gray-500 mt-1">Minimum stay for these dates: {pricing.min_stay} nights.</p>
          )}
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
        <>
          <div>
            <label className="text-xs font-semibold text-gray-600">
              Expected arrival time{" "}
              {laneInfo?.lane === "express"
                ? <span className="text-chs-red">(required for a same-day booking)</span>
                : <span className="text-gray-400">(optional)</span>}
            </label>
            <input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
            <p className="text-[10px] text-gray-400 mt-0.5">Helps the host have your room ready when you arrive.</p>
          </div>
          {isInstant ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs font-bold text-green-800">⚡ Instant Confirm</p>
              <p className="text-[11px] text-green-800 mt-0.5">This host confirms bookings automatically. You pay {formatNaira(pricing.real_total_guest_pays)} from your CHS wallet now and your room is confirmed straight away. The host is paid only after you arrive and confirm.</p>
            </div>
          ) : (
            <BookingFlowNotice info={laneInfo} total={pricing.real_total_guest_pays} />
          )}
        </>
      )}

      {showExpress && alternatives.length > 0 && (
        <div className="border border-chs-red/30 rounded-lg p-3 bg-chs-amber-light/40">
          <p className="text-xs font-bold text-chs-charcoal">⚡ Need a room today? Ask up to 2 more hotels at once</p>
          <p className="text-[10px] text-gray-600 mb-2">CHS passes your request to each one. The first host to confirm wins, and the others are cancelled automatically. You are charged only once, for the one you get. These hotels have a free room for your dates:</p>
          <div className="space-y-1.5">
            {alternatives.map((a) => (
              <label key={a.id} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 cursor-pointer bg-white ${alsoAsk.includes(a.id) ? "border-chs-red" : "border-gray-200"}`}>
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={alsoAsk.includes(a.id)} onChange={() => toggleAlt(a.id)} disabled={!alsoAsk.includes(a.id) && alsoAsk.length >= 2} />
                  <span>
                    <span className="block text-xs font-semibold text-chs-charcoal">{a.title}{a.instant ? " ⚡" : ""}</span>
                    <span className="block text-[10px] text-gray-400">{[a.location_area, a.location_lga].filter(Boolean).join(", ")}</span>
                  </span>
                </span>
                <span className="text-xs font-bold text-chs-charcoal whitespace-nowrap">{formatNaira(a.price_per_night)}<span className="text-[9px] font-normal text-gray-400">/night</span></span>
              </label>
            ))}
          </div>
          {alsoAsk.length > 0 && <p className="text-[10px] text-gray-500 mt-1.5">Your wallet must already hold the full amount of the dearest hotel you pick.</p>}
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

      <button type="submit" disabled={submitting || !pricing || !validDateRange || (!!houseRulesUrl && !rulesAcknowledged) || (laneInfo?.lane === "express" && !arrivalTime)}
        className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
        {submitting
          ? (isInstant ? "Confirming your booking..." : "Sending your request...")
          : isInstant
            ? `⚡ Book now — pay ${pricing ? formatNaira(pricing.real_total_guest_pays) : ""} from wallet`
            : alsoAsk.length > 0
              ? `Ask ${alsoAsk.length + 1} hotels at once — nothing is charged now`
              : "Send request — nothing is charged now"}
      </button>
    </form>
  );
}
