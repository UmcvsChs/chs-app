"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import InfoTip from "@/components/InfoTip";

// The venue's own facts: the licensed capacity (CHS verifies it against the operating permit), the seating layouts it
// can offer, parking, power backup and fire safety. Guests see this when they book; nobody can book more guests than
// the capacity.

const LAYOUTS = ["Banquet (round tables)", "Theatre", "Classroom", "U-shape", "Standing / cocktail", "Boardroom"];

export default function EventVenueProfile({ propertyId, canEdit }: { propertyId: string; canEdit: boolean }) {
  const [cap, setCap] = useState("");
  const [layouts, setLayouts] = useState<string[]>([]);
  const [caps, setCaps] = useState<Record<string, string>>({});
  const [parking, setParking] = useState("");
  const [power, setPower] = useState("");
  const [fire, setFire] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_event_venue_profile", { p_property: propertyId });
    const p = data as { permitted_capacity: number | null; capacity_verified: boolean; seating_layouts: string[]; seating_capacity?: Record<string, number>; parking_spaces: number | null; power_backup: string | null; fire_safety_note: string | null } | null;
    if (!p) return;
    setCaps(Object.fromEntries(Object.entries(p.seating_capacity || {}).map(([k, v]) => [k, String(v)])));
    setCap(p.permitted_capacity ? String(p.permitted_capacity) : ""); setLayouts(p.seating_layouts || []); setParking(p.parking_spaces ? String(p.parking_spaces) : "");
    setPower(p.power_backup || ""); setFire(p.fire_safety_note || ""); setVerified(!!p.capacity_verified);
  }, [propertyId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function save() {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await supabase.rpc("host_save_event_venue_profile", {
      p_property: propertyId, p_capacity: cap ? Number(cap) : null, p_layouts: layouts, p_parking: parking ? Number(parking) : null, p_power: power || null, p_fire: fire || null,
    });
    if (error) { setBusy(false); setErr(error.message); return; }
    const map = Object.fromEntries(layouts.filter((l) => Number(caps[l]) > 0).map((l) => [l, Number(caps[l])]));
    const c = await supabase.rpc("host_save_seating_capacity", { p_property: propertyId, p_map: map });
    setBusy(false);
    if (c.error) { setErr(c.error.message); return; }
    setMsg("Saved. If you changed the capacity, CHS will verify it against your permit."); load();
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
      <p className="text-sm font-bold text-chs-charcoal">🏛️ Venue profile <InfoTip term="licensed_capacity" /></p>
      <p className="text-[11px] text-gray-500">Guests see this before they book. Bookings above your licensed capacity are refused automatically.</p>
      <label className="block text-[11px] text-gray-600">Licensed capacity (guests) {cap && <span className={`ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${verified ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{verified ? "✓ Verified by CHS" : "Waiting for CHS to verify"}</span>}
        <input disabled={!canEdit} value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="e.g. 500" />
      </label>
      <div>
        <p className="text-[11px] text-gray-600 mb-0.5">Seating layouts you can set up</p>
        <div className="flex flex-wrap gap-1">
          {LAYOUTS.map((l) => (
            <button key={l} type="button" disabled={!canEdit} onClick={() => setLayouts(layouts.includes(l) ? layouts.filter((x) => x !== l) : [...layouts, l])}
              className={`text-[10px] px-2 py-1 rounded-full border ${layouts.includes(l) ? "bg-chs-charcoal text-white border-chs-charcoal" : "border-gray-300 text-gray-600"}`}>{l}</button>
          ))}
        </div>
        {layouts.length > 0 && (
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {layouts.map((l) => (
              <label key={l} className="block text-[10px] text-gray-600">{l}: most guests
                <input disabled={!canEdit} value={caps[l] || ""} onChange={(e) => setCaps({ ...caps, [l]: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1 text-xs" placeholder="optional" />
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-gray-600">Parking spaces<input disabled={!canEdit} value={parking} onChange={(e) => setParking(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1 text-sm" /></label>
        <label className="block text-[11px] text-gray-600">Power backup<input disabled={!canEdit} value={power} onChange={(e) => setPower(e.target.value)} maxLength={120} className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="e.g. 2 generators" /></label>
      </div>
      <label className="block text-[11px] text-gray-600">Fire safety and exits<input disabled={!canEdit} value={fire} onChange={(e) => setFire(e.target.value)} maxLength={160} className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="e.g. extinguishers on each floor, 3 exits" /></label>
      {canEdit && <button disabled={busy} onClick={save} className="px-4 py-1.5 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">{busy ? "Saving…" : "Save venue profile"}</button>}
      {msg && <p className="text-[11px] text-green-700">{msg}</p>}
      {err && <p className="text-[11px] text-red-600">{err}</p>}
    </div>
  );
}
