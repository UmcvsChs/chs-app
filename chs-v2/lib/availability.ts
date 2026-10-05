// Pure date and availability rules shared by the guest booking calendar and
// the host console. No React and no network in here, so every rule can be
// tested on its own.
//
// Nights model: a booking from 9 Oct to 11 Oct occupies the nights of the 9th
// and 10th. The check-out day is free for the next guest to arrive. So a date
// is shown as "available" when the NIGHT beginning on that date is free, and
// a guest may check out on a date whose night is taken (that is simply the day
// the next guest arrives).

export type DayState = "available" | "requested" | "booked";

export interface AvailabilityDay {
  date: string; // YYYY-MM-DD
  state: DayState;
  free_units: number;
  total_units: number;
}

export type DayMap = Record<string, AvailabilityDay>;

const pad = (n: number) => String(n).padStart(2, "0");

// Local-calendar dates only — never toISOString(), which shifts the day for
// anyone east of UTC (Nigeria is UTC+1) around midnight.
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((parseISO(checkOut).getTime() - parseISO(checkIn).getTime()) / 86400000);
}

export function indexDays(days: AvailabilityDay[]): DayMap {
  const map: DayMap = {};
  for (const d of days) map[d.date] = d;
  return map;
}

// Cells for a month grid, Monday first. null = blank padding before the 1st.
export function buildMonthCells(year: number, month0: number): (string | null)[] {
  const first = new Date(year, month0, 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(new Date(year, month0, d)));
  return cells;
}

export function isNightFree(map: DayMap, iso: string): boolean {
  return map[iso]?.state === "available";
}

// A stay can START on a date that is today or later and whose night is free.
export function canStartStay(map: DayMap, iso: string, today: string): boolean {
  return iso >= today && isNightFree(map, iso);
}

// The furthest check-out date for a stay starting on checkIn: the first date
// whose night is NOT free (check-out is allowed on it), or the day after the
// last known date if everything up to the horizon is free.
export function maxCheckOut(map: DayMap, checkIn: string): string {
  let cursor = addDays(checkIn, 1);
  // The check-in night itself must be free.
  if (!isNightFree(map, checkIn)) return checkIn;
  for (let i = 0; i < 400; i++) {
    if (!map[cursor]) return cursor; // beyond what we know — cannot extend further
    if (!isNightFree(map, cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

export function isValidStay(map: DayMap, checkIn: string, checkOut: string): boolean {
  if (!checkIn || !checkOut || checkOut <= checkIn) return false;
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
    if (!isNightFree(map, d)) return false;
  }
  return true;
}

// Fewest rooms free on any night of the stay (so "only 1 room left" is honest).
export function minFreeUnits(map: DayMap, checkIn: string, checkOut: string): number {
  let min = Infinity;
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
    min = Math.min(min, map[d]?.free_units ?? 0);
  }
  return min === Infinity ? 0 : min;
}

export interface Selection {
  checkIn: string;
  checkOut: string;
}

// What happens when the guest taps a date. Returns the new selection, or null
// when the tap should be ignored (an unavailable date).
export function nextSelection(
  map: DayMap, today: string, mode: "range" | "single", current: Selection, tapped: string
): Selection | null {
  if (mode === "single") {
    return canStartStay(map, tapped, today) ? { checkIn: tapped, checkOut: addDays(tapped, 1) } : null;
  }
  const { checkIn, checkOut } = current;
  const choosingCheckOut = !!checkIn && !checkOut;

  if (choosingCheckOut) {
    if (tapped === checkIn) return { checkIn: "", checkOut: "" }; // tap again to clear
    if (tapped > checkIn && tapped <= maxCheckOut(map, checkIn)) return { checkIn, checkOut: tapped };
    if (canStartStay(map, tapped, today)) return { checkIn: tapped, checkOut: "" }; // restart from here
    return null;
  }
  // A full stay is already chosen: tapping further dates ADJUSTS it, the way hotel
  // sites do. (Before, any tap here silently threw the stay away and started a new
  // one with only a check-in, so tapping several dates in a row left a single date
  // highlighted and it looked as though the calendar refused to select more than one.)
  if (checkIn && checkOut) {
    if (tapped === checkIn) return { checkIn: "", checkOut: "" };          // tap the check-in again to clear
    if (tapped === checkOut) return { checkIn, checkOut };                  // already the check-out
    if (tapped > checkIn && tapped < checkOut) return { checkIn, checkOut: tapped };   // shorten the stay
    if (tapped > checkOut) {
      if (tapped <= maxCheckOut(map, checkIn)) return { checkIn, checkOut: tapped };   // extend the stay
      return canStartStay(map, tapped, today) ? { checkIn: tapped, checkOut: "" } : null;   // a taken night is in the way: start afresh
    }
    // earlier than the check-in: move the check-in back if the whole stay is still free
    if (!canStartStay(map, tapped, today)) return null;
    return isValidStay(map, tapped, checkOut) ? { checkIn: tapped, checkOut } : { checkIn: tapped, checkOut: "" };
  }
  // No dates yet: start a stay.
  return canStartStay(map, tapped, today) ? { checkIn: tapped, checkOut: "" } : null;
}
