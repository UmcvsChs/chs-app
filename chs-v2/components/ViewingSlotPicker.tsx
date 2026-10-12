"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Free viewing slots the owner has set for a property. Pick a day, then a time. Times are Lagos wall-clock time.
export interface SlotDay { date: string; slots: string[] }

export function useViewingSlots(propertyId: string) {
  const [state, setState] = useState<{ loading: boolean; hasSlots: boolean; days: SlotDay[] }>({ loading: true, hasSlots: false, days: [] });
  useEffect(() => {
    let live = true;
    supabase.rpc("get_viewing_slots", { p_property: propertyId, p_from: null, p_days: 21 }).then(({ data }) => {
      if (!live) return;
      const d = data as { has_slots: boolean; days: SlotDay[] } | null;
      setState({ loading: false, hasSlots: !!d?.has_slots, days: d?.days ?? [] });
    });
    return () => { live = false; };
  }, [propertyId]);
  return state;
}

const fmtDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export default function ViewingSlotPicker({ days, date, time, onPick }: { days: SlotDay[]; date: string; time: string; onPick: (date: string, time: string) => void }) {
  const [day, setDay] = useState<string>(date || days[0]?.date || "");
  const current = days.find((d) => d.date === day) ?? days[0];
  if (days.length === 0) return <p className="text-xs text-gray-500">No free viewing slots in the next three weeks. Please check back soon.</p>;
  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-1.5">
        {days.map((d) => (
          <button type="button" key={d.date} onClick={() => setDay(d.date)}
            className={`shrink-0 px-2.5 py-1.5 rounded-lg border text-[11px] ${current?.date === d.date ? "bg-chs-charcoal text-white border-chs-charcoal" : "bg-white text-gray-700 border-gray-200"}`}>
            {fmtDay(d.date)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {current?.slots.map((s) => (
          <button type="button" key={s} onClick={() => onPick(current.date, s)}
            className={`px-2.5 py-1.5 rounded-full border text-[11px] font-semibold ${date === current.date && time === s ? "bg-chs-red text-white border-chs-red" : "bg-white text-gray-700 border-gray-200"}`}>
            {fmtTime(s)}
          </button>
        ))}
      </div>
    </div>
  );
}
