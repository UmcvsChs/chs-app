"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import AdminClaimsRules from "./AdminClaimsRules";
import { CLAIM_TYPE_LABEL, STATUS_LABEL, FLAG_LABEL, fmtDT, timeLeft } from "@/lib/claims";

interface Row { id: string; reference: string; status: string; claim_type: string; at_door: boolean; flagged: string | null; overdue: boolean; product: string; amount: number; buyer: string | null; seller: string; opened_at: string; seller_due_at: string | null; buyer_due_at: string | null; chs_due_at: string | null; total_to_buyer: number; fault: string | null; seller_response: string | null; seller_rate: number; }

export default function AdminClaims() {
  const [filter, setFilter] = useState<"needs_chs" | "active" | "closed" | "all" | "rules">("needs_chs");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (filter === "rules") return;
    let live = true;
    supabase.rpc("admin_get_marketplace_claims", { p_filter: filter }).then(({ data, error }) => { if (!live) return; if (error) setErr(error.message); else { setErr(null); setRows(data as Row[]); } });
    return () => { live = false; };
  }, [filter]);
  const tabs: [typeof filter, string][] = [["needs_chs", "Needs CHS decision"], ["active", "All open"], ["closed", "Closed"], ["all", "Everything"], ["rules", "Fund, rates & rules"]];
  return (
    <div>
      <h2 className="text-base font-bold text-chs-charcoal mb-1">Claims: damaged, faulty, wrong or missing goods</h2>
      <p className="text-xs text-gray-500 mb-3">Every refund is approved here. Refunds above ₦500,000 need a second admin. The sweep runs every hour: a silent seller or buyer moves a case to &quot;needs CHS decision&quot;.</p>
      <div className="flex gap-2 flex-wrap mb-3">
        {tabs.map(([k, l]) => <button key={k} onClick={() => { setRows(null); setFilter(k); }} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === k ? "bg-chs-charcoal text-white border-chs-charcoal" : "border-gray-300 text-gray-600"}`}>{l}</button>)}
      </div>
      {filter === "rules" && <AdminClaimsRules />}
      {filter !== "rules" && err && <p className="text-xs text-chs-red">{err}</p>}
      {filter !== "rules" && rows === null && !err && <p className="text-sm text-gray-500">Loading…</p>}
      {filter !== "rules" && rows && rows.length === 0 && <p className="text-sm text-gray-500">Nothing here.</p>}
      <div className="space-y-2">
        {(filter === "rules" ? [] : rows || []).map((r) => {
          const st = STATUS_LABEL[r.status] || STATUS_LABEL.open;
          return (
            <Link key={r.id} href={`/claims/${r.id}`} className={`block rounded-xl border p-3 bg-white ${r.overdue ? "border-chs-red" : "border-gray-100"}`}>
              <div className="flex justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-chs-charcoal">{r.reference} · {r.product}{r.at_door ? " · at the door" : ""}</p>
                  <p className="text-[11px] text-gray-500">{CLAIM_TYPE_LABEL[r.claim_type]} · {formatNaira(r.amount)} · buyer {r.buyer || "—"} · seller {r.seller}{r.seller_rate > 3 ? ` (claim rate ${r.seller_rate}%)` : ""}</p>
                  <p className="text-[10px] text-gray-400">Opened {fmtDT(r.opened_at)}{r.seller_response ? ` · seller: ${r.seller_response}` : ""}</p>
                </div>
                <span className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}>{st.text}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                {r.overdue && <span className="text-[10px] font-bold text-chs-red">⏰ OVERDUE</span>}
                {r.flagged && <span className="text-[10px] font-semibold text-amber-700">{FLAG_LABEL[r.flagged]}</span>}
                {r.status === "open" && <span className="text-[10px] text-gray-500">seller reply: {timeLeft(r.seller_due_at)}</span>}
                {(r.status === "awaiting_chs" || r.status === "awaiting_second") && <span className="text-[10px] text-gray-500">CHS decision: {timeLeft(r.chs_due_at)}</span>}
                {r.status === "decided" && r.total_to_buyer > 0 && <span className="text-[10px] text-green-700">Refunded {formatNaira(r.total_to_buyer)}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
