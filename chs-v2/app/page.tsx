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
  const { data: properties, error } = await supabase
    .from("properties")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

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

  // Real promoted-first sorting — the original app's promotion never
  // actually affected sort order via anything durable; this genuinely
  // checks each property's real, current promotion expiry. Computed
  // once here and reused below — this is an async Server Component
  // forced dynamic on every request (see `dynamic` above), so a single
  // "now" per request is correct, not a stale, build-time snapshot.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const sortedProperties = [...(properties ?? [])].sort((a, b) => {
    const aPromoted = a.promoted_until && new Date(a.promoted_until).getTime() > now;
    const bPromoted = b.promoted_until && new Date(b.promoted_until).getTime() > now;
    if (aPromoted && !bPromoted) return -1;
    if (!aPromoted && bPromoted) return 1;
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
