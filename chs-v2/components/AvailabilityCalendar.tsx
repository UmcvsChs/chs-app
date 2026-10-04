"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AvailabilityDay, DayMap, addDays, buildMonthCells, canStartStay, indexDays, isValidStay, maxCheckOut,
  minFreeUnits, nextSelection, nightsBetween, parseISO, todayISO,
} from "@/lib/availability";

// The calendar a guest sees BEFORE booking a hotel room, lodge, venue or any
// other bookable place. Built after a direct client observation: in festival
// season a place can be fully booked, and a guest must be able to see that
// before they spend time (or money) on a request.
//
//   green               available (with "n left" when the place has several rooms)
//   amber, dashed       requested — another guest has asked and the host has not
//                       answered yet; it may free up, but cannot be booked now
//   red, crossed out    booked
//
// It shows dates and room counts only — never anyone's name or details.
// A guest may CHECK OUT on a date whose night is taken (that is simply the day
// the next guest arrives), so the first unavailable date after the check-in is
// still tappable while choosing the check-out.

interface Props {
  propertyId: string;
  roomTypeId?: string | null;
  mode: "range" | "single";
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
  singleLabel?: string; // e.g. "event date"
}

const HORIZON_DAYS = 180;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function pretty(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function AvailabilityCalendar({ propertyId, roomTypeId, mode, checkIn, checkOut, onChange, singleLabel }: Props) {
  const [days, setDays] = useState<DayMap>({});
  const [totalUnits, setTotalUnits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [hint, setHint] = useState<string | null>(null);

  const today = useMemo(() => todayISO(), []);

  const latest = useRef({ checkIn, checkOut, onChange, mode });
  useEffect(() => {
    latest.current = { checkIn, checkOut, onChange, mode };
  });

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_property_availability", {
      p_property_id: propertyId, p_from: today, p_days: HORIZON_DAYS, p_room_type_id: roomTypeId || null,
    });
    if (error || !data) {
      setFailed(true);
      setLoading(false);
      return;
    }
    const fresh = indexDays((data.days || []) as AvailabilityDay[]);
    setFailed(false);
    setDays(fresh);
    setTotalUnits(data.total_units || 0);
    setLoading(false);

    // If the dates the guest already picked have just been taken by someone
    // else, say so and clear them — never let them submit a stale choice.
    const sel = latest.current;
    // A single date (an event day) is always exactly one night.
    const selOut = sel.mode === "single" && sel.checkIn ? addDays(sel.checkIn, 1) : sel.checkOut;
    if (sel.checkIn && selOut && Object.keys(fresh).length > 0 && !isValidStay(fresh, sel.checkIn, selOut)) {
      sel.onChange("", "");
      setHint("Those dates were just taken by another guest — please choose again.");
    }
  }, [propertyId, roomTypeId, today]);

  useEffect(() => {
    // (Parents remount this calendar when the room type changes, so it always
    // starts in its loading state.) load() only sets state after its network
    // call returns — the standard data-loading pattern used across this app.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Quietly refresh so dates another guest has just taken show up here too.
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const view = useMemo(() => {
    const base = new Date();
    return new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  }, [monthOffset]);
  const cells = useMemo(() => buildMonthCells(view.getFullYear(), view.getMonth()), [view]);

  const choosingOut = mode === "range" && !!checkIn && !checkOut;
  const limit = choosingOut ? maxCheckOut(days, checkIn) : "";

  function tap(iso: string) {
    setHint(null);
    const next = nextSelection(days, today, mode, { checkIn, checkOut }, iso);
    if (!next) {
      setHint(choosingOut
        ? "That date can't be reached — a night in between is taken. Choose an earlier check-out, or a different start."
        : "That date isn't available.");
      return;
    }
    onChange(next.checkIn, next.checkOut);
  }

  function cellClasses(iso: string, enabled: boolean): string {
    const d = days[iso];
    const base = "relative h-10 rounded-md text-[11px] font-semibold flex flex-col items-center justify-center border transition-colors ";
    const isStart = iso === checkIn;
    const isEnd = iso === checkOut && mode === "range";
    const inRange = !!checkIn && !!checkOut && iso > checkIn && iso < checkOut;
    if (isStart || (isEnd && !!checkOut)) return base + "bg-chs-red text-white border-chs-red";
    if (inRange || (mode === "single" && isStart)) return base + "bg-chs-red/15 text-chs-red border-chs-red/30";
    if (iso < today || !d) return base + "bg-gray-50 text-gray-300 border-transparent cursor-default";
    if (d.state === "booked") return base + "bg-red-50 text-red-400 border-red-200 line-through cursor-default" + (enabled ? " ring-2 ring-chs-red/40" : "");
    if (d.state === "requested") return base + "bg-amber-50 text-amber-700 border-dashed border-amber-300 cursor-default" + (enabled ? " ring-2 ring-chs-red/40" : "");
    return base + "bg-green-50 text-green-800 border-green-200 active:bg-green-100";
  }

  function isEnabled(iso: string): boolean {
    const d = days[iso];
    if (!d || iso < today) return false;
    if (choosingOut) {
      if (iso === checkIn) return true;
      if (iso > checkIn && iso <= limit) return true;
    }
    return canStartStay(days, iso, today);
  }

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const roomsLeft = checkIn && checkOut && totalUnits > 1 ? minFreeUnits(days, checkIn, checkOut) : null;
  const atEnd = monthOffset >= 5;

  if (loading) return <p className="text-xs text-gray-400 py-4 text-center">Loading availability…</p>;
  if (failed) {
    return (
      <div className="bg-chs-amber-light rounded-lg p-3 text-center">
        <p className="text-xs text-gray-600 mb-2">We couldn&apos;t load the availability calendar just now.</p>
        <button type="button" onClick={() => { setLoading(true); load(); }} className="text-xs font-semibold text-chs-red underline">Try again</button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => setMonthOffset((m) => Math.max(0, m - 1))} disabled={monthOffset === 0}
          className="w-8 h-8 rounded-full text-chs-charcoal disabled:opacity-25" aria-label="Previous month">‹</button>
        <p className="text-xs font-bold text-chs-charcoal">{MONTH_NAMES[view.getMonth()]} {view.getFullYear()}</p>
        <button type="button" onClick={() => setMonthOffset((m) => m + 1)} disabled={atEnd}
          className="w-8 h-8 rounded-full text-chs-charcoal disabled:opacity-25" aria-label="Next month">›</button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w) => <p key={w} className="text-center text-[9px] font-semibold text-gray-400">{w}</p>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((iso, i) => {
          if (!iso) return <div key={`b${i}`} />;
          const d = days[iso];
          const enabled = isEnabled(iso);
          const stateLabel = iso < today ? "past" : !d ? "not open for booking yet" : d.state === "available" ? "available" : d.state === "requested" ? "requested by another guest" : "booked";
          return (
            <button key={iso} type="button" disabled={!enabled} onClick={() => tap(iso)}
              aria-label={`${pretty(iso)}, ${stateLabel}`} className={cellClasses(iso, enabled)}>
              <span>{parseISO(iso).getDate()}</span>
              {d && d.state === "available" && totalUnits > 1 && iso >= today && iso !== checkIn && iso !== checkOut && (
                <span className="text-[8px] font-medium text-green-700/80 leading-none">{d.free_units} left</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
        <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="w-3 h-3 rounded bg-green-50 border border-green-200 inline-block" /> Available</span>
        <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="w-3 h-3 rounded bg-amber-50 border border-dashed border-amber-300 inline-block" /> Requested — may reopen</span>
        <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="w-3 h-3 rounded bg-red-50 border border-red-200 inline-block" /> <span className="line-through">Booked</span></span>
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-gray-100">
        {mode === "single" ? (
          checkIn ? (
            <p className="text-xs font-semibold text-chs-charcoal">✓ {singleLabel || "Date"}: {pretty(checkIn)}</p>
          ) : (
            <p className="text-[11px] text-gray-500">Tap a green date to choose your {singleLabel || "date"}.</p>
          )
        ) : checkIn && checkOut ? (
          <p className="text-xs font-semibold text-chs-charcoal">
            ✓ {pretty(checkIn)} → {pretty(checkOut)} · {nights} night{nights !== 1 ? "s" : ""}
            {roomsLeft !== null && roomsLeft > 0 && roomsLeft <= 3 && <span className="text-chs-red"> · only {roomsLeft} room{roomsLeft !== 1 ? "s" : ""} left</span>}
          </p>
        ) : checkIn ? (
          <p className="text-[11px] text-gray-600">Check-in <b>{pretty(checkIn)}</b>. Now tap your check-out date.</p>
        ) : (
          <p className="text-[11px] text-gray-500">Tap a green date for your check-in, then your check-out.</p>
        )}
        {hint && <p className="text-[11px] text-chs-red mt-1">{hint}</p>}
        {Object.keys(days).length > 0 && Object.values(days).every((x) => x.state !== "available") && (
          <p className="text-[11px] text-chs-red font-semibold mt-1">Fully booked for the next {HORIZON_DAYS / 30} months — please try another place.</p>
        )}
      </div>
    </div>
  );
}
