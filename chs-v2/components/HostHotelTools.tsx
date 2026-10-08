"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Host tools for one hotel or shortlet listing: Instant Confirm, peak
// pricing, and the hotel's map location (used to check a guest really is
// nearby when they tap "I've arrived").

interface SuggestedPeriod {
  id: string; name: string; starts_on: string; ends_on: string;
  suggested_uplift_pct: number; dates_confirmed: boolean; notes: string | null;
  rate_id: string | null; enabled: boolean; uplift_pct: number | null; min_stay: number | null;
}
interface MyPeak { id: string; name: string; starts_on: string; ends_on: string; uplift_pct: number; min_stay: number | null; active: boolean }
interface PeakSettings { suggested: SuggestedPeriod[]; mine: MyPeak[] }
interface PropFlags { instant_confirm: boolean; latitude: number | null; longitude: number | null; suspended_for_review: boolean; suspension_note: string | null; calendar_confirmed_at: string | null }

export default function HostHotelTools({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(false);
  const [flags, setFlags] = useState<PropFlags | null>(null);
  const [peak, setPeak] = useState<PeakSettings | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [calendarFresh, setCalendarFresh] = useState(false);
  // own event form
  const [evName, setEvName] = useState("");
  const [evStart, setEvStart] = useState("");
  const [evEnd, setEvEnd] = useState("");
  const [evUplift, setEvUplift] = useState("25");
  const [evMin, setEvMin] = useState("");
  // per-suggested-period edits
  const [edits, setEdits] = useState<Record<string, { uplift: string; min: string }>>({});

  const load = useCallback(async () => {
    const [f, p] = await Promise.all([
      supabase.from("properties").select("instant_confirm, latitude, longitude, suspended_for_review, suspension_note, calendar_confirmed_at").eq("id", propertyId).single(),
      supabase.rpc("get_host_peak_settings", { p_property_id: propertyId }),
    ]);
    if (f.data) {
      setFlags(f.data as PropFlags);
      const stamp = (f.data as PropFlags).calendar_confirmed_at;
      setCalendarFresh(!!stamp && Date.now() - new Date(stamp).getTime() < 12 * 3600000);
    }
    if (p.data) setPeak(p.data as PeakSettings);
  }, [propertyId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && !flags) load();
  }, [open, flags, load]);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg(ok);
    load();
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setErr("This device cannot share its location."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => run(() => supabase.rpc("host_set_property_location", { p_property_id: propertyId, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude }), "Location saved. Guests who tap \"I've arrived\" are now checked against it."),
      () => setErr("We could not read your location. Stand at the hotel, allow location access and try again."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  return (
    <div className="mt-2 border border-gray-200 rounded-lg">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex justify-between items-center px-3 py-2 text-xs font-bold text-chs-charcoal">
        <span>⚙️ Instant Confirm, peak pricing &amp; location</span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-4">
          {!flags || !peak ? <p className="text-[11px] text-gray-400">Loading…</p> : (
            <>
              {flags.suspended_for_review && (
                <p className="text-[11px] bg-red-50 text-red-700 rounded-lg px-2 py-1.5">⛔ This listing is suspended. {flags.suspension_note} Please contact CHS.</p>
              )}
              {msg && <p className="text-[11px] text-green-700">{msg}</p>}
              {err && <p className="text-[11px] text-chs-red">{err}</p>}

              <div>
                <p className="text-xs font-bold text-chs-charcoal">⚡ Instant Confirm</p>
                <p className="text-[10px] text-gray-500 mb-1.5">Guests pay and are confirmed at once, with no waiting for you. It switches itself off whenever your calendar has not been confirmed in the last 12 hours, so a guest is never confirmed into a room you have already given away. You are still paid only after the guest arrives and confirms.</p>
                <label className="flex items-center gap-2 text-[11px] text-chs-charcoal">
                  <input type="checkbox" checked={flags.instant_confirm} disabled={busy}
                    onChange={(e) => run(() => supabase.rpc("host_set_instant_confirm", { p_property_id: propertyId, p_on: e.target.checked }), e.target.checked ? "Instant Confirm is on." : "Instant Confirm is off.")} />
                  Confirm bookings instantly
                </label>
                {flags.instant_confirm && (
                  <p className={`text-[10px] mt-1 ${calendarFresh ? "text-green-700" : "text-chs-red"}`}>
                    {calendarFresh ? "✓ Your calendar is fresh, so Instant is live right now." : "Your calendar was not confirmed in the last 12 hours, so guests currently see the normal request flow. Tap “All my calendars are accurate” above to go live."}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-chs-charcoal">📈 Peak pricing</p>
                <p className="text-[10px] text-gray-500 mb-1.5">Charge more on busy nights. Guests see the peak rate and the busy period before they book. The uplift is a percentage added to your nightly price for those nights only.</p>
                {peak.suggested.length > 0 && <p className="text-[10px] font-semibold text-gray-600 mb-1">CHS suggested periods</p>}
                {peak.suggested.map((c) => {
                  const e = edits[c.id] || { uplift: String(c.uplift_pct ?? c.suggested_uplift_pct), min: c.min_stay ? String(c.min_stay) : "" };
                  return (
                    <div key={c.id} className="bg-gray-50 rounded-lg p-2 mb-1.5">
                      <p className="text-[11px] font-semibold text-chs-charcoal">{c.name} <span className="font-normal text-gray-400">{c.starts_on} → {c.ends_on}</span></p>
                      {!c.dates_confirmed && <p className="text-[9px] text-amber-700">Dates are expected and not yet confirmed by CHS.</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <input type="number" min={1} max={300} value={e.uplift} onChange={(ev) => setEdits({ ...edits, [c.id]: { ...e, uplift: ev.target.value } })} className="w-16 px-2 py-1 rounded border border-gray-200 text-[11px]" />
                        <span className="text-[10px] text-gray-500">% more</span>
                        <input type="number" min={1} placeholder="Min nights" value={e.min} onChange={(ev) => setEdits({ ...edits, [c.id]: { ...e, min: ev.target.value } })} className="w-20 px-2 py-1 rounded border border-gray-200 text-[11px]" />
                        <button type="button" disabled={busy}
                          onClick={() => run(() => supabase.rpc("host_save_peak_rate", { p_property_id: propertyId, p_name: c.name, p_starts_on: c.starts_on, p_ends_on: c.ends_on, p_uplift_pct: parseInt(e.uplift) || c.suggested_uplift_pct, p_min_stay: e.min ? parseInt(e.min) : null, p_chs_period_id: c.id, p_active: !c.enabled }), c.enabled ? "Peak rate switched off." : "Peak rate switched on.")}
                          className={`ml-auto text-[10px] font-semibold px-2.5 py-1 rounded-full ${c.enabled ? "bg-green-600 text-white" : "bg-white border border-gray-300 text-gray-600"}`}>
                          {c.enabled ? "On" : "Off"}
                        </button>
                      </div>
                    </div>
                  );
                })}

                <p className="text-[10px] font-semibold text-gray-600 mt-2 mb-1">Your own events</p>
                {peak.mine.map((m) => (
                  <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-2 py-1.5 mb-1">
                    <p className="text-[11px] text-chs-charcoal">{m.name} · {m.starts_on} → {m.ends_on} · +{m.uplift_pct}%{m.min_stay ? ` · min ${m.min_stay} nights` : ""}</p>
                    <button type="button" disabled={busy} onClick={() => run(() => supabase.rpc("host_delete_peak_rate", { p_rate_id: m.id }), "Removed.")} className="text-[10px] text-chs-red underline">Remove</button>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  <input value={evName} onChange={(e) => setEvName(e.target.value)} placeholder="Event name (e.g. Town carnival)" className="col-span-2 px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
                  <input type="date" value={evStart} onChange={(e) => setEvStart(e.target.value)} className="px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
                  <input type="date" value={evEnd} onChange={(e) => setEvEnd(e.target.value)} className="px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
                  <input type="number" min={1} value={evUplift} onChange={(e) => setEvUplift(e.target.value)} placeholder="% more" className="px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
                  <input type="number" min={1} value={evMin} onChange={(e) => setEvMin(e.target.value)} placeholder="Min nights (optional)" className="px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
                </div>
                <button type="button" disabled={busy || !evName.trim() || !evStart || !evEnd}
                  onClick={() => run(async () => {
                    const r = await supabase.rpc("host_save_peak_rate", { p_property_id: propertyId, p_name: evName.trim(), p_starts_on: evStart, p_ends_on: evEnd, p_uplift_pct: parseInt(evUplift) || 0, p_min_stay: evMin ? parseInt(evMin) : null, p_chs_period_id: null, p_active: true });
                    if (!r.error) { setEvName(""); setEvStart(""); setEvEnd(""); setEvMin(""); }
                    return r;
                  }, "Your event rate is saved.")}
                  className="mt-1.5 w-full py-2 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold disabled:opacity-50">+ Add my event</button>
              </div>

              <div>
                <p className="text-xs font-bold text-chs-charcoal">📍 Hotel location</p>
                <p className="text-[10px] text-gray-500 mb-1.5">Stand at your hotel and tap below. When a guest taps “I&apos;ve arrived”, CHS checks they are within 1 km. Without a location, that check is skipped.</p>
                <p className="text-[10px] text-gray-600 mb-1">{flags.latitude != null ? `Saved: ${Number(flags.latitude).toFixed(5)}, ${Number(flags.longitude).toFixed(5)}` : "Not set yet."}</p>
                <button type="button" disabled={busy} onClick={useMyLocation} className="w-full py-2 rounded-full border border-chs-charcoal text-chs-charcoal text-[11px] font-semibold disabled:opacity-50">
                  📍 Use my current location as the hotel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
