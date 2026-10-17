"use client";

import type { DeliveryHint } from "@/lib/delivery";
import { etaText } from "@/lib/delivery";
import { formatNaira } from "@/lib/format";

// Tells the buyer, before they commit, how far the seller is, what delivery roughly costs and when it should arrive.
export default function DeliveryBadge({ hint, big }: { hint: DeliveryHint | undefined; big?: boolean }) {
  if (!hint) return null;
  const far = hint.km > 150;
  const tone = hint.nearby ? "bg-green-50 text-green-800" : far ? "bg-red-50 text-chs-red" : "bg-chs-amber-light text-chs-amber-dark";
  const where = hint.vendor_city ? `${hint.vendor_city}${hint.vendor_state && hint.vendor_state !== hint.vendor_city ? `, ${hint.vendor_state}` : ""}` : "";
  return (
    <div className={`rounded-lg px-2 py-1.5 ${tone} ${big ? "text-xs" : "text-[9px]"} leading-snug`}>
      <p className="font-bold">{hint.nearby ? "📍 Nearby seller" : far ? "🚚 Seller is far from you" : "🚚 Seller is in another town"} · {hint.km <= 10 ? "in your city" : `about ${hint.km} km away`}</p>
      {where && <p>Sold from {where}</p>}
      <p>{hint.mode === "vendor_free" ? "Free delivery by the seller" : `Delivery about ${formatNaira(hint.est_fee)}`} · arrives {etaText(hint.eta_min_days, hint.eta_max_days)}</p>
      {big && !hint.nearby && <p className="mt-0.5 opacity-80">This item travels a long way, so the delivery cost and time above are built into checkout. Prepare for it before you add to cart.</p>}
    </div>
  );
}
