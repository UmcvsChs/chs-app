"use client";

import { useState } from "react";
import Link from "next/link";
import { Property, PropertyPurpose } from "@/types/property";
import PropertyCard from "./PropertyCard";
import DemandRegistryForm from "./DemandRegistryForm";
import NotificationBell from "./NotificationBell";
import PropertySearch, { applyPropertyFilters } from "./PropertySearch";
import DiasporaMode from "./DiasporaMode";
import { useAuth } from "@/contexts/AuthContext";

const PURPOSE_TABS: { value: PropertyPurpose | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sale", label: "For Sale" },
  { value: "rent", label: "For Rent" },
  { value: "lease", label: "For Lease" },
  { value: "hire", label: "For Hire" },
  { value: "shortlet", label: "Shortlet" },
];

export default function HomePageClient({ properties }: { properties: Property[] }) {
  const [activePurpose, setActivePurpose] = useState<PropertyPurpose | "all">("all");
  const [searchFilters, setSearchFilters] = useState<Parameters<typeof applyPropertyFilters>[1]>(null);
  const [diasporaActive, setDiasporaActive] = useState(false);
  const { session, profile, signOut, loading } = useAuth();

  // Both filters genuinely combine — matching the original app's real,
  // tested behaviour, not just the purpose tab or just search alone.
  const purposeFiltered =
    activePurpose === "all"
      ? properties
      : properties.filter((p) => p.purpose === activePurpose);
  const filteredProperties = applyPropertyFilters(purposeFiltered, searchFilters);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-chs-steel-blue via-chs-charcoal to-chs-amber text-white px-4 py-5 flex justify-between items-start">
        <div>
          <h1 className="font-serif text-xl font-bold">CHS</h1>
          <p className="text-xs text-white/70">Complete Housing Solutions</p>
          <Link href="/marketplace" className="text-[10px] text-white/60 underline mt-1 inline-block">
            Visit the Marketplace →
          </Link>
        </div>
        <div className="text-xs">
          {loading ? null : session && profile ? (
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Link href="/profile" className="w-7 h-7 rounded-full bg-white/15 overflow-hidden flex items-center justify-center shrink-0">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="Your profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-white">{profile.full_name.charAt(0).toUpperCase()}</span>
                )}
              </Link>
              <span className="text-white/80">Hi, {profile.full_name.split(" ")[0]}</span>
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

      <PropertySearch onResults={setSearchFilters} />

      <DemandRegistryForm />

      <main className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredProperties.length === 0 ? (
          <p className="col-span-full text-center text-sm text-gray-400 py-12">
            {searchFilters ? "No properties match your search." : "No properties found for this filter yet."}
          </p>
        ) : (
          filteredProperties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))
        )}
      </main>

      <footer className="px-4 py-6 flex justify-center gap-4 text-[11px] text-gray-400 border-t border-gray-100 mt-4">
        <Link href="/about" className="underline">About CHS</Link>
        <Link href="/blog" className="underline">CHS Insights</Link>
        <Link href="/terms" className="underline">Terms & Conditions</Link>
      </footer>
    </div>
  );
}
