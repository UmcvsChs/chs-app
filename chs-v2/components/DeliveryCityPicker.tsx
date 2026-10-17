"use client";

import { useMemo, useState } from "react";
import type { NgCity } from "@/lib/delivery";
import { AREAS_BY_LGA } from "@/lib/geoData";

const norm = (x: string) => x.split("\u2019").join("'").toLowerCase();
const AREA_KEYS = new Map(Object.keys(AREAS_BY_LGA).map((k) => [norm(k), k]));

// Three steps so a buyer or seller anywhere in Nigeria can say exactly where they are:
// State, then Local Government Area, then the neighbourhood (Barnawa, Kakuri, Kawo...).
export default function DeliveryCityPicker({ cities, cityId, area, onChange, compact }: { cities: NgCity[]; cityId: number | null; area: string | null; onChange: (id: number, area: string | null) => void; compact?: boolean }) {
  const states = useMemo(() => Array.from(new Set(cities.map((c) => c.state))).sort((a, b) => a.localeCompare(b)), [cities]);
  const current = cities.find((c) => c.id === cityId);
  const [pickedState, setPickedState] = useState<string>("");
  const state = pickedState || current?.state || "";
  const lgas = useMemo(() => cities.filter((c) => c.state === state).sort((a, b) => a.name.localeCompare(b.name)), [cities, state]);
  const neighbourhoods = useMemo(() => {
    if (!current) return [];
    const key = AREA_KEYS.get(norm(current.name));
    return key ? AREAS_BY_LGA[key] : [];
  }, [current]);
  const sel = "min-w-0 px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white";
  return (
    <div className={compact ? "" : "bg-chs-amber-light rounded-xl px-3 py-2"}>
      <div className="flex items-center gap-2">
        <span className="text-sm" aria-hidden>📍</span>
        <label className="text-[11px] font-semibold text-chs-charcoal shrink-0">Deliver to</label>
        <select value={state} onChange={(e) => setPickedState(e.target.value)} className={`flex-1 ${sel}`} aria-label="State">
          <option value="">Choose your state…</option>
          {states.map((s) => <option key={s} value={s}>{s === "FCT" ? "FCT (Abuja)" : s}</option>)}
        </select>
        <select value={current && current.state === state ? current.id : ""} onChange={(e) => e.target.value && onChange(Number(e.target.value), null)} disabled={!state} className={`flex-1 ${sel} disabled:opacity-50`} aria-label="Local government area">
          <option value="">{state ? "Your LGA…" : "Choose a state first"}</option>
          {lgas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {current && neighbourhoods.length > 0 && (
        <div className="flex items-center gap-2 mt-1.5 pl-6">
          <label className="text-[11px] font-semibold text-chs-charcoal shrink-0">Area</label>
          <select value={area || ""} onChange={(e) => onChange(current.id, e.target.value || null)} className={`flex-1 ${sel}`} aria-label="Neighbourhood">
            <option value="">Choose your neighbourhood…</option>
            {neighbourhoods.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      )}
      <p className="text-[9px] text-gray-500 mt-1 pl-6">All states and the FCT, every LGA, and the neighbourhoods inside it.</p>
    </div>
  );
}
