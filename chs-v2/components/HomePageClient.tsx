"use client";

import { useState } from "react";
import Link from "next/link";
import { Property, PropertyPurpose } from "@/types/property";
import PropertyCard from "./PropertyCard";
import { useAuth } from "@/contexts/AuthContext";

const PURPOSE_TABS: { value: PropertyPurpose | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sale", label: "For Sale" },
  { value: "rent", label: "For Rent" },
  { value: "lease", label: "For Lease" },
  { value: "hire", label: "For Hire" },
];

export default function HomePageClient({ properties }: { properties: Property[] }) {
  const [activePurpose, setActivePurpose] = useState<PropertyPurpose | "all">("all");
  const { session, profile, signOut, loading } = useAuth();

  const filteredProperties =
    activePurpose === "all"
      ? properties
      : properties.filter((p) => p.purpose === activePurpose);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-chs-steel-blue via-chs-charcoal to-chs-amber text-white px-4 py-5 flex justify-between items-start">
        <div>
          <h1 className="font-serif text-xl font-bold">CHS</h1>
          <p className="text-xs text-white/70">Complete Housing Solutions</p>
        </div>
        <div className="text-xs">
          {loading ? null : session && profile ? (
            <div className="flex items-center gap-2">
              <span className="text-white/80">Hi, {profile.full_name.split(" ")[0]}</span>
              {[profile.role, ...(profile.secondary_roles || [])].includes("owner") && (
                <Link href="/owner" className="bg-white/15 px-3 py-1.5 rounded-full font-semibold">
                  My Properties
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

      <nav className="flex gap-2 overflow-x-auto px-4 py-3 bg-white border-b border-gray-100">
        {PURPOSE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActivePurpose(tab.value)}
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

      <main className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredProperties.length === 0 ? (
          <p className="col-span-full text-center text-sm text-gray-400 py-12">
            No properties found for this filter yet.
          </p>
        ) : (
          filteredProperties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))
        )}
      </main>
    </div>
  );
}
