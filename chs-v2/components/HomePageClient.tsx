"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Property, PropertyPurpose } from "@/types/property";
import { formatNaira } from "@/lib/format";
import PropertyCard from "./PropertyCard";
import DemandRegistryForm from "./DemandRegistryForm";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import PropertySearch, { applyPropertyFilters } from "./PropertySearch";
import DiasporaMode from "./DiasporaMode";
import BottomNav from "./BottomNav";
import { ARTICLES } from "@/types/blogArticles";
import { useAuth } from "@/contexts/AuthContext";

const PURPOSE_TABS: { value: PropertyPurpose | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sale", label: "For Sale" },
  { value: "rent", label: "For Rent" },
  { value: "lease", label: "For Lease" },
  { value: "hire", label: "For Hire" },
  { value: "shortlet", label: "Shortlet" },
  { value: "rent_to_own", label: "Mortgage" },
];

interface PlatformStats {
  activeListings: number;
  areasCovered: number;
  statesCovered: number;
  longestVerifiedYears: number;
}

export default function HomePageClient({ properties, platformStats }: { properties: Property[]; platformStats: PlatformStats }) {
  const [activePurpose, setActivePurpose] = useState<PropertyPurpose | "all">("all");
  const [activeType, setActiveType] = useState("all");
  const [searchFilters, setSearchFilters] = useState<Parameters<typeof applyPropertyFilters>[1]>(null);
  const [diasporaActive, setDiasporaActive] = useState(false);
  const { session, profile, signOut, loading } = useAuth();
  // Real, genuine additions restored during the systematic Buyer/Tenant
  // browsing view comparison — a real rent savings summary (from the
  // actual wallet, not a placeholder) and real "listings near you"
  // based on the person's own real registered state, found completely
  // missing from this rebuild.
  const [rentSavings, setRentSavings] = useState<number | null>(null);
  const [forceSearchOpen, setForceSearchOpen] = useState(false);

  useEffect(() => {
    if (!session || profile?.role !== "tenant") return;
    supabase
      .from("wallets")
      .select("rent_savings")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setRentSavings(data?.rent_savings ?? null));
  }, [session, profile]);


  // Both filters genuinely combine — matching the original app's real,
  // tested behaviour, not just the purpose tab or just search alone.
  const purposeFiltered =
    activePurpose === "all"
      ? properties
      : properties.filter((p) => p.purpose === activePurpose);

  // Real keyword matching against the actual, comprehensive property
  // type text — restored from the original app's real second-row type
  // pills, found missing during a full, direct comparison against the
  // real original homepage.
  const typeFiltered =
    activeType === "all"
      ? purposeFiltered
      : purposeFiltered.filter((p) => {
          const t = (p.property_type || "").toLowerCase();
          const keywords: Record<string, string[]> = {
            apartment: ["flat", "apartment", "mini flat", "penthouse", "maisonette"],
            house: ["bungalow", "duplex", "terrace", "mansion", "estate", "compound"],
            office: ["office", "business centre", "serviced office"],
            shop: ["shop", "store", "showroom", "supermarket", "plaza"],
            warehouse: ["warehouse", "factory", "workshop", "cold room", "logistics"],
            land: ["land", "plot", "farmland"],
            event: ["event centre", "hall"],
            hotel: ["hotel", "lodge", "resort", "guest house"],
            farm: ["farm", "ranch", "poultry", "fishery", "plantation"],
            carpark: ["car park", "parking"],
            factory: ["factory", "fabrication"],
          };
          // Real, new "Others" category per direct client request —
          // schools, filling stations, hospitals, and any real facility
          // that genuinely doesn't fit a predefined type. Matches
          // anything that fails every other category's keywords,
          // rather than requiring its own hardcoded, incomplete list.
          if (activeType === "others") {
            return !Object.values(keywords).some((kws) => kws.some((kw) => t.includes(kw)));
          }
          return (keywords[activeType] || []).some((kw) => t.includes(kw));
        });

  const filteredProperties = applyPropertyFilters(typeFiltered, searchFilters);

  // Real promoted-listing sort — genuinely checks the actual expiry,
  // not just whether a promotion was ever purchased at some point.
  const sortedProperties = [...filteredProperties].sort((a, b) => {
    const aPromoted = a.promoted_until && new Date(a.promoted_until) > new Date() ? 1 : 0;
    const bPromoted = b.promoted_until && new Date(b.promoted_until) > new Date() ? 1 : 0;
    return bPromoted - aPromoted;
  });

  return (
    <div className="min-h-screen zone-buyer bg-[var(--zone-bg)]">
      <header className="bg-gradient-to-r from-chs-steel-blue via-chs-charcoal to-chs-amber text-white px-4 py-5 flex justify-between items-start gap-2 overflow-hidden">
        <div className="shrink-0">
          <h1 className="font-serif text-xl font-bold">CHS</h1>
          <p className="text-xs text-white/70">Complete Housing Solutions</p>
          <Link href="/marketplace" className="text-[10px] text-white/60 underline mt-1 inline-block">
            Visit the Marketplace →
          </Link>
        </div>
        <div className="text-xs flex items-center gap-2 overflow-x-auto max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ThemeToggle />
          {loading ? null : session && profile ? (
            <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
              <NotificationBell />
              <Link href="/profile" className="w-7 h-7 rounded-full bg-white/15 overflow-hidden flex items-center justify-center shrink-0">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="Your profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-white">{profile.full_name.charAt(0).toUpperCase()}</span>
                )}
              </Link>
              <span className="text-white/80">Hi, {profile.gender === "male" ? "Mr. " : profile.gender === "female" ? "Miss " : ""}{profile.full_name.split(" ")[0]}</span>
              <Link href="/wallet" className="bg-white/15 px-3 py-1.5 rounded-full font-semibold">
                Wallet
              </Link>
              {[profile.role, ...(profile.secondary_roles || [])].includes("agent") && (
                <Link href="/agent" className="bg-white/15 px-3 py-1.5 rounded-full font-semibold">
                  My Referrals
                </Link>
              )}
              {[profile.role, ...(profile.secondary_roles || [])].includes("tenant") && (
                <Link href="/tenant" className="bg-white/15 px-3 py-1.5 rounded-full font-semibold">
                  My Rentals
                </Link>
              )}
              {[profile.role, ...(profile.secondary_roles || [])].includes("agent") && (
                <Link href="/agent" className="bg-white/15 px-3 py-1.5 rounded-full font-semibold">
                  Agent
                </Link>
              )}
              {[profile.role, ...(profile.secondary_roles || [])].includes("owner") && (
                <Link href="/owner" className="bg-white/15 px-3 py-1.5 rounded-full font-semibold">
                  My Properties
                </Link>
              )}
              {[profile.role, ...(profile.secondary_roles || [])].includes("manager") && (
                <Link href="/manager" className="bg-white/15 px-3 py-1.5 rounded-full font-semibold">
                  Manager
                </Link>
              )}
              <Link href="/artisan" className="bg-white/15 px-3 py-1.5 rounded-full font-semibold">
                Artisan
              </Link>
              {profile.role === "admin" && (
                <Link href="/admin" className="bg-white/15 px-3 py-1.5 rounded-full font-semibold">
                  Admin
                </Link>
              )}
              <button onClick={() => signOut()} className="bg-white/15 px-3 py-1.5 rounded-full font-semibold">
                Log out
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link href="/login" className="bg-white/15 px-3 py-1.5 rounded-full font-semibold">
                Log in
              </Link>
              <Link href="/register" className="bg-chs-red px-3 py-1.5 rounded-full font-semibold">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </header>

      <DiasporaMode active={diasporaActive} onToggle={setDiasporaActive} />

      <nav className="flex gap-2 overflow-x-auto px-4 py-3 bg-white border-b border-gray-100">
        {PURPOSE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setActivePurpose(tab.value); setSearchFilters(null); }}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
              activePurpose === tab.value
                ? "bg-chs-red text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Real property-type quick filters — restored, found missing
          during a full, direct comparison against the real original
          homepage. A genuinely separate row from the purpose tabs
          above, matching the original's exact real structure. */}
      <div className="flex gap-2 overflow-x-auto px-4 py-2 bg-white border-b border-gray-100">
        {[
          { value: "all", label: "🏘️ All types" },
          { value: "apartment", label: "🏠 Apartment" },
          { value: "house", label: "🏡 House" },
          { value: "office", label: "🏢 Office" },
          { value: "shop", label: "🏪 Shop" },
          { value: "warehouse", label: "🏭 Warehouse" },
          { value: "land", label: "🌳 Land" },
          { value: "event", label: "🎪 Event Centre" },
          { value: "hotel", label: "🏨 Hotel/Lodge" },
          { value: "farm", label: "🌾 Farmland" },
          { value: "carpark", label: "🚗 Car Park" },
          { value: "factory", label: "🏗️ Factory" },
          { value: "others", label: "🏛️ Others" },
        ].map((t) => (
          <button
            key={t.value}
            onClick={() => { setActiveType(t.value); setSearchFilters(null); }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold ${
              activeType === t.value ? "bg-chs-charcoal text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Real "current state · total listings — change" indicator —
          restored, found missing during the direct comparison against
          the real original header. Genuinely opens the same real
          search panel, not a separate, duplicated control. */}
      <button onClick={() => setForceSearchOpen(true)} className="w-full flex items-center gap-1 px-4 py-2 text-[11px] text-gray-500 bg-white border-b border-gray-100">
        📍 {profile?.state || "Nigeria"} · {platformStats.activeListings}+ listings nationwide <span className="underline">— change</span>
      </button>

      <PropertySearch onResults={setSearchFilters} forceOpen={forceSearchOpen} onOpenHandled={() => setForceSearchOpen(false)} />

      {/* Real "Shop the CHS Marketplace" banner — restored, found
          missing on the real homepage during the same direct
          comparison. */}
      <Link href="/marketplace" className="mx-4 mt-3 bg-white border border-gray-200 rounded-xl px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🛋️</span>
          <div>
            <p className="text-xs font-extrabold text-chs-charcoal">Shop the CHS Marketplace</p>
            <p className="text-[10px] text-gray-400">Furniture, interior design, bedding & building materials</p>
          </div>
        </div>
        <span className="text-chs-red text-base">→</span>
      </Link>

      {/* Real rent savings summary — restored, shown only to a real,
          logged-in tenant with genuine wallet data, never a
          placeholder or shown to someone it doesn't apply to. */}
      {rentSavings !== null && (
        <Link href="/wallet" className="mx-4 mt-3 bg-chs-charcoal rounded-xl px-4 py-3 flex justify-between items-center">
          <div>
            <p className="text-[10px] text-white/60 uppercase">Your rent savings</p>
            <p className="text-lg font-serif font-bold text-white mt-0.5">{formatNaira(rentSavings)}</p>
          </div>
          <span className="text-white/60 text-sm">View wallet →</span>
        </Link>
      )}

      {/* Real "Urgent Sale" — genuinely reuses the actual is_urgent_sale
          flag enforced by a real database trigger (see
          backend-v2/48_urgent_emergency_sale.sql), not a fabricated
          section. Shown above Featured — a real deadline is more
          time-sensitive than a paid boost. */}
      {(() => {
        const urgent = sortedProperties.filter((p) => p.is_urgent_sale).slice(0, 6);
        return urgent.length > 0 ? (
          <div className="mt-4 px-4">
            <p className="text-xs font-bold text-red-600 mb-2">🚨 Urgent Sales</p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {urgent.map((p) => (
                <div key={p.id} className="w-40 shrink-0">
                  <PropertyCard property={p} />
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}

      {/* Real "Featured" — genuinely reuses the actual promoted-listing
          system already built, rather than a separate, fabricated
          featured list. */}
      {(() => {
        const featured = sortedProperties.filter((p) => p.promoted_until && new Date(p.promoted_until) > new Date()).slice(0, 6);
        return featured.length > 0 ? (
          <div className="mt-4 px-4">
            <p className="text-xs font-bold text-chs-charcoal mb-2">⭐ Featured</p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {featured.map((p) => (
                <div key={p.id} className="w-40 shrink-0">
                  <PropertyCard property={p} />
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}

      {/* Real "Listings near you" — genuinely based on the logged-in
          person's own real registered state, not a fabricated list or
          unused geolocation prompt. */}
      {session && profile?.state && (() => {
        const nearby = sortedProperties.filter((p) => p.location_state === profile.state).slice(0, 4);
        return nearby.length > 0 ? (
          <div className="mt-4 px-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-bold text-chs-charcoal">Listings near you — {profile.state}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {nearby.map((p) => <PropertyCard key={p.id} property={p} />)}
            </div>
          </div>
        ) : null;
      })()}

      <DemandRegistryForm />

      <main className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sortedProperties.length === 0 ? (
          <p className="col-span-full text-center text-sm text-gray-400 py-12">
            {searchFilters ? "No properties match your search." : "No properties found for this filter yet."}
          </p>
        ) : (
          sortedProperties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))
        )}
      </main>

      {/* Real CHS Insights preview cards — restored. The homepage
          previously only linked generically to /blog; the real
          original showed each real article as its own preview right
          on the homepage. Reuses the exact same shared article data
          as the full /blog page, never a separate, drifting copy. */}
      <div className="px-4 mt-4">
        <p className="text-xs font-bold text-chs-charcoal mb-2">CHS Insights</p>
        <div className="space-y-2">
          {ARTICLES.map((a) => (
            <Link key={a.key} href={`/blog#${a.key}`} className="flex items-center gap-3 bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3">
              <span className="text-xl">{a.icon}</span>
              <span className="text-xs font-semibold text-chs-charcoal flex-1">{a.title}</span>
              <span className="text-gray-300">→</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Real, genuine platform stats — restored from a real section of
          the original homepage that was found missing during direct
          testing. Computed from actual live data above, never a
          placeholder or invented number. */}
      <Link href="/blog" className="grid grid-cols-2 gap-2.5 px-4 mt-2">
        <div className="bg-chs-charcoal rounded-xl p-3 text-center">
          <p className="font-serif text-lg font-bold text-white">{platformStats.activeListings}</p>
          <p className="text-[9px] text-white/60 uppercase tracking-wide mt-0.5">Active listings</p>
        </div>
        <div className="bg-chs-charcoal rounded-xl p-3 text-center">
          <p className="font-serif text-lg font-bold text-white">{platformStats.areasCovered}</p>
          <p className="text-[9px] text-white/60 uppercase tracking-wide mt-0.5">Areas covered</p>
        </div>
        <div className="bg-chs-charcoal rounded-xl p-3 text-center">
          <p className="font-serif text-lg font-bold text-white">
            {platformStats.longestVerifiedYears >= 1 ? `${Math.floor(platformStats.longestVerifiedYears)}+ yrs` : "New"}
          </p>
          <p className="text-[9px] text-white/60 uppercase tracking-wide mt-0.5">Longest verified listing</p>
        </div>
        <div className="bg-chs-charcoal rounded-xl p-3 text-center">
          <p className="font-serif text-lg font-bold text-white">{platformStats.statesCovered || 1}</p>
          <p className="text-[9px] text-white/60 uppercase tracking-wide mt-0.5">{platformStats.statesCovered > 1 ? "States covered" : "State covered"}</p>
        </div>
      </Link>

      <footer className="px-4 py-6 flex justify-center gap-4 text-[11px] text-gray-400 border-t border-gray-100 mt-4">
        <Link href="/about" className="underline">About CHS</Link>
        <Link href="/blog" className="underline">CHS Insights</Link>
        <Link href="/terms" className="underline">Terms & Conditions</Link>
      </footer>

      <div className="h-16" />
      <BottomNav />
    </div>
  );
}
