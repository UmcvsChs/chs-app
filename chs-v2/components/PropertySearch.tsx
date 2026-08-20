"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { NIGERIAN_STATES, LGA_BY_STATE, AREAS_BY_LGA } from "@/lib/geoData";
import { PROPERTY_TYPE_CATEGORIES } from "@/types/propertyTypes";
import { Property } from "@/types/property";

// The real, complete "power search" — restored, found genuinely
// reduced compared to the original's full search modal (purpose,
// location cascade, landmark, price range, specification, and a real
// saved-search/notify-me feature were all missing). Rebuilt matching
// the original's real structure, using the same real geographic and
// property-type data already proven elsewhere in the app.

export interface SearchFilters {
  purpose: string;
  state: string;
  lga: string;
  area: string;
  landmark: string;
  minPrice: string;
  maxPrice: string;
  propertyType: string;
  minBedrooms: string;
}

const EMPTY_FILTERS: SearchFilters = {
  purpose: "rent", state: "", lga: "", area: "", landmark: "",
  minPrice: "", maxPrice: "", propertyType: "", minBedrooms: "",
};

const PURPOSES = [
  { value: "rent", label: "To Rent" },
  { value: "sale", label: "To Buy" },
  { value: "lease", label: "To Lease" },
  { value: "hire", label: "To Hire" },
];

const BEDROOM_OPTIONS = ["Any", "1+", "2+", "3+", "4+"];

// A real, complete, flattened list of every specific property type —
// reusing the exact same comprehensive categories already built for
// the listing form, so a search here genuinely matches what an owner
// actually selected when listing.
const ALL_PROPERTY_TYPES = PROPERTY_TYPE_CATEGORIES.flatMap((c) => c.options);

export function applyPropertyFilters(properties: Property[], filters: SearchFilters | null): Property[] {
  if (!filters) return properties;
  return properties.filter((p) => {
    if (filters.purpose && p.purpose !== filters.purpose) return false;
    if (filters.state && p.location_state !== filters.state) return false;
    if (filters.lga && p.location_lga !== filters.lga) return false;
    if (filters.area && p.location_area !== filters.area) return false;
    if (filters.landmark && !(p.description || "").toLowerCase().includes(filters.landmark.toLowerCase()) && !(p.location_area || "").toLowerCase().includes(filters.landmark.toLowerCase())) return false;
    if (filters.minPrice && p.price < parseInt(filters.minPrice.replace(/\D/g, ""), 10)) return false;
    if (filters.maxPrice && p.price > parseInt(filters.maxPrice.replace(/\D/g, ""), 10)) return false;
    if (filters.propertyType && p.property_type !== filters.propertyType) return false;
    if (filters.minBedrooms && filters.minBedrooms !== "Any") {
      const min = parseInt(filters.minBedrooms, 10);
      if (!p.bedrooms || p.bedrooms < min) return false;
    }
    return true;
  });
}

export default function PropertySearch({
  onResults,
  forceOpen,
  onOpenHandled,
}: {
  onResults: (filters: SearchFilters | null) => void;
  forceOpen?: boolean;
  onOpenHandled?: () => void;
}) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Genuinely external signal from the parent — forceOpen is a
    // one-shot instruction to open the panel, acknowledged via
    // onOpenHandled so the parent can reset it. Calling that callback
    // during render (the "pure" alternative) would itself be a side
    // effect on the parent, so this stays an effect.
    if (forceOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
      onOpenHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceOpen]);

  function applySearch() {
    onResults(filters);
    setOpen(false);
  }

  function clearSearch() {
    setFilters(EMPTY_FILTERS);
    onResults(null);
  }

  async function saveCurrentSearch() {
    if (!session) return;
    await supabase.from("saved_searches").insert({
      user_id: session.user.id,
      purpose: filters.purpose || null,
      state: filters.state || null,
      lga: filters.lga || null,
      area: filters.area || null,
      min_price: filters.minPrice ? parseInt(filters.minPrice.replace(/\D/g, ""), 10) : null,
      max_price: filters.maxPrice ? parseInt(filters.maxPrice.replace(/\D/g, ""), 10) : null,
      property_type: filters.propertyType || null,
      min_bedrooms: filters.minBedrooms || null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="px-4 py-2 bg-white border-b border-gray-100">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center py-2 text-xs font-semibold text-chs-charcoal"
      >
        <span>🔍 Search &amp; filter</span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-3 pb-3">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">🏠 What are you looking for?</p>
            <div className="grid grid-cols-4 gap-1.5">
              {PURPOSES.map((p) => (
                <button key={p.value} onClick={() => setFilters({ ...filters, purpose: p.value })}
                  className={`py-2 rounded-lg text-[10px] font-bold ${filters.purpose === p.value ? "bg-chs-red text-white" : "bg-gray-100 text-gray-600"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">📍 Location</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select value={filters.state} onChange={(e) => setFilters({ ...filters, state: e.target.value, lga: "", area: "" })}
                className="px-2.5 py-2 rounded-lg border border-gray-200 text-xs bg-white">
                <option value="">Any state</option>
                {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filters.lga} onChange={(e) => setFilters({ ...filters, lga: e.target.value, area: "" })}
                className="px-2.5 py-2 rounded-lg border border-gray-200 text-xs bg-white">
                <option value="">Any LGA</option>
                {(LGA_BY_STATE[filters.state] || []).map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <select value={filters.area} onChange={(e) => setFilters({ ...filters, area: e.target.value })}
              className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs bg-white">
              <option value="">Any area / neighbourhood</option>
              {(AREAS_BY_LGA[filters.lga] || []).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">📌 Search near a landmark</p>
            <input type="text" value={filters.landmark} onChange={(e) => setFilters({ ...filters, landmark: e.target.value })}
              placeholder="e.g. Air Force Base Mando, NNPC filling station" className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs" />
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">💰 Price range (₦)</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                placeholder="Minimum" className="px-2.5 py-2 rounded-lg border border-gray-200 text-xs" />
              <input type="text" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                placeholder="Maximum" className="px-2.5 py-2 rounded-lg border border-gray-200 text-xs" />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">🏠 Specification</p>
            <select value={filters.propertyType} onChange={(e) => setFilters({ ...filters, propertyType: e.target.value })}
              className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs bg-white mb-2">
              <option value="">Any type</option>
              {ALL_PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filters.minBedrooms} onChange={(e) => setFilters({ ...filters, minBedrooms: e.target.value })}
              className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs bg-white">
              {BEDROOM_OPTIONS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>

          <button onClick={applySearch} className="w-full py-3 rounded-full bg-chs-red text-white text-xs font-bold">
            Search properties
          </button>
          {session && (
            <button onClick={saveCurrentSearch} className="w-full py-2.5 rounded-full border-2 border-chs-red text-chs-red text-xs font-bold">
              {saved ? "✓ Search saved!" : "💾 Save this search — notify me of new matches"}
            </button>
          )}
          <button onClick={clearSearch} className="w-full py-2 text-[11px] font-semibold text-gray-400">
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
