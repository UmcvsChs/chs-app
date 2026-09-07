"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import NotificationBell from "@/components/NotificationBell";

// Real, comprehensive "My Earnings" per direct, detailed client
// request: income only (never expenditure — that stays on Transaction
// History), fully itemized for real accounting use. Someone selling
// on behalf of family needs to be able to account for every real
// naira — who paid, for what, when, the real gross amount, and the
// real platform commission taken.
interface Earning {
  category: "rent" | "sale" | "shortlet";
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  paid_at: string;
  payer_name: string;
  property_title: string;
  property_location: string;
  detail_label: string;
  reference: string | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  rent: "🏠 Earnings from rent",
  sale: "🏡 Earnings from land/property sale",
  shortlet: "🏨 Earnings from shortlet/hotel/event booking",
};

export default function MyEarningsPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [filter, setFilter] = useState<"all" | "rent" | "sale" | "shortlet">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.push("/login"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    supabase.rpc("get_owner_earnings_detailed").then(({ data }) => {
      setEarnings((data as unknown as Earning[]) || []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  const filtered = filter === "all" ? earnings : earnings.filter((e) => e.category === filter);
  const totalGross = filtered.reduce((s, e) => s + e.gross_amount, 0);
  const totalCommission = filtered.reduce((s, e) => s + e.commission_amount, 0);
  const totalNet = filtered.reduce((s, e) => s + e.net_amount, 0);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] zone-owner pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <Link href="/owner" className="text-xs text-white/70">← Back to Owner Dashboard</Link>
        <div className="flex justify-between items-center mt-1">
          <h1 className="font-serif text-lg font-bold">My Earnings</h1>
          <NotificationBell />
        </div>
        <p className="text-xs text-white/60 mt-1">Real income only — every real naira, itemized, for genuine accounting.</p>
        <div className="flex gap-1.5 mt-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["all", "rent", "sale", "shortlet"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 text-[10px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap ${filter === f ? "bg-white text-chs-charcoal" : "bg-white/15 text-white"}`}>
              {f === "all" ? "All" : f === "rent" ? "Rent" : f === "sale" ? "Sales" : "Shortlet/Hire"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="bg-chs-charcoal text-white rounded-xl p-4 mb-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[9px] text-white/60 uppercase">Real gross</p>
              <p className="text-sm font-bold mt-0.5">{formatNaira(totalGross)}</p>
            </div>
            <div>
              <p className="text-[9px] text-white/60 uppercase">CHS commission</p>
              <p className="text-sm font-bold mt-0.5 text-white/70">{formatNaira(totalCommission)}</p>
            </div>
            <div>
              <p className="text-[9px] text-white/60 uppercase">Your real net</p>
              <p className="text-sm font-bold mt-0.5 text-chs-red">{formatNaira(totalNet)}</p>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">No real earnings yet.</p>
        ) : (
          filtered.map((e, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
              <p className="text-[10px] font-bold text-chs-charcoal uppercase">{CATEGORY_LABEL[e.category]}</p>
              <p className="text-sm font-semibold text-chs-charcoal mt-1">{e.property_title} — {e.property_location}</p>
              <p className="text-xs text-gray-500 mt-0.5">Payment by {e.payer_name} · {e.detail_label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{new Date(e.paid_at).toLocaleString()}</p>
              <div className="bg-[var(--zone-card)] rounded-lg p-2 mt-2 space-y-0.5">
                <div className="flex justify-between text-[11px]"><span className="text-gray-500">Gross payment</span><span className="font-semibold">{formatNaira(e.gross_amount)}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-gray-500">CHS commission</span><span className="font-semibold">{formatNaira(e.commission_amount)}</span></div>
                <div className="flex justify-between text-xs border-t border-gray-200 pt-1 mt-1"><span className="font-bold text-chs-charcoal">Your real net</span><span className="font-bold text-chs-red">{formatNaira(e.net_amount)}</span></div>
              </div>
              {e.reference && (
                <Link href={`/receipt/${e.reference}`} className="block text-center mt-2 py-1.5 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold">
                  📄 View real payment advisor
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
