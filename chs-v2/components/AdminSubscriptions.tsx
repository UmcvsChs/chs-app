"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDateTime, formatNaira } from "@/lib/format";

// Admin: plans and prices, the pilot, the master switch, and who is on what. Changing prices, granting a
// pilot and the master switch are for the super admin only (the database refuses anyone else).
interface Row { host_id: string; name: string; phone: string; plan: string; status: string; pilot: boolean; pilot_note: string | null; period_end: string; grace_until: string | null; cancel_at_period_end: boolean }
interface Data {
  enforced: boolean; pilot_limit: number; pilot_months: number; pilots_active: number; paid_active: number; monthly_recurring: number;
  plans: { key: string; name: string; monthly_price: number | null; discount_pts: number }[]; rows: Row[];
}

export default function AdminSubscriptions() {
  const [d, setD] = useState<Data | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, { price: string; pts: string }>>({});
  const [phone, setPhone] = useState(""); const [plan, setPlan] = useState("pro"); const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_get_subscriptions");
    if (error) { setErr(error.message); return; }
    const x = data as Data; setD(x);
    const e: Record<string, { price: string; pts: string }> = {};
    x.plans.forEach((p) => { e[p.key] = { price: p.monthly_price === null ? "" : String(p.monthly_price), pts: String(p.discount_pts) }; });
    setEdit(e);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function run(fn: PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setErr(null); setMsg(null);
    const { error } = await fn;
    if (error) { setErr(error.message); return; }
    setMsg(ok); load();
  }

  async function grant() {
    setErr(null); setMsg(null);
    const f = await supabase.rpc("admin_find_host", { p_phone: phone });
    const host = f.data as { id: string; name: string; listings: number } | null;
    if (f.error || !host) { setErr(f.error?.message || "No account with that phone number."); return; }
    if (!window.confirm(`Give ${host.name} the free ${plan} pilot?`)) return;
    run(supabase.rpc("admin_grant_pilot", { p_host: host.id, p_plan: plan, p_months: null, p_note: note || null }), `${host.name} is in the pilot.`);
    setPhone(""); setNote("");
  }

  if (!d) return <p className="text-xs text-gray-400">{err || "Loading…"}</p>;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 mt-4 space-y-3">
      <p className="text-sm font-bold text-chs-charcoal">⭐ Hospitality plans &amp; pilot</p>
      <p className="text-[11px] text-gray-500">{d.pilots_active} of {d.pilot_limit} pilot places used · {d.paid_active} paying · {formatNaira(d.monthly_recurring)} a month recurring</p>
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
        <p className="text-[11px] text-chs-charcoal"><b>Master switch:</b> Pro tools are {d.enforced ? "ON: only Pro or Business hosts can use them" : "OFF: every host can use every tool (launch mode)"}.</p>
        <button onClick={() => { if (window.confirm(d.enforced ? "Switch OFF? Every host gets every tool again." : "Switch ON? Hosts without Pro or Business lose the Pro tools (their records stay readable).")) run(supabase.rpc("admin_set_subscription_setting", { p_key: "subscriptions_enforced", p_value: d.enforced ? "false" : "true" }), "Switch changed."); }} className="text-[10px] px-3 py-1 rounded-full bg-chs-charcoal text-white whitespace-nowrap">{d.enforced ? "Turn off" : "Turn on"}</button>
      </div>
      {d.plans.filter((p) => p.key !== "listed").map((p) => (
        <div key={p.key} className="border border-gray-200 rounded-lg p-2">
          <p className="text-xs font-semibold text-chs-charcoal">{p.name}</p>
          <div className="flex gap-1.5 mt-1">
            <input value={edit[p.key]?.price ?? ""} onChange={(e) => setEdit({ ...edit, [p.key]: { ...edit[p.key], price: e.target.value } })} placeholder="Monthly price ₦ (blank = not on sale)" className="flex-1 border border-gray-300 rounded px-2 py-1 text-[11px]" />
            <input value={edit[p.key]?.pts ?? ""} onChange={(e) => setEdit({ ...edit, [p.key]: { ...edit[p.key], pts: e.target.value } })} placeholder="Commission cut (points)" className="w-32 border border-gray-300 rounded px-2 py-1 text-[11px]" />
            <button onClick={() => run(supabase.rpc("admin_set_plan", { p_key: p.key, p_price: edit[p.key]?.price ? Number(edit[p.key].price.replace(/,/g, "")) : null, p_discount_pts: Number(edit[p.key]?.pts || 0) }), `${p.name} saved.`)} className="text-[10px] px-3 rounded-full bg-chs-charcoal text-white">Save</button>
          </div>
        </div>
      ))}
      <div className="border border-gray-200 rounded-lg p-2 space-y-1.5">
        <p className="text-xs font-semibold text-chs-charcoal">Grant a free pilot ({d.pilot_months} months)</p>
        <div className="flex gap-1.5">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Host phone" className="flex-1 border border-gray-300 rounded px-2 py-1 text-[11px]" />
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="border border-gray-300 rounded px-2 text-[11px]"><option value="pro">Pro</option><option value="business">Business</option></select>
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note, e.g. 3-star hotel, Abuja" className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
        <button disabled={!phone.trim()} onClick={grant} className="px-3 py-1 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">Grant pilot</button>
      </div>
      {msg && <p className="text-[11px] text-green-700">{msg}</p>}
      {err && <p className="text-[11px] text-red-600">{err}</p>}
      <p className="text-[11px] font-bold text-chs-charcoal">Subscribers</p>
      {d.rows.length === 0 ? <p className="text-[11px] text-gray-400">No one yet.</p> : d.rows.map((r) => (
        <div key={r.host_id} className="border-b border-gray-100 py-1">
          <p className="text-[11px] text-chs-charcoal">{r.name} · {r.phone} · <b>{r.plan}</b> · {r.status}{r.pilot ? " · pilot" : ""}{r.cancel_at_period_end ? " · not renewing" : ""}</p>
          <p className="text-[10px] text-gray-400">Period ends {formatDateTime(r.period_end)}{r.pilot_note ? ` · ${r.pilot_note}` : ""}</p>
        </div>
      ))}
    </div>
  );
}
