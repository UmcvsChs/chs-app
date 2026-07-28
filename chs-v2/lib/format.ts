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
