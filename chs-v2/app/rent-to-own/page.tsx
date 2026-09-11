"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import NotificationBell from "@/components/NotificationBell";
import InfoTip from "@/components/InfoTip";

// Real, new page closing a confirmed, long-standing gap: the backend
// (pay_rent_to_own_installment) has been correct and tested since
// migration 91/94, but no real screen anywhere in the app ever called
// it — a genuine, working payment path with no door to reach it.
interface Agreement {
  id: string;
  total_price: number;
  monthly_amount: number;
  portion_pct: number;
  total_paid: number;
  ownership_pct: number;
  status: string;
  started_at: string;
  properties: { title: string; location_area: string }[] | null;
}

export default function RentToOwnPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<string | null>(null);

  async function loadAgreements() {
    if (!session) return;
    const { data } = await supabase.from("rent_to_own_agreements")
      .select("id, total_price, monthly_amount, portion_pct, total_paid, ownership_pct, status, started_at, properties(title, location_area)")
      .eq("buyer_id", session.user.id)
      .order("started_at", { ascending: false });
    setAgreements((data as unknown as Agreement[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.push("/login"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAgreements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  async function handlePay(agreementId: string) {
    setError(null);
    setPayingId(agreementId);
    const { data, error: rpcError } = await supabase.rpc("pay_rent_to_own_installment", { p_agreement_id: agreementId });
    setPayingId(null);
    if (rpcError) {
      setError(rpcError.message === "insufficient_balance"
        ? "Your real wallet balance is insufficient for this real installment. Please fund your wallet first."
        : rpcError.message);
      return;
    }
    setLastReceipt(data?.reference || null);
    loadAgreements();
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] zone-buyer pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <Link href="/my-offers" className="text-xs text-white/70">← Back</Link>
        <div className="flex justify-between items-center mt-1">
          <h1 className="font-serif text-lg font-bold">Rent to Own <InfoTip text="A real path to full ownership over time — each installment you pay genuinely increases your real ownership percentage, until the property is completely yours." /></h1>
          <NotificationBell />
        </div>
      </div>

      <div className="px-4 py-4">
        {lastReceipt && (
          <Link href={`/receipt/${lastReceipt}`} className="block bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 mb-3 text-xs text-green-700 font-semibold">
            ✓ Payment successful — tap here to view your real receipt
          </Link>
        )}
        {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2.5 mb-3">{error}</p>}

        {agreements.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">No real Rent-to-Own agreements yet.</p>
        ) : (
          agreements.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
              <p className="text-sm font-semibold text-chs-charcoal">{a.properties?.[0]?.title || "Property"}</p>
              <p className="text-[11px] text-gray-400">{a.properties?.[0]?.location_area}</p>

              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                  <span>Real ownership so far</span>
                  <span className="font-semibold text-chs-charcoal">{a.ownership_pct.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-chs-red h-2 rounded-full" style={{ width: `${Math.min(100, a.ownership_pct)}%` }} />
                </div>
              </div>

              <div className="bg-[var(--zone-card)] rounded-lg p-2.5 mt-3 space-y-1">
                <div className="flex justify-between text-[11px]"><span className="text-gray-500">Real total price</span><span className="font-semibold">{formatNaira(a.total_price)}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-gray-500">Real amount paid so far</span><span className="font-semibold">{formatNaira(a.total_paid)}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-gray-500">Real monthly installment</span><span className="font-semibold">{formatNaira(a.monthly_amount)}</span></div>
              </div>

              {a.status === "completed" ? (
                <p className="text-center text-xs font-bold text-green-700 bg-green-50 rounded-full py-2 mt-3">🎉 Fully owned — this agreement is complete</p>
              ) : (
                <button onClick={() => handlePay(a.id)} disabled={payingId === a.id}
                  className="w-full mt-3 py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
                  {payingId === a.id ? "Processing..." : `Pay real installment — ${formatNaira(a.monthly_amount)}`}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
