"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { floorName, featureLabel } from "@/lib/roomFloor";

export interface PickUnit { unit_id: string; label: string; floor_no: number | null; features: string[]; room_type_id: string | null; type_name: string | null; max_guests: number | null; free: boolean }

function numberIn(label: string): number { const m = label.match(/(\d+)\s*$/); return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER; }

// The best set of n free rooms to keep a family together: same floor and next to each other where possible; if no single
// floor has enough, the fewest floors apart.
export function suggestTogether(units: PickUnit[], n: number): string[] {
  const free = units.filter((u) => u.free);
  if (n < 1 || free.length < n) return [];
  const sorted = free.slice().sort((a, b) => ((a.floor_no ?? 999) - (b.floor_no ?? 999)) || numberIn(a.label) - numberIn(b.label));
  let best: { ids: string[]; score: number } | null = null;
  for (let i = 0; i + n <= sorted.length; i++) {
    const w = sorted.slice(i, i + n);
    const floors = new Set(w.map((u) => u.floor_no ?? -1));
    const fSpan = (w[w.length - 1].floor_no ?? 0) - (w[0].floor_no ?? 0);
    const nSpan = numberIn(w[w.length - 1].label) - numberIn(w[0].label);
    const score = (floors.size - 1) * 100000 + fSpan * 1000 + (nSpan > 100000 ? 0 : nSpan);
    if (!best || score < best.score) best = { ids: w.map((u) => u.unit_id), score };
  }
  return best ? best.ids : [];
}

// Lets the guest see every room and floor for the chosen dates, pick the exact rooms, or tap "keep us together".
export default function RoomPicker({ propertyId, checkIn, checkOut, roomTypeId, selected, onChange, roomsWanted, onUnits }: {
  propertyId: string; checkIn: string; checkOut: string; roomTypeId: string | null;
  selected: string[]; onChange: (ids: string[]) => void; roomsWanted: number; onUnits?: (u: PickUnit[]) => void;
}) {
  const [units, setUnits] = useState<PickUnit[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.rpc("get_available_units", { p_property_id: propertyId, p_check_in: checkIn, p_check_out: checkOut, p_room_type_id: roomTypeId }).then(({ data }) => {
      if (!alive) return;
      const list = Array.isArray(data) ? (data as unknown as PickUnit[]) : [];
      setUnits(list); setLoaded(true); onUnits?.(list);
      onChange(selected.filter((id) => list.some((u) => u.unit_id === id && u.free)));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, checkIn, checkOut, roomTypeId]);

  const floors = useMemo(() => {
    const m = new Map<number | null, PickUnit[]>();
    units.forEach((u) => { const k = u.floor_no; m.set(k, [...(m.get(k) || []), u]); });
    return Array.from(m.entries()).sort((a, b) => ((a[0] ?? 999) - (b[0] ?? 999)));
  }, [units]);

  if (!loaded || units.length < 2) return null;
  const freeCount = units.filter((u) => u.free).length;

  function toggle(u: PickUnit) {
    if (!u.free) return;
    if (selected.includes(u.unit_id)) onChange(selected.filter((x) => x !== u.unit_id));
    else if (selected.length < 5) onChange([...selected, u.unit_id]);
  }

  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-chs-charcoal">🛏️ Pick your room{roomsWanted > 1 ? "s" : ""} <span className="font-normal text-gray-400">(optional)</span></p>
          <p className="text-[10px] text-gray-500">{freeCount} free for your dates. If you do not pick, the hotel gives you the next free room.</p>
        </div>
        {freeCount >= Math.max(2, roomsWanted) && (
          <button type="button" onClick={() => onChange(suggestTogether(units, Math.max(2, roomsWanted)))} className="shrink-0 text-[10px] font-semibold text-chs-red border border-chs-red rounded-full px-2.5 py-1">
            👨‍👩‍👧 Keep us together
          </button>
        )}
      </div>
      <div className="mt-2 space-y-2">
        {floors.map(([f, list]) => (
          <div key={String(f)}>
            <p className="text-[10px] font-bold text-gray-500 uppercase">{floorName(f)}</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {list.map((u) => {
                const on = selected.includes(u.unit_id);
                return (
                  <button key={u.unit_id} type="button" onClick={() => toggle(u)} disabled={!u.free}
                    className={`px-2.5 py-1.5 rounded-lg border-2 text-[11px] font-semibold text-left ${on ? "border-chs-red bg-chs-amber-light text-chs-charcoal" : u.free ? "border-gray-200 text-chs-charcoal" : "border-gray-100 text-gray-300 line-through"}`}>
                    {u.label}
                    {u.features?.length > 0 && <span className="block text-[9px] font-normal text-gray-500 no-underline">{u.features.map(featureLabel).join(" · ")}</span>}
                    {!u.free && <span className="block text-[9px] font-normal no-underline">taken</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-[10px] text-green-700 font-semibold mt-2">
          ✓ {selected.length} room{selected.length > 1 ? "s" : ""} chosen: {units.filter((u) => selected.includes(u.unit_id)).map((u) => `${u.label}${u.floor_no !== null ? ` (floor ${u.floor_no})` : ""}`).join(", ")}
        </p>
      )}
      <p className="text-[9px] text-gray-400 mt-1">Rooms of the same type only. The host confirms your request with these rooms held for you.</p>
    </div>
  );
}
