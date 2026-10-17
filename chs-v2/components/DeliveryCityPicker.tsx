"use client";

import type { NgCity } from "@/lib/delivery";

export default function DeliveryCityPicker({ cities, cityId, onChange, compact }: { cities: NgCity[]; cityId: number | null; onChange: (id: number) => void; compact?: boolean }) {
  const states = Array.from(new Set(cities.map((c) => c.state)));
  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "bg-chs-amber-light rounded-xl px-3 py-2"}`}>
      <span className="text-sm" aria-hidden>📍</span>
      <label className="text-[11px] font-semibold text-chs-charcoal shrink-0">Deliver to</label>
      <select value={cityId ?? ""} onChange={(e) => e.target.value && onChange(Number(e.target.value))}
        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
        <option value="">Choose your city…</option>
        {states.map((s) => (
          <optgroup key={s} label={s}>
            {cities.filter((c) => c.state === s).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
