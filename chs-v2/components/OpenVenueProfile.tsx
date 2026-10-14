"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Open fields and stadiums: what the ground is like (surface, lights, toilets, rain plan, curfew).
// editable=false shows it to guests; editable=true lets the host fill it in.
interface P { surface: string | null; floodlights: boolean; toilets: number | null; changing_rooms: boolean; max_crowd: number | null; rain_plan: string | null; noise_curfew: string | null; safety_note: string | null }

export default function OpenVenueProfile({ propertyId, editable = false }: { propertyId: string; editable?: boolean }) {
  const [p, setP] = useState<P | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ surface: "", floodlights: false, toilets: "0", changing: false, crowd: "0", rain: "", curfew: "", safety: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_open_venue_profile", { p_property: propertyId });
    const d = data as P | null;
    setP(d);
    if (d) setF({ surface: d.surface || "", floodlights: d.floodlights, toilets: String(d.toilets ?? 0), changing: d.changing_rooms, crowd: String(d.max_crowd ?? 0), rain: d.rain_plan || "", curfew: d.noise_curfew || "", safety: d.safety_note || "" });
  }, [propertyId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function save() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("host_save_open_venue_profile", { p_property: propertyId, p_surface: f.surface, p_floodlights: f.floodlights, p_toilets: Number(f.toilets) || 0, p_changing: f.changing, p_max_crowd: Number(f.crowd) || 0, p_rain_plan: f.rain, p_curfew: f.curfew, p_safety: f.safety });
    setBusy(false);
    if (error) setMsg(error.message); else { setMsg("Saved."); load(); }
  }

  if (!editable) {
    if (!p) return null;
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
        <h3 className="font-bold mb-1">The ground</h3>
        <ul className="space-y-0.5 text-gray-700">
          {p.surface && <li>Surface: {p.surface}</li>}
          <li>Floodlights: {p.floodlights ? "Yes" : "No"}</li>
          {p.toilets != null && <li>Toilets: {p.toilets}</li>}
          <li>Changing rooms: {p.changing_rooms ? "Yes" : "No"}</li>
          {p.max_crowd && <li>Safe crowd limit: {p.max_crowd} people</li>}
          {p.rain_plan && <li>If it rains: {p.rain_plan}</li>}
          {p.noise_curfew && <li>Noise / curfew: {p.noise_curfew}</li>}
          {p.safety_note && <li>Safety: {p.safety_note}</li>}
        </ul>
      </div>
    );
  }
  return (
    <div className="mt-2 border border-gray-200 rounded-xl bg-white">
      <button onClick={() => setOpen(!open)} className="w-full text-left px-3 py-2 text-xs font-semibold">🏟️ Ground details (surface, lights, rain plan) {open ? "▲" : "▼"}</button>
      {open && (
        <div className="p-3 space-y-2 text-xs">
          <input className="w-full rounded border p-2" placeholder="Surface (natural grass, artificial turf, sand…)" value={f.surface} onChange={e => setF({ ...f, surface: e.target.value })} />
          <div className="flex gap-4"><label><input type="checkbox" checked={f.floodlights} onChange={e => setF({ ...f, floodlights: e.target.checked })} /> Floodlights</label><label><input type="checkbox" checked={f.changing} onChange={e => setF({ ...f, changing: e.target.checked })} /> Changing rooms</label></div>
          <div className="grid grid-cols-2 gap-2">
            <label>Toilets<input className="mt-1 w-full rounded border p-2" inputMode="numeric" value={f.toilets} onChange={e => setF({ ...f, toilets: e.target.value })} /></label>
            <label>Safe crowd limit<input className="mt-1 w-full rounded border p-2" inputMode="numeric" value={f.crowd} onChange={e => setF({ ...f, crowd: e.target.value })} /></label>
          </div>
          <input className="w-full rounded border p-2" placeholder="If it rains (e.g. rebook free within 30 days)" value={f.rain} onChange={e => setF({ ...f, rain: e.target.value })} />
          <input className="w-full rounded border p-2" placeholder="Noise / curfew (e.g. music off by 10pm)" value={f.curfew} onChange={e => setF({ ...f, curfew: e.target.value })} />
          <input className="w-full rounded border p-2" placeholder="Safety notes (first aid, security, exits)" value={f.safety} onChange={e => setF({ ...f, safety: e.target.value })} />
          <button disabled={busy} onClick={save} className="rounded bg-green-700 px-3 py-2 font-bold text-white disabled:opacity-50">Save</button>
          {msg && <p>{msg}</p>}
        </div>
      )}
    </div>
  );
}
