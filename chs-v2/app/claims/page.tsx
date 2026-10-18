"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { CLAIM_TYPE_LABEL, STATUS_LABEL, fmtDT, timeLeft } from "@/lib/claims";

interface Row { id: string; reference: string; status: string; claim_type: string; product: string; amount: number; total_to_buyer?: number; goods_refund?: number; opened_at: string; seller_due_at: string | null; buyer_due_at?: string | null; needs_me: boolean; }

function List({ title, rows, empty }: { title: string; rows: Row[]; empty: string }) {
  return (
    <section className="mb-5">
      <h2 className="text-sm font-bold text-chs-charcoal mb-2">{title}</h2>
      {rows.length === 0 ? <p className="text-xs text-gray-500">{empty}</p> : (
        <div className="space-y-2">
          {rows.map((r) => {
            const st = STATUS_LABEL[r.status] || STATUS_LABEL.open;
            return (
              <Link key={r.id} href={`/claims/${r.id}`} className="block bg-white rounded-xl border border-gray-100 p-3">
                <div className="flex justify-between gap-2">
                  <div><p className="text-xs font-bold text-chs-charcoal">{r.reference} · {r.product}</p><p className="text-[11px] text-gray-500">{CLAIM_TYPE_LABEL[r.claim_type]} · {formatNaira(r.amount)} · {fmtDT(r.opened_at)}</p></div>
                  <span className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${r.needs_me ? "bg-chs-red text-white" : st.cls}`}>{r.needs_me ? "Your answer needed" : st.text}</span>
                </div>
                {r.status === "open" && r.seller_due_at && <p className="text-[10px] text-gray-500 mt-1">Seller reply due: {timeLeft(r.seller_due_at)}</p>}
                {r.status === "offer_made" && r.buyer_due_at && <p className="text-[10px] text-gray-500 mt-1">Your answer due: {timeLeft(r.buyer_due_at)}</p>}
                {r.status === "decided" && (r.total_to_buyer || 0) > 0 && <p className="text-[10px] text-green-700 mt-1">Refunded {formatNaira(r.total_to_buyer || 0)}</p>}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function ClaimsPage() {
  const [mine, setMine] = useState<Row[] | null>(null);
  const [theirs, setTheirs] = useState<Row[]>([]);
  useEffect(() => {
    supabase.rpc("get_my_marketplace_claims").then(({ data }) => setMine((data as Row[]) || []));
    supabase.rpc("get_vendor_marketplace_claims").then(({ data }) => setTheirs((data as Row[]) || []));
  }, []);
  return (
    <main className="max-w-xl mx-auto p-4 pb-24">
      <Link href="/marketplace/orders" className="text-xs text-gray-500">← My orders</Link>
      <h1 className="text-lg font-bold text-chs-charcoal mt-2 mb-1">Problem reports</h1>
      <p className="text-xs text-gray-500 mb-4">Reports about damaged, faulty, wrong or missing goods. CHS holds the money until each one is settled.</p>
      {mine === null ? <p className="text-sm text-gray-500">Loading…</p> : (
        <>
          <List title="Reports I made" rows={mine} empty="You have not reported any problem." />
          {theirs.length > 0 && <List title="Reports about my sales" rows={theirs} empty="" />}
        </>
      )}
    </main>
  );
}
