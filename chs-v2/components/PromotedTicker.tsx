import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/format";

// Real, new component built directly from a client-provided design
// reference (a sister app's own promoted-goods ticker): a thin,
// continuously auto-scrolling strip showing what's currently, really
// promoted — connected to the same real, existing promotion system
// (property_promotions + the older promoted_until tier), not a
// separate paid product. A property enters this strip the moment a
// real promotion goes live, and leaves it the moment that promotion
// ends — no separate step for the owner.
//
// A pure CSS animation (no client JS): the real list is duplicated
// once and the combined strip is translated from 0 to -50%, which
// makes the seam between the duplicate and the original invisible,
// producing a genuinely seamless, continuous loop at a slow, readable
// speed — matching "low speed that the goods or the message are
// readable" from the reference.
export default async function PromotedTicker() {
  const supabase = await createClient();

  const now = new Date().toISOString();

  const [creditPromoted, legacyPromoted] = await Promise.all([
    supabase
      .from("property_promotions")
      .select("properties(id, title, price, purpose, location_area, location_state)")
      .eq("is_active", true),
    supabase
      .from("properties")
      .select("id, title, price, purpose, location_area, location_state")
      .gt("promoted_until", now)
      .eq("verification_status", "verified"),
  ]);

  type TickerItem = { id: string; title: string; price: number; purpose: string; location_area: string | null; location_state: string | null };

  const fromCredit: TickerItem[] = (creditPromoted.data ?? [])
    .map((p) => (Array.isArray(p.properties) ? p.properties[0] : p.properties))
    .filter((p): p is TickerItem => !!p);
  const fromLegacy: TickerItem[] = (legacyPromoted.data ?? []) as TickerItem[];

  const seen = new Set<string>();
  const items = [...fromCredit, ...fromLegacy].filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // A real, honest empty state: no live promotions right now, so
  // nothing renders rather than showing a broken or empty strip.
  if (items.length === 0) return null;

  const purposeLabel: Record<string, string> = {
    sale: "For Sale", rent: "To Rent", lease: "To Lease", shortlet: "Shortlet", hire: "For Hire",
  };

  const renderItems = (keyPrefix: string) =>
    items.map((p) => (
      <Link
        key={`${keyPrefix}-${p.id}`}
        href={`/property/${p.id}`}
        className="inline-flex items-center gap-1.5 px-4 shrink-0 text-[11px] font-semibold text-white/90 hover:text-white"
      >
        <span className="text-amber-400">★</span>
        {p.title} — {formatNaira(p.price)}
        {(p.purpose === "rent" || p.purpose === "lease") && <span className="text-white/50">/yr</span>}
        <span className="text-white/40">·</span>
        <span className="text-white/60">{purposeLabel[p.purpose] || p.purpose}</span>
        {p.location_area && <span className="text-white/40">· {p.location_area}</span>}
      </Link>
    ));

  return (
    <div className="bg-chs-charcoal overflow-hidden py-2 border-y border-white/10">
      <div className="flex w-max animate-[chs-ticker-scroll_45s_linear_infinite] hover:[animation-play-state:paused]">
        {renderItems("a")}
        {renderItems("b")}
      </div>
    </div>
  );
}
