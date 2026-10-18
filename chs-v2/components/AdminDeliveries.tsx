"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { STATUS_LABEL, MODE_LABEL } from "@/lib/delivery";
import { Timeline, type Shipment } from "@/components/ShipmentCard";

interface Rate { band: string; label: string; min_km: number; max_km: number; base_fee: number; per_km_fee: number; per_kg_fee: number; transit_min_days: number; transit_max_days: number; }
interface Hub { city_id: number; city: string; state: string; name: string; address: string | null; phone: string | null; active: boolean; }
interface Config { rates: Rate[]; settings: { key: string; value: string }[]; hubs: Hub[]; }

const SETTING_HELP: Record<string, string> = {
  delivery_road_factor: "Road distance = straight line × this (1.3 is typical)", delivery_local_km: "Up to this many km counts as 'within the city'",
  delivery_intra_city_km: "Distance assumed inside one city", delivery_insurance_pct: "Transit insurance, % of goods value (intercity)",
  delivery_lastmile_pct: "Discount (%) when the buyer collects from a CHS centre", delivery_hub_pickup_fee: "Flat fee for centre pickup (₦)",
  delivery_auto_confirm_days: "Days after 'delivered by carrier' before it auto-confirms", delivery_handling_fragile_pct: "Extra % for fragile goods",
  delivery_handling_bulky_pct: "Extra % for bulky goods", delivery_consolidation_days: "Days CHS holds goods at the centre to combine parcels", delivery_same_state_km: "Distance assumed between two areas of one state when exact map points are missing",
};
interface Loc { id: number; name: string; lat: number | null; lng: number | null; capital: boolean; }
const STATES = ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"];

function LocationEditor() {
  const [state, setState] = useState("");
  const [rows, setRows] = useState<Loc[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  async function load(st: string) {
    setState(st); setMsg(null);
    if (!st) { setRows([]); return; }
    const { data, error } = await supabase.rpc("admin_get_locations", { p_state: st });
    if (error) { setMsg(error.message); return; }
    setRows((data as Loc[]) || []);
  }
  const patch = (id: number, k: "lat" | "lng", v: string) => setRows(rows.map((r) => r.id === id ? { ...r, [k]: v === "" ? null : Number(v) } : r));
  async function save(r: Loc) {
    const { error } = await supabase.rpc("admin_set_location_coords", { p_id: r.id, p_lat: r.lat, p_lng: r.lng });
    setMsg(error ? error.message : `Saved ${r.name}.`);
  }
  return (
    <div>
      <p className="text-xs font-bold text-chs-charcoal mb-1">Area map points (all 774 LGAs)</p>
      <p className="text-[10px] text-gray-500 mb-1">Every area is already selectable. Areas without a map point are priced from their state capital, and two areas in one state without points are treated as 45 km apart by default (see the rules above). Add latitude and longitude to make a pair exact.</p>
      <select value={state} onChange={(e) => load(e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs mb-1">
        <option value="">Choose a state…</option>
        {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {msg && <p className="text-[10px] font-semibold text-chs-charcoal">{msg}</p>}
      <div className="max-h-64 overflow-y-auto space-y-1">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-1 text-[11px]">
            <span className="flex-1 min-w-0 truncate">{r.name}{r.capital ? " ★" : ""}</span>
            <input type="number" step="any" value={r.lat ?? ""} placeholder="lat" onChange={(e) => patch(r.id, "lat", e.target.value)} className="w-20 px-1 py-1 rounded border border-gray-200 text-xs" />
            <input type="number" step="any" value={r.lng ?? ""} placeholder="lng" onChange={(e) => patch(r.id, "lng", e.target.value)} className="w-20 px-1 py-1 rounded border border-gray-200 text-xs" />
            <button onClick={() => save(r)} className="px-2 py-1 rounded bg-chs-charcoal text-white text-[10px]">Save</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const FILTERS = ["active", "problem", "delivered", "all"] as const;

function ReleaseRow({ it, shipStatus, onDone }: { it: Shipment["items"][number]; shipStatus: string; onDone: () => void }) {
  const [pct, setPct] = useState(60);
  const [note, setNote] = useState("");
  const [arm, setArm] = useState<"" | "part" | "rest">("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const held = it.payment_status === "held_escrow";
  async function go() {
    setBusy(true); setMsg(null);
    const { data, error } = arm === "part"
      ? await supabase.rpc("admin_release_order_percentage", { p_order: it.order_id, p_pct: pct, p_note: note || null })
      : await supabase.rpc("release_direct_order_to_vendor", { p_order_id: it.order_id });
    setBusy(false); setArm("");
    if (error) { setMsg(error.message); return; }
    const r = data as { amount?: number } | null;
    setMsg(arm === "part" ? `Released ${formatNaira(r?.amount || 0)}.` : "Balance released to the seller."); onDone();
  }
  return (
    <div className="border-t border-gray-100 pt-1.5 mt-1.5">
      <p className="text-[11px]">{it.quantity} × {it.name} · {formatNaira(it.amount)} · <b>{it.payment_status}</b></p>
      {held && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <input type="number" min={1} max={100} value={pct} onChange={(e) => { setPct(Number(e.target.value)); setArm(""); }} className="w-14 px-1.5 py-1 rounded border border-gray-200 text-xs" /><span className="text-xs">%</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="flex-1 min-w-24 px-1.5 py-1 rounded border border-gray-200 text-xs" />
          <button onClick={() => (arm === "part" ? go() : setArm("part"))} disabled={busy} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold text-white ${arm === "part" ? "bg-green-600" : "bg-chs-charcoal"}`}>{arm === "part" ? `Tap again: release ${pct}%` : `Release ${pct}% to seller`}</button>
          {shipStatus === "delivered" && <button onClick={() => (arm === "rest" ? go() : setArm("rest"))} disabled={busy} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold text-white ${arm === "rest" ? "bg-green-600" : "bg-chs-red"}`}>{arm === "rest" ? "Tap again: release balance" : "Release balance"}</button>}
        </div>
      )}
      {msg && <p className="text-[10px] text-chs-charcoal mt-1">{msg}</p>}
    </div>
  );
}

function ShipRow({ s, onDone }: { s: Shipment; onDone: () => void }) {
  const [status, setStatus] = useState(s.status);
  const [note, setNote] = useState("");
  const [carrier, setCarrier] = useState(s.carrier || "");
  const [track, setTrack] = useState(s.tracking_no || "");
  const [msg, setMsg] = useState<string | null>(null);
  const [log, setLog] = useState(false);
  async function save() {
    setMsg(null);
    const { error } = await supabase.rpc("admin_update_shipment", { p_shipment: s.id, p_status: status, p_note: note || null, p_carrier: carrier || null, p_tracking: track || null });
    if (error) { setMsg(error.message); return; }
    setNote(""); onDone();
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3">
      <div className="flex justify-between gap-2">
        <div><p className="text-xs font-bold text-chs-charcoal">{s.reference} · {s.vendor} → {s.buyer}</p><p className="text-[10px] text-gray-500">{s.origin} → {s.dest} · {s.km} km · {s.weight_kg} kg · {MODE_LABEL[s.mode]} · delivery {formatNaira(s.delivery_fee + s.insurance_fee)}</p></div>
        <span className="self-start text-[10px] font-bold px-2 py-0.5 rounded-full bg-chs-amber-light text-chs-amber-dark whitespace-nowrap">{STATUS_LABEL[s.status] || s.status}</span>
      </div>
      <p className="text-[10px] text-gray-500 mt-1">To: {s.dest_address}{s.eta_max ? ` · due ${new Date(s.eta_max).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}` : ""}</p>
      {s.dispatch_method && (
        <p className="text-[10px] bg-blue-50 border border-blue-100 rounded px-2 py-1 mt-1 text-chs-charcoal">
          🚚 <b>{s.dispatch_method === "own_rider" ? "Seller's own rider" : s.dispatch_method === "courier" ? "Courier" : "CHS centre"}</b>
          {s.carrier ? ` · ${s.carrier}` : ""}{s.rider_name ? ` · ${s.rider_name}${s.rider_phone ? ` ${s.rider_phone}` : ""}` : ""}{s.vehicle_plate ? ` · ${s.vehicle_plate}` : ""}{s.tracking_no ? ` · waybill ${s.tracking_no}` : ""}
          {s.dispatched_at ? ` · dispatched ${new Date(s.dispatched_at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}{s.dispatch_note ? ` · note: ${s.dispatch_note}` : ""}
        </p>
      )}
      {s.items.map((it) => <ReleaseRow key={it.order_id} it={it} shipStatus={s.status} onDone={onDone} />)}
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="col-span-2 px-2 py-1.5 rounded-lg border border-gray-200 text-xs">
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier" className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
        <input value={track} onChange={(e) => setTrack(e.target.value)} placeholder="Waybill / tracking no." className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note shown to the buyer" className="col-span-2 px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
        <button onClick={save} disabled={status === s.status && !note && carrier === (s.carrier || "") && track === (s.tracking_no || "")} className="col-span-2 py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-40">Update shipment</button>
      </div>
      {msg && <p className="text-xs text-chs-red mt-1">{msg}</p>}
      <button onClick={() => setLog(!log)} className="mt-1 text-[10px] text-gray-500 underline">{log ? "Hide history" : "History"}</button>
      {log && <Timeline events={s.events} />}
    </div>
  );
}

export default function AdminDeliveries() {
  const [ships, setShips] = useState<Shipment[] | null>(null);
  const [filter, setFilter] = useState<typeof FILTERS[number]>("active");
  const [cfg, setCfg] = useState<Config | null>(null);
  const [showCfg, setShowCfg] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cfgMsg, setCfgMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const a = await supabase.rpc("admin_get_shipments");
    if (a.error) { setErr(a.error.message); return; }
    setShips((a.data as Shipment[]) || []); setErr(null);
    const c = await supabase.rpc("admin_get_delivery_config");
    if (!c.error) setCfg(c.data as Config);
  }, []);
  useEffect(() => { // eslint-disable-next-line react-hooks/set-state-in-effect
    load(); }, [load]);

  const shown = (ships || []).filter((s) => filter === "all" ? true : filter === "active" ? !["delivered", "cancelled", "problem"].includes(s.status) : s.status === filter);
  const count = (f: string) => (ships || []).filter((s) => f === "all" ? true : f === "active" ? !["delivered", "cancelled", "problem"].includes(s.status) : s.status === f).length;

  async function saveRate(r: Rate) {
    const { error } = await supabase.rpc("admin_set_delivery_rate", { p_band: r.band, p_base: r.base_fee, p_per_km: r.per_km_fee, p_per_kg: r.per_kg_fee, p_tmin: r.transit_min_days, p_tmax: r.transit_max_days });
    setCfgMsg(error ? error.message : `Saved ${r.label}.`);
  }
  async function saveSetting(key: string, value: string) {
    const { error } = await supabase.rpc("admin_set_delivery_setting", { p_key: key, p_value: value });
    setCfgMsg(error ? error.message : `Saved ${key}.`);
  }
  async function saveHub(h: Hub) {
    const { error } = await supabase.rpc("admin_set_hub", { p_city_id: h.city_id, p_name: h.name, p_address: h.address, p_phone: h.phone, p_active: h.active });
    setCfgMsg(error ? error.message : `Saved the ${h.city} centre.`);
  }
  const patchRate = (band: string, k: keyof Rate, v: number) => setCfg(cfg && { ...cfg, rates: cfg.rates.map((r) => r.band === band ? { ...r, [k]: v } : r) });
  const patchHub = (id: number, p: Partial<Hub>) => setCfg(cfg && { ...cfg, hubs: cfg.hubs.map((h) => h.city_id === id ? { ...h, ...p } : h) });

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Every marketplace parcel, one per seller. Money stays in CHS escrow: release a percentage to the seller at any time, and the balance once delivery is confirmed.</p>
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map((f) => <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-[11px] font-semibold ${filter === f ? "bg-chs-charcoal text-white" : "bg-gray-100 text-gray-600"}`}>{f === "active" ? "In progress" : f === "problem" ? "Problems" : f === "delivered" ? "Delivered" : "All"} ({count(f)})</button>)}
        <button onClick={load} className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">🔄 Refresh</button>
        <button onClick={() => setShowCfg(!showCfg)} className="ml-auto px-3 py-1.5 rounded-full text-[11px] font-semibold bg-chs-amber-light text-chs-amber-dark">⚙️ Rates, centres & rules</button>
      </div>
      {err && <p className="text-xs text-chs-red">{err}</p>}
      {showCfg && cfg && (
        <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-3">
          {cfgMsg && <p className="text-xs font-semibold text-chs-charcoal">{cfgMsg}</p>}
          <div>
            <p className="text-xs font-bold text-chs-charcoal">Rate card (₦)</p>
            <p className="text-[10px] text-gray-500 mb-1">Fee = starting charge + per-km × distance + per-kg × weight, with extras for fragile or bulky goods.</p>
            {cfg.rates.map((r) => (
              <div key={r.band} className="grid grid-cols-6 gap-1 items-end mb-1.5 text-[10px]">
                <p className="col-span-6 font-semibold">{r.label}</p>
                {([["base_fee", "Start"], ["per_km_fee", "Per km"], ["per_kg_fee", "Per kg"], ["transit_min_days", "Days min"], ["transit_max_days", "Days max"]] as const).map(([k, l]) => (
                  <label key={k}>{l}<input type="number" value={r[k]} onChange={(e) => patchRate(r.band, k, Number(e.target.value))} className="w-full px-1 py-1 rounded border border-gray-200 text-xs" /></label>
                ))}
                <button onClick={() => saveRate(r)} className="py-1.5 rounded bg-chs-charcoal text-white text-[10px] font-semibold">Save</button>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-bold text-chs-charcoal mb-1">Rules</p>
            {cfg.settings.map((st) => (
              <div key={st.key} className="flex items-center gap-2 mb-1">
                <p className="flex-1 text-[10px] text-gray-600">{SETTING_HELP[st.key] || st.key}</p>
                <input defaultValue={st.value} onBlur={(e) => e.target.value !== st.value && saveSetting(st.key, e.target.value)} className="w-20 px-1.5 py-1 rounded border border-gray-200 text-xs" />
              </div>
            ))}
            <p className="text-[10px] text-gray-400">Changes save when you leave the box.</p>
          </div>
          <LocationEditor />
          <div>
            <p className="text-xs font-bold text-chs-charcoal mb-1">CHS collection & packaging centres</p>
            <p className="text-[10px] text-gray-500 mb-1">Switch a city on once the centre exists. Buyers there then get the “pick up at a CHS centre” option, and sellers can drop goods with you.</p>
            {cfg.hubs.map((h) => (
              <div key={h.city_id} className="border border-gray-100 rounded-lg p-2 mb-1.5 space-y-1">
                <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={h.active} onChange={(e) => patchHub(h.city_id, { active: e.target.checked })} /> {h.city}, {h.state}</label>
                <input value={h.address || ""} onChange={(e) => patchHub(h.city_id, { address: e.target.value })} placeholder="Street address" className="w-full px-2 py-1 rounded border border-gray-200 text-xs" />
                <div className="flex gap-1.5"><input value={h.phone || ""} onChange={(e) => patchHub(h.city_id, { phone: e.target.value })} placeholder="Centre phone" className="flex-1 px-2 py-1 rounded border border-gray-200 text-xs" /><button onClick={() => saveHub(h)} className="px-3 rounded bg-chs-charcoal text-white text-[10px] font-semibold">Save</button></div>
              </div>
            ))}
          </div>
        </div>
      )}
      {ships === null && !err && <p className="text-xs text-gray-400 text-center py-6">Loading…</p>}
      {shown.length === 0 && ships && <p className="text-xs text-gray-400 text-center py-6">Nothing here.</p>}
      {shown.map((s) => <ShipRow key={s.id + s.status + s.events.length} s={s} onDone={load} />)}
    </div>
  );
}
