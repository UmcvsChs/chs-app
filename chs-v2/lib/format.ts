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
