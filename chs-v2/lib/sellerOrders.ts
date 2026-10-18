import type { Shipment } from "@/components/ShipmentCard";

export const METHOD_LABEL: Record<string, string> = { own_rider: "Seller's own rider / vehicle", courier: "Courier / transport company", chs_centre: "CHS collection centre" };

// Which stage a parcel is at, in the seller's own words.
export type Stage = "new" | "packed" | "onway" | "delivered" | "problem" | "cancelled";
export function stageOf(s: Shipment): Stage {
  if (s.status === "problem") return "problem";
  if (s.status === "cancelled") return "cancelled";
  if (s.status === "delivered") return "delivered";
  if (s.status === "awaiting_dispatch") return s.packed_at ? "packed" : "new";
  return "onway";
}
export const STAGE_LABEL: Record<Stage, string> = { new: "New order — pack it", packed: "Packed — dispatch it", onway: "On the way to the buyer", delivered: "Delivered", problem: "Problem reported", cancelled: "Cancelled" };
export const STAGE_STYLE: Record<Stage, string> = {
  new: "bg-chs-red text-white", packed: "bg-chs-amber-light text-chs-amber-dark", onway: "bg-blue-50 text-blue-700", delivered: "bg-green-50 text-green-700", problem: "bg-red-50 text-chs-red", cancelled: "bg-gray-100 text-gray-500",
};

// Money for one parcel, from the seller's point of view.
export function parcelMoney(s: Shipment) {
  let gross = 0, commission = 0, paid = 0, heldNet = 0, releasedNet = 0, refunded = 0;
  for (const it of s.items) {
    const c = Number(it.vendor_commission || 0), a = Number(it.amount);
    gross += a; commission += c;
    if (it.payment_status === "released") { releasedNet += Number(it.vendor_paid ?? a - c); paid += 1; }
    else if (it.payment_status === "refunded") refunded += a;
    else heldNet += a - c;
  }
  return { gross, commission, net: gross - commission, heldNet, releasedNet, refunded, paid };
}
