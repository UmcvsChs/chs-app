"use client";

import { useState } from "react";
import { Property } from "@/types/property";
import { NIGERIAN_STATES, LGA_BY_STATE } from "@/lib/geoData";

const PROPERTY_TYPES = ["Apartment", "Duplex", "Bungalow", "Terrace", "Land", "Commercial"];

interface SearchFilters {
  propertyType: string;
  state: string;
  lga: string;
  minBedrooms: string;
}

const EMPTY_FILTERS: SearchFilters = { propertyType: "", state: "", lga: "", minBedrooms: "" };

export default function PropertySearch({
  onResults,
}: {
  onResults: (filters: SearchFilters | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [activeFilters, setActiveFilters] = useState<SearchFilters | null>(null);

  function applySearch() {
    setActiveFilters(filters);
    onResults(filters);
    setOpen(false);
  }

  function clearSearch() {
    setFilters(EMPTY_FILTERS);
    setActiveFilters(null);
    onResults(null);
  }

  return (
    <div className="px-4 py-2 bg-white border-b border-gray-100">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center py-2 text-xs font-semibold text-chs-charcoal"
      >
        <span>🔍 Search properties</span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-2 pb-3">
          <select
            value={filters.propertyType}
            onChange={(e) => setFilters({ ...filters, propertyType: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white"
          >
            <option value="">Any property type</option>
            {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select
            value={filters.state}
            onChange={(e) => setFilters({ ...filters, state: e.target.value, lga: "" })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white"
          >
            <option value="">Any state</option>
            {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Deliberately never auto-selects a real LGA as a silent
              default — the original app had a real, documented bug
              where the LGA dropdown quietly defaulted to whichever LGA
              came first alphabetically and treated that as an explicit
              filter, excluding almost every property from every default
              search. "Any LGA" is the genuine, explicit default here. */}
          <select
            value={filters.lga}
            onChange={(e) => setFilters({ ...filters, lga: e.target.value })}
            disabled={!filters.state}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white disabled:opacity-50"
          >
            <option value="">Any LGA in this state</option>
            {(LGA_BY_STATE[filters.state] || []).map((lga) => <option key={lga} value={lga}>{lga}</option>)}
          </select>

          <select
            value={filters.minBedrooms}
            onChange={(e) => setFilters({ ...filters, minBedrooms: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white"
          >
            <option value="">Any number of bedrooms</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+ bedrooms</option>)}
          </select>

          <button
            onClick={applySearch}
            className="w-full py-2.5 rounded-full bg-chs-red text-white text-xs font-semibold"
          >
            Search
          </button>
        </div>
      )}

      {activeFilters && (
        <div className="flex items-center justify-between bg-chs-amber-light rounded-lg px-3 py-2 mt-1">
          <span className="text-[11px] text-chs-amber-dark font-semibold">Showing search results</span>
          <button onClick={clearSearch} className="text-[11px] font-bold text-chs-red">
            Clear ✕
          </button>
        </div>
      )}
    </div>
  );
}

// A genuine, correctly-working filter function — checked directly
// against the exact real fields on a property, including the
// structured bedrooms field, not a text-parsing guess.
export function applyPropertyFilters(properties: Property[], filters: SearchFilters | null): Property[] {
  if (!filters) return properties;

  return properties.filter((p) => {
    if (filters.propertyType && p.property_type !== filters.propertyType) return false;
    if (filters.state && p.location_state !== filters.state) return false;
    if (filters.lga && p.location_lga !== filters.lga) return false;
    if (filters.minBedrooms && (p.bedrooms || 0) < parseInt(filters.minBedrooms)) return false;
    return true;
  });
}
