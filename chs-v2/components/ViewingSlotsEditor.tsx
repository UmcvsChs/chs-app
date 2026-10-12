"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Owner sets weekly viewing windows (and dates to skip). Visitors then pick a free slot instead of suggesting any time.
interface Win { weekday: number; start: string; end: string; slot_minutes: number }
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function ViewingSlotsEditor({ propertyId }: { propertyId: string }) {
  const [wins, setWins] = useState<Win[] | null>(null);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [newBlock, setNewBlock] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("get_viewing_availability", { p_property: propertyId }).then(({ data }) => {
      const d = data as { windows: Win[]; blocked: string[] } | null;
      setWins(d?.windows ?? []);
      setBlocked(d?.blocked ?? []);
    });
  }, [propertyId]);
  if (!wins) return null;

  const update = (i: number, patch: Partial<Win>) => setWins(wins.map((w, k) => (k === i ? { ...w, ...patch } : w)));
  async function save() {
    setBusy(true); setMsg(null);
    const bad = wins!.find((w) => w.end <= w.start);
    if (bad) { setBusy(false); setMsg(`${DAYS[bad.weekday]}: the end time must be after the start time.`); return; }
    const { error } = await supabase.rpc("set_viewing_availability", { p_property: propertyId, p_windows: wins, p_blocked: blocked });
    setBusy(false);
    setMsg(error ? error.message : wins!.length ? "✓ Saved. Visitors now pick from these times." : "✓ Saved. Visitors can suggest any time again.");
  }

  return (
    <div className="mt-2 bg-gray-50 rounded-lg p-2.5">
      <button type="button" onClick={() => setOpen(!open)} className="text-xs font-bold text-chs-charcoal">
        🗓️ Viewing times {wins.length ? `(${wins.length} set)` : "(not set)"} <span className="text-gray-400 font-normal">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-1.5">
          <p className="text-[10px] text-gray-500 mb-1.5">Set when you can show this property. Visitors pick a free slot, and each slot can be booked once. Leave empty to let visitors suggest any time (at least 12 hours ahead).</p>
          {wins.map((w, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1 mb-1">
              <select value={w.weekday} onChange={(e) => update(i, { weekday: Number(e.target.value) })} className="px-1.5 py-1 rounded border border-gray-200 text-[11px] bg-white">
                {DAYS.map((d, k) => <option key={d} value={k}>{d}</option>)}
              </select>
              <input type="time" value={w.start} onChange={(e) => update(i, { start: e.target.value })} className="px-1.5 py-1 rounded border border-gray-200 text-[11px]" />
              <span className="text-[10px] text-gray-400">to</span>
              <input type="time" value={w.end} onChange={(e) => update(i, { end: e.target.value })} className="px-1.5 py-1 rounded border border-gray-200 text-[11px]" />
              <select value={w.slot_minutes} onChange={(e) => update(i, { slot_minutes: Number(e.target.value) })} className="px-1.5 py-1 rounded border border-gray-200 text-[11px] bg-white">
                {[15, 20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
              <button type="button" onClick={() => setWins(wins.filter((_, k) => k !== i))} className="text-[11px] text-chs-red px-1">✕</button>
            </div>
          ))}
          {wins.length < 14 && (
            <button type="button" onClick={() => setWins([...wins, { weekday: 6, start: "10:00", end: "14:00", slot_minutes: 30 }])} className="text-[11px] font-semibold text-chs-red underline">+ Add a day</button>
          )}
          <div className="mt-2">
            <p className="text-[10px] font-semibold text-gray-600">Dates you are not available</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {blocked.map((b) => (
                <span key={b} className="text-[10px] bg-white border border-gray-200 rounded-full px-2 py-0.5">{b} <button type="button" onClick={() => setBlocked(blocked.filter((x) => x !== b))}>✕</button></span>
              ))}
            </div>
            <div className="flex gap-1 mt-1">
              <input type="date" value={newBlock} onChange={(e) => setNewBlock(e.target.value)} className="px-1.5 py-1 rounded border border-gray-200 text-[11px]" />
              <button type="button" onClick={() => { if (newBlock && !blocked.includes(newBlock)) setBlocked([...blocked, newBlock].sort()); setNewBlock(""); }} className="text-[11px] font-semibold text-chs-red px-1">Add</button>
            </div>
          </div>
          <button type="button" onClick={save} disabled={busy} className="mt-2 w-full py-1.5 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold disabled:opacity-50">{busy ? "Saving..." : "Save viewing times"}</button>
          {msg && <p className="text-[10px] text-gray-600 mt-1">{msg}</p>}
        </div>
      )}
    </div>
  );
}
