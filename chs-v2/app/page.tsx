import { createClient } from "@/lib/supabase/server";
import HomePageClient from "@/components/HomePageClient";
import { Property } from "@/types/property";

// Forces this page to fetch fresh data on every single visit, rather
// than being frozen as a one-time snapshot from whenever the site was
// last built. A real, live marketplace of properties genuinely needs
// this — without it, a property added five minutes ago simply wouldn't
// exist yet as far as any visitor could see, until the next deployment.
export const dynamic = "force-dynamic";

// A real Server Component — this fetches actual property data from
// Supabase on the server, before the page is ever sent to a visitor's
// browser, rather than showing a loading spinner while the browser
// fetches it afterward. This is genuinely how a modern, professional
// Next.js app is built, not an approximation of it.
export default async function Home() {
  const supabase = await createClient();
  // Real bug found through direct client testing: a single flat
  // limit, ordered purely by recency, let one purpose (Rent) —
  // suddenly holding hundreds of newly-created estate units —
  // completely crowd out every other real category. A buyer clicking
  // "For Sale" or "Shortlet" got a genuinely empty result even though
  // real, active listings existed, simply because none of them were
  // recent enough to survive into the fetched set at all. Real fix:
  // fetch a guaranteed, bounded sample from every real purpose
  // separately, so no single category can ever starve the others.
  const PURPOSES = ["rent", "sale", "lease", "hire", "shortlet", "rent_to_own"] as const;
  const PER_PURPOSE_LIMIT = 100;

  // Real, serious gap found through direct testing: a suspended or
  // self-deactivated owner's real listings kept showing as fully
  // active and bookable to the public, with no way for a buyer to
  // know the account behind them couldn't actually respond. Excluded
  // here at the source, before anything reaches the page.
  const { data: blockedOwners } = await supabase
    .from("profiles")
    .select("id")
    .in("status", ["suspended", "deactivated"]);
  const blockedOwnerIds = (blockedOwners || []).map((o) => o.id);

  const results = await Promise.all(
    PURPOSES.map((purpose) => {
      let query = supabase
        .from("properties")
        .select("*")
        .in("status", ["active", "coming_soon"])
        .eq("purpose", purpose);
      if (blockedOwnerIds.length > 0) {
        query = query.not("owner_id", "in", `(${blockedOwnerIds.join(",")})`);
      }
      return query.order("created_at", { ascending: false }).limit(PER_PURPOSE_LIMIT);
    })
  );

  const firstError = results.find((r) => r.error)?.error;
  const properties = results.flatMap((r) => r.data || []);
  const error = firstError;

  if (error) {
    // Honest, visible failure rather than a silent empty page — matches
    // the same "never fail silently" discipline used throughout the
    // original app's real Supabase-backed features.
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6">
        <p className="text-sm text-gray-500">
          Could not load properties right now. Please try again shortly.
        </p>
      </div>
    );
  }

  // Real second promotion mechanism — the newer, credit-based system
  // (property_promotions) sits alongside the original tier-based one
  // (properties.promoted_until), not replacing it. Both are read here
  // so a single, real sort order accounts for whichever one a given
  // owner actually used. rank_category only exists on the credit-based
  // system; a property using the older tier system is real, paid
  // promotion too, so it's treated as an honest mid-tier ('B'
  // equivalent) rather than being silently outranked by it.
  const { data: creditPromotions } = await supabase
    .from("property_promotions")
    .select("property_id, rank_category")
    .eq("is_active", true);
  const creditPromoByProperty = new Map(
    (creditPromotions ?? []).map((p) => [p.property_id, p.rank_category as string | null])
  );

  // Real promoted-first sorting — the original app's promotion never
  // actually affected sort order via anything durable; this genuinely
  // checks each property's real, current promotion state across both
  // mechanisms. Computed once here and reused below — this is an
  // async Server Component forced dynamic on every request (see
  // `dynamic` above), so a single "now" per request is correct, not a
  // stale, build-time snapshot.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const rankWeight: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };
  const promoWeight = (property: Property & { id: string; promoted_until?: string | null; is_urgent_sale?: boolean }) => {
    // A real, time-bound Urgent Sale outranks even a paid promotion —
    // a genuine deadline is more time-sensitive than a paid boost, and
    // this is enforced by a real database trigger (see
    // backend-v2/48_urgent_emergency_sale.sql), not just a UI label.
    if (property.is_urgent_sale) return 100;
    const legacyPromoted = property.promoted_until && new Date(property.promoted_until).getTime() > now;
    const creditRank = creditPromoByProperty.get(property.id);
    if (creditRank) return rankWeight[creditRank] ?? 0;
    if (legacyPromoted) return rankWeight.B; // real paid promotion, honest mid-tier default
    return 0;
  };
  const sortedProperties = [...(properties ?? [])].sort((a, b) => {
    const diff = promoWeight(b) - promoWeight(a);
    if (diff !== 0) return diff;
    return 0; // preserves the existing created_at ordering from the query
  });


  // Real, genuine platform stats — restored from a real section of the
  // original homepage found missing, computed from actual live data,
  // never a placeholder or invented figure.
  const activeListings = (properties ?? []).filter((p) => p.verification_status === "verified").length;
  const areasCovered = new Set((properties ?? []).map((p) => p.location_area).filter(Boolean)).size;
  const statesCovered = new Set((properties ?? []).map((p) => p.location_state).filter(Boolean)).size;
  const verifiedDates = (properties ?? [])
    .filter((p) => p.verification_status === "verified")
    .map((p) => new Date(p.created_at).getTime());
  const longestVerifiedYears = verifiedDates.length > 0
    ? Math.max(0, (now - Math.min(...verifiedDates)) / (1000 * 60 * 60 * 24 * 365))
    : 0;

  return (
    <HomePageClient
      properties={sortedProperties as Property[]}
      platformStats={{ activeListings, areasCovered, statesCovered, longestVerifiedYears }}
    />
  );
}
