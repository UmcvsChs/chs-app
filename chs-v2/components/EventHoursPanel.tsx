"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Rules, fmtDay, fmtTime, fromMin } from "@/lib/eventSessions";

// For an event centre: how it takes bookings (by the hour or by the day, opening hours, the gap needed between two
// events), what is booked in the coming weeks, and a way to block a few hours without closing the whole day.

interface SlotRow { id: string; booking_id: string | null; date: string; start: string; end: string; label: string | null; state: string; kind: "booking" | "block"; guest: string | null; event_type: string | null; booking_status: string | null }

const HALF_HOURS = Array.from({ length: 49 }, (_, i) => fromMin(i * 30));

export default function EventHoursPanel({ propertyId }: { propertyId: string }) {
  const [rules, setRules] = useState<Rules | null>(null);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [bDate, setBDate] = useState("");
  const [bStart, setBStart] = useState("14:00");
  const [bEnd, setBEnd] = useState("18:00");
  const [bNote, setBNote] = useState("");

  const load = useCallback(async () => {
    const [r, s] = await Promise.all([
      supabase.rpc("get_event_settings", { p_property_id: propertyId }),
      supabase.rpc("get_host_event_slots", { p_property_id: propertyId, p_from: null, p_to: null }),
    ]);
    if (r.data) setRules(r.data as Rules);
    setSlots((s.data as SlotRow[]) || []);
  }, [propertyId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function run(p: PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await p;
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg(ok); load();
  }

  if (!rules) return <p className="text-xs text-gray-400">Loading…</p>;
  const set = (p: Partial<Rules>) => setRules({ ...rules, ...p });
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-bold text-chs-charcoal mb-1">How guests book your hall</p>
        <p className="text-[11px] text-gray-500 mb-2">Guests choose one or more sessions (a date with a start and end time). A book launch is one session; a wedding with a traditional ceremony and a reception is two. Another event can use the same day once the first has finished, with time for clean-up and set-up in between.</p>
        <label className="flex items-center gap-2 text-xs mb-2">
          <input type="checkbox" checked={rules.allow_hourly} onChange={(e) => set({ allow_hourly: e.target.checked })} />
          Allow booking by the hour (untick to sell only whole days)
        </label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="block">Opens
            <select value={rules.open} onChange={(e) => set({ open: e.target.value })} className="w-full mt-0.5 px-2 py-2 rounded-lg border border-gray-200 bg-white">
              {HALF_HOURS.slice(0, 48).map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
            </select>
          </label>
          <label className="block">Closes
            <select value={rules.close} onChange={(e) => set({ close: e.target.value })} className="w-full mt-0.5 px-2 py-2 rounded-lg border border-gray-200 bg-white">
              {HALF_HOURS.slice(2).map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
            </select>
          </label>
          <label className="block">Shortest booking (hours)
            <input type="number" min={0.5} step={0.5} value={rules.min_hours} onChange={(e) => set({ min_hours: num(e.target.value) })} className="w-full mt-0.5 px-2 py-2 rounded-lg border border-gray-200" />
          </label>
          <label className="block">Hours that make a full day
            <input type="number" min={1} max={24} value={rules.full_day_hours} onChange={(e) => set({ full_day_hours: num(e.target.value) })} className="w-full mt-0.5 px-2 py-2 rounded-lg border border-gray-200" />
          </label>
          <label className="block">Set-up before an event (minutes)
            <input type="number" min={0} max={480} step={15} value={rules.setup_min} onChange={(e) => set({ setup_min: num(e.target.value) })} className="w-full mt-0.5 px-2 py-2 rounded-lg border border-gray-200" />
          </label>
          <label className="block">Clean-up after an event (minutes)
            <input type="number" min={0} max={480} step={15} value={rules.cleanup_min} onChange={(e) => set({ cleanup_min: num(e.target.value) })} className="w-full mt-0.5 px-2 py-2 rounded-lg border border-gray-200" />
          </label>
          <label className="block col-span-2">Most sessions in one booking
            <input type="number" min={1} max={30} value={rules.max_sessions} onChange={(e) => set({ max_sessions: num(e.target.value) })} className="w-full mt-0.5 px-2 py-2 rounded-lg border border-gray-200" />
          </label>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">If you do not set an hourly price on a hall tier, the hourly rate is that tier&apos;s day price divided by the hours that make a full day. A guest never pays more than the day price for one day.</p>
        <button disabled={busy} onClick={() => run(supabase.rpc("set_event_settings", {
          p_property_id: propertyId, p_allow_hourly: rules.allow_hourly, p_min_hours: rules.min_hours, p_open: rules.open, p_close: rules.close,
          p_setup_min: rules.setup_min, p_cleanup_min: rules.cleanup_min, p_full_day_hours: rules.full_day_hours, p_max_sessions: rules.max_sessions,
        }), "Saved.")} className="w-full mt-2 py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">Save booking rules</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-bold text-chs-charcoal mb-2">Coming up</p>
        {slots.length === 0 && <p className="text-xs text-gray-400">Nothing booked or blocked in the next few months.</p>}
        {slots.map((s) => (
          <div key={s.id} className="flex justify-between items-start gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2 mb-1.5">
            <span>
              <b>{fmtDay(s.date)}</b> · {fmtTime(s.start)} to {fmtTime(s.end)}
              <span className="block text-[10px] text-gray-500">
                {s.kind === "block" ? `Blocked by you${s.label ? `: ${s.label}` : ""}` : `${s.guest || "Guest"}${s.event_type ? ` · ${s.event_type}` : ""}${s.label ? ` · ${s.label}` : ""} · ${s.state === "confirmed" ? "confirmed" : "waiting"}`}
              </span>
            </span>
            {s.kind === "block" && <button disabled={busy} onClick={() => run(supabase.rpc("host_unblock_hours", { p_slot: s.id }), "Unblocked.")} className="text-[10px] text-chs-red whitespace-nowrap">Unblock</button>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-bold text-chs-charcoal mb-1">Block a few hours</p>
        <p className="text-[11px] text-gray-500 mb-2">For your own event or repairs. The rest of the day stays open to guests. To close a whole day, use the calendar.</p>
        <div className="grid grid-cols-3 gap-1.5 text-xs">
          <input type="date" value={bDate} onChange={(e) => setBDate(e.target.value)} className="px-2 py-2 rounded-lg border border-gray-200" />
          <select value={bStart} onChange={(e) => setBStart(e.target.value)} className="px-2 py-2 rounded-lg border border-gray-200 bg-white">{HALF_HOURS.slice(0, 48).map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}</select>
          <select value={bEnd} onChange={(e) => setBEnd(e.target.value)} className="px-2 py-2 rounded-lg border border-gray-200 bg-white">{HALF_HOURS.slice(1).map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}</select>
        </div>
        <input value={bNote} onChange={(e) => setBNote(e.target.value)} maxLength={60} placeholder="Reason (optional)" className="w-full mt-1.5 px-2 py-2 rounded-lg border border-gray-200 text-xs" />
        <button disabled={busy || !bDate} onClick={() => run(supabase.rpc("host_block_hours", { p_property_id: propertyId, p_date: bDate, p_start: bStart, p_end: bEnd, p_note: bNote || null }), "Time blocked.")} className="w-full mt-2 py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">Block these hours</button>
      </div>

      {msg && <p className="text-xs text-green-700">{msg}</p>}
      {err && <p className="text-xs text-chs-red">{err}</p>}
    </div>
  );
}
