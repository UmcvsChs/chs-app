"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira, formatDateTime } from "@/lib/format";
import AdminSubscriptions from "@/components/AdminSubscriptions";

// Admin: (1) the CHS peak-period calendar that hosts can switch on, and
// (2) the list of hosts who cancelled confirmed bookings, with a button to
// reinstate a suspended listing.

interface Period { id: string; name: string; starts_on: string; ends_on: string; suggested_uplift_pct: number; dates_confirmed: boolean; notes: string | null; active: boolean }
interface Strike {
  id: string; host_name: string; host_phone: string; property_id: string; property_title: string; guest_name: string;
  strike_no: number; action: "warning" | "penalty" | "suspension"; booking_value: number; refunded: number;
  fee_owed: number; penalty_owed: number; penalty: number; reason: string; created_at: string; suspended: boolean; reinstated_at: string | null;
}

export default function AdminHotelControls() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ id: "", name: "", starts: "", ends: "", uplift: "25", confirmed: false, notes: "" });
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([supabase.rpc("get_peak_periods_admin"), supabase.rpc("get_host_strikes")]);
    setPeriods((p.data as Period[]) || []);
    setStrikes((s.data as Strike[]) || []);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function save() {
    setErr(null); setMsg(null);
    const { error } = await supabase.rpc("admin_save_peak_period", {
      p_id: f.id || null, p_name: f.name.trim(), p_starts_on: f.starts, p_ends_on: f.ends,
      p_suggested_uplift: parseInt(f.uplift) || 0, p_confirmed: f.confirmed, p_notes: f.notes.trim() || null,
    });
    if (error) { setErr(error.message); return; }
    setMsg("Peak period saved."); setF({ id: "", name: "", starts: "", ends: "", uplift: "25", confirmed: false, notes: "" }); load();
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this peak period? Hosts who switched it on will lose it.")) return;
    const { error } = await supabase.rpc("admin_delete_peak_period", { p_id: id });
    if (error) setErr(error.message); else load();
  }
  async function reinstate(s: Strike) {
    setErr(null); setMsg(null);
    const { error } = await supabase.rpc("admin_reinstate_listing", { p_property_id: s.property_id, p_note: notes[s.id] || "Reinstated by CHS after review" });
    if (error) { setErr(error.message); return; }
    setMsg(`${s.property_title} is live again.`); load();
  }

  return (
    <div className="space-y-5">
      {msg && <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">{msg}</p>}
      {err && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{err}</p>}

      <div>
        <p className="text-sm font-bold text-chs-charcoal mb-1">📈 Peak periods</p>
        <p className="text-xs text-gray-500 mb-2">Busy dates hosts can switch on with one tap. Mark dates “confirmed” once the real dates are known (Eid and Easter move each year).</p>
        {periods.map((p) => (
          <div key={p.id} className="bg-white rounded-lg border border-gray-200 px-3 py-2 mb-1.5 flex justify-between items-center gap-2">
            <div>
              <p className="text-xs font-semibold text-chs-charcoal">{p.name} · +{p.suggested_uplift_pct}%</p>
              <p className="text-[10px] text-gray-500">{p.starts_on} → {p.ends_on} · {p.dates_confirmed ? "dates confirmed" : "dates expected, not confirmed"}</p>
            </div>
            <div className="flex gap-2 text-[10px]">
              <button type="button" className="underline text-chs-charcoal" onClick={() => setF({ id: p.id, name: p.name, starts: p.starts_on, ends: p.ends_on, uplift: String(p.suggested_uplift_pct), confirmed: p.dates_confirmed, notes: p.notes || "" })}>Edit</button>
              <button type="button" className="underline text-chs-red" onClick={() => remove(p.id)}>Delete</button>
            </div>
          </div>
        ))}
        <div className="bg-gray-50 rounded-lg p-2.5 mt-2 grid grid-cols-2 gap-1.5">
          <p className="col-span-2 text-[11px] font-semibold text-chs-charcoal">{f.id ? "Edit period" : "Add a period"}</p>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name" className="col-span-2 px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
          <input type="date" value={f.starts} onChange={(e) => setF({ ...f, starts: e.target.value })} className="px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
          <input type="date" value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} className="px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
          <input type="number" value={f.uplift} onChange={(e) => setF({ ...f, uplift: e.target.value })} placeholder="Suggested % more" className="px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
          <label className="flex items-center gap-1.5 text-[11px]"><input type="checkbox" checked={f.confirmed} onChange={(e) => setF({ ...f, confirmed: e.target.checked })} />Dates confirmed</label>
          <input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Notes (optional)" className="col-span-2 px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
          <button type="button" disabled={!f.name.trim() || !f.starts || !f.ends} onClick={save} className="col-span-2 py-2 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold disabled:opacity-50">{f.id ? "Save changes" : "Add period"}</button>
        </div>
      </div>

      <div>
        <p className="text-sm font-bold text-chs-charcoal mb-1">🚨 Hosts who cancelled confirmed bookings ({strikes.length})</p>
        <p className="text-xs text-gray-500 mb-2">First cancellation is a warning, the second costs a penalty, the third suspends the listing. Help each guest rebook (each one also reached you as an alert).</p>
        {strikes.length === 0 && <p className="text-xs text-gray-400">None so far.</p>}
        {strikes.map((s) => (
          <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
            <div className="flex justify-between items-start gap-2">
              <p className="text-sm font-semibold text-chs-charcoal">{s.host_name} · {s.property_title}</p>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${s.action === "suspension" ? "bg-red-100 text-red-700" : s.action === "penalty" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
                Strike {s.strike_no}: {s.action}
              </span>
            </div>
            <p className="text-[11px] text-gray-600">Guest {s.guest_name} · booking {formatNaira(s.booking_value)} · refunded {formatNaira(s.refunded)}</p>
            <p className="text-[11px] text-gray-500">Host phone (CHS only): {s.host_phone}</p>
            {(s.fee_owed > 0 || s.penalty_owed > 0) && <p className="text-[11px] text-amber-700">Still owed by the host: {formatNaira(s.fee_owed + s.penalty_owed)} (collected from their next payouts)</p>}
            <p className="text-[11px] text-gray-500 italic mt-0.5">“{s.reason}”</p>
            <p className="text-[9px] text-gray-400">{formatDateTime(s.created_at)}</p>
            {s.suspended && !s.reinstated_at && (
              <div className="mt-2">
                <input value={notes[s.id] || ""} onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })} placeholder="Note for the record (why it is safe to reinstate)" className="w-full px-2 py-1.5 rounded border border-gray-200 text-[11px] mb-1.5" />
                <button type="button" onClick={() => reinstate(s)} className="w-full py-2 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold">Reinstate this listing</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <AdminSubscriptions />
    </div>
  );
}
