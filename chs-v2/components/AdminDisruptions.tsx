"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { Claim, CLAIM_STATUS, claimDay } from "@/components/ClaimTypes";

// Admin: declare a disruption (curfew, flood, government order...) and decide the requests the venue and guest cannot settle.
interface Ev { id: string; title: string; kind: string; state: string; area: string | null; starts_on: string; ends_on: string; note: string | null; active: boolean }
interface Data { events: Ev[]; claims: Claim[]; settings: { cap_pct: number; reply_hours: number; reschedule_days: number } }
const KINDS = ["curfew", "riot", "flood", "natural_disaster", "government_order", "road_closure", "other"];
const STATES = ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"];
const today = () => new Date(Date.now() + 3600000).toISOString().slice(0, 10);

function Decide({ c, onDone }: { c: Claim; onDone: () => void }) {
  const [keeps, setKeeps] = useState(String(c.host_costs || 0));
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function decide(d: "refund" | "reschedule" | "reject") {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("admin_decide_claim", { p_claim: c.id, p_decision: d, p_keeps: Number(keeps) || 0, p_note: note });
    setBusy(false);
    if (error) setErr(error.message); else onDone();
  }
  return (
    <div className="mt-2 border-t border-gray-100 pt-2 space-y-1.5">
      {c.host_note && <p className="text-[11px]"><b>Venue says:</b> {c.host_note}{c.host_costs ? ` (asks to keep ${formatNaira(c.host_costs)})` : ""}</p>}
      {c.admin_note && <p className="text-[11px] italic">{c.admin_note}</p>}
      <div className="flex gap-2 items-center">
        {c.choice === "refund" && <label className="text-[10px] text-gray-500">Venue keeps (max {formatNaira(c.cap)}) <input value={keeps} onChange={(e) => setKeeps(e.target.value.replace(/[^\d.]/g, ""))} className="border border-gray-300 rounded px-1.5 py-0.5 text-[11px] w-24 ml-1" /></label>}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Your reasoning (recorded, and shown to the guest if rejected)" className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
      <div className="flex gap-2">
        <button disabled={busy} onClick={() => decide(c.choice)} className="px-3 py-1 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold">{c.choice === "refund" ? "Approve refund" : "Approve date move"}</button>
        <button disabled={busy} onClick={() => decide("reject")} className="px-3 py-1 rounded-full border border-red-300 text-red-600 text-[11px]">Reject</button>
      </div>
      {err && <p className="text-[11px] text-red-600">{err}</p>}
    </div>
  );
}

export default function AdminDisruptions() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ title: "", kind: "curfew", state: "Rivers", area: "", starts: today(), ends: today(), note: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<"review" | "all">("review");

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_get_disruptions");
    if (error) setErr(error.message); else setD(data as Data);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function declare() {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await supabase.rpc("admin_declare_disruption", { p_title: f.title, p_kind: f.kind, p_state: f.state, p_area: f.area || null, p_starts: f.starts, p_ends: f.ends, p_note: f.note || null });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg("Declared. Every guest with a paid booking in that area and period has been notified."); setF({ ...f, title: "", note: "" }); load();
  }

  if (!d) return <p className="text-xs text-gray-400 py-6">{err || "Loading…"}</p>;
  const review = d.claims.filter((c) => c.status === "admin_review");
  const shown = filter === "review" ? review : d.claims;

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">When something neither the guest nor the venue controls (a curfew, flood, riot, government order) disrupts bookings, declare it here once. Every paid booking in that state and period then qualifies automatically: the guest can move dates free of charge or be refunded, and the venue may keep only real, documented costs up to {d.settings.cap_pct}% of the booking price, with no CHS commission. A venue that does not reply within {d.settings.reply_hours} hours cannot hold a guest up. Personal cases (bereavement, medical) come to the venue first and to you if contested. Limits can be changed in platform settings: disruption_venue_cap_pct, disruption_host_reply_hours, disruption_reschedule_days.</p>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {msg && <p className="text-xs text-green-700">{msg}</p>}

      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
        <p className="text-sm font-bold text-chs-charcoal">Declare a disruption</p>
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Curfew in Port Harcourt" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
        <div className="grid grid-cols-2 gap-2">
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className="border border-gray-300 rounded px-2 py-1.5 text-xs">{KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}</select>
          <select value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} className="border border-gray-300 rounded px-2 py-1.5 text-xs">{STATES.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <input value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="Only part of the state? Area name (optional, e.g. GRA)" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
        <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500">
          <label>From <input type="date" value={f.starts} onChange={(e) => setF({ ...f, starts: e.target.value })} className="border border-gray-300 rounded px-1 py-1 text-xs w-full" /></label>
          <label>To <input type="date" value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} className="border border-gray-300 rounded px-1 py-1 text-xs w-full" /></label>
        </div>
        <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Source (e.g. government announcement) for the record" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
        <button disabled={busy || !f.title.trim()} onClick={declare} className="px-4 py-1.5 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">Declare and notify guests</button>
      </div>

      <div>
        <p className="text-sm font-bold text-chs-charcoal mb-1">Declared disruptions</p>
        {d.events.length === 0 && <p className="text-xs text-gray-400">None declared.</p>}
        {d.events.map((e) => (
          <div key={e.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2 flex justify-between gap-2 items-center">
            <div><p className="text-xs font-semibold">{e.title} <span className="text-[10px] text-gray-400">({e.kind.replace(/_/g, " ")})</span></p><p className="text-[11px] text-gray-500">{e.state}{e.area ? ` · ${e.area}` : ""} · {claimDay(e.starts_on)} to {claimDay(e.ends_on)} · {e.active ? "active" : "ended"}</p></div>
            {e.active && <button onClick={async () => { await supabase.rpc("admin_end_disruption", { p_event: e.id }); load(); }} className="text-[10px] px-2 py-1 rounded-full border">End</button>}
          </div>
        ))}
      </div>

      <div>
        <div className="flex gap-2 items-center mb-1">
          <p className="text-sm font-bold text-chs-charcoal">Requests</p>
          <button onClick={() => setFilter("review")} className={`text-[10px] px-2 py-0.5 rounded-full border ${filter === "review" ? "bg-chs-charcoal text-white" : ""}`}>Needs my decision ({review.length})</button>
          <button onClick={() => setFilter("all")} className={`text-[10px] px-2 py-0.5 rounded-full border ${filter === "all" ? "bg-chs-charcoal text-white" : ""}`}>All ({d.claims.length})</button>
        </div>
        {shown.length === 0 && <p className="text-xs text-gray-400">Nothing here.</p>}
        {shown.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
            <div className="flex justify-between gap-2"><p className="text-sm font-bold text-chs-charcoal">{c.property}</p><span className="text-[10px] font-bold uppercase text-gray-500">{CLAIM_STATUS[c.status]}</span></div>
            <p className="text-[11px] text-gray-500">{c.guest} · {claimDay(c.check_in)} → {claimDay(c.check_out)} · paid {formatNaira(c.paid_amount)} · {c.choice === "refund" ? "wants a refund" : `wants to move to ${c.new_check_in ? claimDay(c.new_check_in) : "?"}`}{c.covered ? ` · covered by ${c.event}` : " · not under a declared disruption"}</p>
            <p className="text-[11px] italic text-gray-600">“{c.reason}”</p>
            {c.evidence_url && <a href={c.evidence_url} target="_blank" rel="noreferrer" className="text-[11px] underline">Evidence</a>}
            {c.status === "completed" && <p className="text-[11px] text-green-700">{c.outcome === "rescheduled" ? "Moved." : `Refunded ${formatNaira(c.refund_amount || 0)}; venue kept ${formatNaira(c.venue_keeps || 0)}.`}</p>}
            {["admin_review", "awaiting_host", "awaiting_guest"].includes(c.status) && <Decide c={c} onDone={load} />}
          </div>
        ))}
      </div>
    </div>
  );
}
