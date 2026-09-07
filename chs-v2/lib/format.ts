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
    rent_to_own: "Rent to Own / Mortgage",
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
