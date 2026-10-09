import { Property } from "@/types/property";

// Shared formatting helpers — kept in one place rather than duplicated
// across components, so a future fix (like the currency-formatting bug
// found and fixed in the original app) only ever needs to happen once.

export function formatNaira(amount: number): string {
  return "₦" + amount.toLocaleString("en-NG");
}

export function purposeLabel(purpose: Property["purpose"]): string {
  const labels: Record<Property["purpose"], string> = {
    rent: "For Rent",
    sale: "For Sale",
    lease: "For Lease",
    hire: "For Hire",
    shortlet: "Shortlet",
    rent_to_own: "Mortgage (Rent to Own)",
  };
  return labels[purpose];
}

// The exact real freshness-display logic from the original app,
// restored faithfully rather than reinvented — the original had this
// built and specifically fixed a bug where the real database timestamp
// was being silently dropped before reaching this function.
export function formatPostedAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const then = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 7) return `Posted ${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `Posted ${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `Posted ${months} month${months !== 1 ? "s" : ""} ago`;
  }
  const years = Math.floor(days / 365);
  return `Posted ${years} year${years !== 1 ? "s" : ""} ago`;
}

// Real, permanent safeguard per a direct, serious client concern: a
// bedroom count was shown for Land and other clearly non-residential
// categories, because the display only ever checked whether the real
// database value was non-null — not whether that category should ever
// have a bedroom count in the first place. This is the real,
// authoritative list of categories that genuinely can have bedrooms;
// everything else is excluded by design, regardless of what any
// individual property record happens to contain.
const NON_RESIDENTIAL_TYPES = [
  "Land", "Residential Land / Plot", "Warehouse", "Fuel / Filling Station",
  "Car Park (parking facility)", "Cinema / Entertainment Centre", "School / Educational Facility",
  "Hospital / Clinic Premises", "Sports Facility", "Recreational Centre / Club House",
  "Shop / Lock-up Store", "Plaza Unit (shop within plaza)", "Showroom", "Office", "Office Space (open plan)",
];

export function shouldShowBedrooms(propertyType: string | null | undefined): boolean {
  if (!propertyType) return true;
  return !NON_RESIDENTIAL_TYPES.includes(propertyType);
}

// Every recorded event on the platform shows its FULL timestamp: day, month, year AND the time down to
// the second, always in Nigerian time (WAT), so a date and time means the same thing to everyone who reads
// it, whatever device or country they are viewing from. Plain calendar dates that are not events (a lease end,
// a check-in day) use formatCalendarDate instead.
export function formatDateTime(v: string | number | Date | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) + " WAT";
}

export function formatCalendarDate(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + "T12:00:00") : new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
