"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatNaira, formatDateTime } from "@/lib/format";

// Every wallet movement, grouped by what it was for, searchable, each with its receipt.
interface Tx { reference: string; direction: "debit" | "credit"; amount: number; description: string; created_at: string }
type Kind = "booking" | "services" | "refund" | "wallet" | "other";
const KIND_LABEL: Record<Kind, string> = { booking: "Bookings", services: "Venue services", refund: "Refunds", wallet: "Top-ups & withdrawals", other: "Other" };

export function classifyTx(t: { reference: string; description: string; direction: string }): Kind {
  const r = (t.reference || "").toUpperCase(); const d = (t.description || "").toLowerCase();
  if (r.startsWith("SVC-")) return "services";
  if (r.startsWith("SVR-") || r.startsWith("HCX-") || /refund/.test(d)) return "refund";
  if (r.startsWith("REQ-") || r.startsWith("TOP-") || /booking|stay|deposit|escrow/.test(d)) return "booking";
  if (/fund|withdraw|top.?up|paystack|transfer/.test(d)) return "wallet";
  return "other";
}

export default function TransactionsPanel({ limit = 200, compact = false }: { limit?: number; compact?: boolean }) {
  const [rows, setRows] = useState<Tx[] | null>(null);
  const [kind, setKind] = useState<Kind | "all">("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("wallet_transactions").select("reference, direction, amount, description, created_at").neq("wallet_type", "escrow_held")
      .order("created_at", { ascending: false }).limit(limit).then(({ data }) => setRows((data as Tx[]) || []));
  }, [limit]);

  const shown = useMemo(() => (rows || []).filter((t) => (kind === "all" || classifyTx(t) === kind) && (!q.trim() || (t.description + " " + t.reference).toLowerCase().includes(q.trim().toLowerCase()))), [rows, kind, q]);
  const totalIn = shown.filter((t) => t.direction === "credit").reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = shown.filter((t) => t.direction === "debit").reduce((s, t) => s + Number(t.amount), 0);

  if (!rows) return <p className="text-xs text-gray-400 text-center py-10">Loading…</p>;
  return (
    <div className={compact ? "space-y-2" : "px-4 py-4 space-y-3"}>
      {!compact && (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by place, receipt number…" className="w-full border border-gray-300 rounded-full px-3 py-2 text-xs" />
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {(["all", "booking", "services", "refund", "wallet", "other"] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)} className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap border ${kind === k ? "bg-chs-charcoal text-white border-chs-charcoal" : "bg-white text-gray-600 border-gray-300"}`}>{k === "all" ? "All" : KIND_LABEL[k]}</button>
            ))}
          </div>
          <p className="text-[11px] text-gray-500">In {formatNaira(totalIn)} · Out {formatNaira(totalOut)} ({shown.length} shown)</p>
        </>
      )}
      {shown.length === 0 && <p className="text-xs text-gray-400 text-center py-8">No transactions to show.</p>}
      {shown.slice(0, compact ? 5 : 500).map((t, i) => (
        <Link key={`${t.reference}-${i}`} href={`/receipt/${t.reference}`} className="block bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex justify-between items-center gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-chs-charcoal">{t.description}</p>
              <p className="text-[10px] text-gray-400">{formatDateTime(t.created_at)} · {t.reference} · {KIND_LABEL[classifyTx(t)]}</p>
            </div>
            <p className={`text-sm font-bold whitespace-nowrap ${t.direction === "credit" ? "text-green-700" : "text-chs-red"}`}>{t.direction === "credit" ? "+" : "-"}{formatNaira(t.amount)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
