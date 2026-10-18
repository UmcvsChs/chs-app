"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { fmtDT } from "@/lib/claims";

/* eslint-disable @typescript-eslint/no-explicit-any */
const SETTING_HELP: Record<string, string> = {
  claim_fund_cap: "Most the Delivery Protection Fund pays on one order (₦). Review every quarter.",
  claim_window_visible_hours: "Hours after delivery to report damage, wrong or missing items",
  claim_window_fault_days: "Days after delivery to report a hidden fault",
  claim_seller_reply_hours: "Hours the seller has to reply to a claim",
  claim_door_reply_hours: "Hours the seller has to reply when the buyer refuses at the door",
  claim_buyer_reply_hours: "Hours the buyer has to answer a seller's offer",
  claim_chs_working_days: "Working days CHS promises to decide",
  claim_second_approver_amount: "Refunds above this (₦) need a second admin",
  claim_early_release_max_rate: "No early part-release when the seller's claim rate is above this %",
  claim_warn_rate: "Warn the seller when the 90-day claim rate is above this %",
  claim_review_rate: "Flag the seller's listings for review above this %",
  claim_min_photos: "Photos the buyer must add",
  claim_rate_min_orders: "Claim rate is only counted once a seller has at least this many orders in 90 days",
};

export default function AdminClaimsRules() {
  const [f, setF] = useState<any>(null);
  const [rates, setRates] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const [kw, setKw] = useState("");
  const [pct, setPct] = useState("");

  const load = useCallback(async () => {
    const a = await supabase.rpc("admin_fund_summary");
    if (a.error) { setErr(a.error.message); return; }
    setF(a.data);
    const b = await supabase.rpc("admin_seller_claim_rates");
    setRates((b.data as any[]) || []);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function run(fn: string, args: Record<string, unknown>, ok: string) {
    setErr(null); setMsg(null);
    const { error } = await supabase.rpc(fn, args);
    if (error) { setErr(error.message); return; }
    setMsg(ok); load();
  }
  if (!f) return <p className="text-sm text-gray-500">{err || "Loading…"}</p>;
  const box = "bg-white rounded-xl border border-gray-100 p-4 mb-3";
  return (
    <div>
      {err && <p className="text-xs text-chs-red font-semibold mb-2">{err}</p>}
      {msg && <p className="text-xs text-green-700 font-semibold mb-2">{msg}</p>}

      <section className={box}>
        <h3 className="text-sm font-bold text-chs-charcoal mb-1">Delivery Protection Fund</h3>
        <p className="text-[11px] text-gray-500 mb-2">Pays buyers when goods are damaged on the CHS leg of a delivery (the seller keeps their payment). Balance = transit insurance collected + top-ups − paid out. Review the per-order cap every quarter.</p>
        <div className="grid grid-cols-2 gap-2 text-center mb-2">
          <div className="bg-gray-50 rounded-lg p-2"><p className="text-[10px] text-gray-500">Insurance collected</p><p className="text-sm font-bold">{formatNaira(f.collected)}</p></div>
          <div className="bg-gray-50 rounded-lg p-2"><p className="text-[10px] text-gray-500">Top-ups by CHS</p><p className="text-sm font-bold">{formatNaira(f.topups)}</p></div>
          <div className="bg-gray-50 rounded-lg p-2"><p className="text-[10px] text-gray-500">Paid to buyers</p><p className="text-sm font-bold">{formatNaira(f.paid)}</p></div>
          <div className={`rounded-lg p-2 ${f.balance < 0 ? "bg-red-50" : "bg-green-50"}`}><p className="text-[10px] text-gray-500">Balance</p><p className="text-sm font-bold">{formatNaira(f.balance)}</p></div>
        </div>
        {f.balance < 0 && <p className="text-[11px] text-chs-red font-semibold mb-2">The fund is overspent. CHS is covering it. Add a top-up entry when you move money in.</p>}
        <div className="flex gap-2 mb-2">
          <input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="₦ (minus to take out)" className="w-36 px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What is this for?" className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
          <button onClick={() => { run("admin_add_fund_entry", { p_amount: Number(amt), p_note: note }, "Entry recorded."); setAmt(""); setNote(""); }} className="px-3 rounded-full bg-chs-charcoal text-white text-xs font-semibold">Add</button>
        </div>
        {(f.payouts as any[]).length > 0 && (
          <div className="mt-2"><p className="text-[11px] font-semibold text-gray-700 mb-1">Paid from the fund</p>
            {(f.payouts as any[]).map((p) => <Link key={p.id} href={`/claims/${p.id}`} className="flex justify-between text-[11px] py-0.5 border-b border-gray-50"><span>{p.reference} · {fmtDT(p.at)}</span><b>{formatNaira(p.amount)}</b></Link>)}</div>
        )}
        {(f.entries as any[]).length > 0 && (
          <div className="mt-2"><p className="text-[11px] font-semibold text-gray-700 mb-1">Entries</p>
            {(f.entries as any[]).map((e, i) => <div key={i} className="flex justify-between text-[11px] py-0.5 border-b border-gray-50"><span>{fmtDT(e.at)} · {e.note}</span><b>{formatNaira(e.amount)}</b></div>)}</div>
        )}
      </section>

      <section className={box}>
        <h3 className="text-sm font-bold text-chs-charcoal mb-1">Seller claim rates (last 90 days)</h3>
        <p className="text-[11px] text-gray-500 mb-2">Warning above {f.settings.find((s: any) => s.key === "claim_warn_rate")?.value}%, listing review above {f.settings.find((s: any) => s.key === "claim_review_rate")?.value}%. Sellers are warned automatically.</p>
        {rates.length === 0 ? <p className="text-xs text-gray-500">No seller has a claim yet.</p> : rates.map((r) => (
          <div key={r.vendor_id} className="flex justify-between items-center text-xs py-1 border-b border-gray-50">
            <span>{r.business}<span className="block text-[10px] text-gray-400">{r.claims} claim(s), {r.upheld} upheld, {r.lines} order line(s)</span></span>
            <span className={`font-bold ${r.review_flag ? "text-chs-red" : ""}`}>{r.rate}%{r.review_flag ? " · review listings" : ""}</span>
          </div>
        ))}
      </section>

      <section className={box}>
        <h3 className="text-sm font-bold text-chs-charcoal mb-1">Breakage allowances</h3>
        <p className="text-[11px] text-gray-500 mb-2">For bulk goods some breakage is normal. Units damaged up to this % of the order are not refunded (a word in the product name decides: the longest matching word applies). 0 = every broken unit is refunded.</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {(f.allowances as any[]).map((a) => (
            <span key={a.keyword} className="text-[11px] bg-gray-50 border border-gray-200 rounded-full pl-2.5 pr-1 py-0.5 flex items-center gap-1">{a.keyword}: <b>{a.pct}%</b>
              <button onClick={() => run("admin_remove_breakage_allowance", { p_keyword: a.keyword }, "Removed.")} className="w-4 h-4 text-gray-400">✕</button></span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="Product word, e.g. block" className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
          <input type="number" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="%" className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
          <button onClick={() => { run("admin_set_breakage_allowance", { p_keyword: kw, p_pct: Number(pct) }, "Saved."); setKw(""); setPct(""); }} className="px-3 rounded-full bg-chs-charcoal text-white text-xs font-semibold">Save</button>
        </div>
      </section>

      <section className={box}>
        <h3 className="text-sm font-bold text-chs-charcoal mb-2">Claim rules (settings)</h3>
        <div className="space-y-2">
          {(f.settings as any[]).map((s) => (
            <label key={s.key} className="flex items-center justify-between gap-3 text-[11px] text-gray-700">
              <span className="flex-1">{SETTING_HELP[s.key] || s.key}</span>
              <input defaultValue={s.value} onBlur={(e) => e.target.value !== s.value && run("admin_set_claim_setting", { p_key: s.key, p_value: e.target.value }, "Setting saved.")} className="w-24 px-2 py-1 rounded border border-gray-200 text-xs text-right" />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
