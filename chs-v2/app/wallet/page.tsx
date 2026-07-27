"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Wallet, WalletTransaction } from "@/types/wallet";
import { formatNaira } from "@/lib/format";

const WALLET_TYPE_LABELS: Record<string, string> = {
  main: "Main balance",
  rent_savings: "Rent savings",
  maintenance_reserve: "Maintenance reserve",
  agent_earnings: "Agent earnings",
};

export default function WalletPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  async function loadData() {
    if (!session) return;
    setLoading(true);

    const [walletRes, transactionsRes] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", session.user.id).single(),
      supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    setWallet(walletRes.data);
    setTransactions(transactionsRes.data || []);
    setLoading(false);
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <h1 className="font-serif text-lg font-bold mt-1">My Wallet</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {wallet ? (
          <>
            <div className="bg-gradient-to-br from-chs-steel-blue via-chs-charcoal to-chs-amber rounded-xl p-4 text-white">
              <p className="text-xs text-white/70">Main balance</p>
              <p className="text-2xl font-bold mt-1">{formatNaira(wallet.main_balance)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 p-3">
                <p className="text-[10px] uppercase text-gray-400">Rent savings</p>
                <p className="text-sm font-bold text-chs-charcoal mt-1">{formatNaira(wallet.rent_savings)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-3">
                <p className="text-[10px] uppercase text-gray-400">Maintenance reserve</p>
                <p className="text-sm font-bold text-chs-charcoal mt-1">{formatNaira(wallet.maintenance_reserve)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-3">
                <p className="text-[10px] uppercase text-gray-400">Agent earnings paid</p>
                <p className="text-sm font-bold text-chs-charcoal mt-1">{formatNaira(wallet.agent_earnings_paid)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-3">
                <p className="text-[10px] uppercase text-gray-400">Pending earnings</p>
                <p className="text-sm font-bold text-chs-charcoal mt-1">{formatNaira(wallet.agent_earnings_pending)}</p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">No wallet found for this account.</p>
        )}

        <div>
          <p className="text-xs font-bold text-chs-charcoal mb-2">Transaction history</p>
          {transactions.length === 0 ? (
            <p className="text-sm text-gray-400">No transactions yet.</p>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="bg-white rounded-xl border border-gray-100 p-3 mb-2 flex justify-between items-center">
                <div>
                  <p className="text-xs font-semibold text-chs-charcoal">
                    {tx.description || WALLET_TYPE_LABELS[tx.wallet_type]}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {WALLET_TYPE_LABELS[tx.wallet_type]} · {new Date(tx.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className={`text-sm font-bold ${tx.direction === "credit" ? "text-chs-red" : "text-gray-400"}`}>
                  {tx.direction === "credit" ? "+" : "−"}{formatNaira(tx.amount)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
