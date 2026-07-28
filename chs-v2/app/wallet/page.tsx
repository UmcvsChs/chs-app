"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Wallet, WalletTransaction } from "@/types/wallet";
import { formatNaira } from "@/lib/format";
import { startWalletFunding } from "@/lib/paystack";
import CurrencyInput from "@/components/CurrencyInput";

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
  const [showFundForm, setShowFundForm] = useState(false);
  const [fundAmount, setFundAmount] = useState<number | "">("");
  const [funding, setFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);

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

  async function handleFundWallet(e: React.FormEvent) {
    e.preventDefault();
    if (!fundAmount || fundAmount < 100) {
      setFundError("Please enter an amount of at least ₦100.");
      return;
    }
    setFundError(null);
    setFunding(true);

    try {
      // Paystack works in kobo, not naira — the real, documented unit
      // their API expects, not something to guess at.
      await startWalletFunding(
        fundAmount * 100,
        () => {
          // A real webhook (set up server-side) is what actually
          // credits the wallet reliably — this success callback is just
          // for immediate UI feedback, not the source of truth for the
          // real balance update.
          setFunding(false);
          setShowFundForm(false);
          setFundAmount("");
          setTimeout(loadData, 2000); // give the webhook a moment to land
        },
        () => {
          setFunding(false);
        }
      );
    } catch {
      setFundError("Could not start payment. Please try again.");
      setFunding(false);
    }
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

            <div className="bg-white rounded-xl border border-gray-100 p-4">
              {!showFundForm ? (
                <button
                  onClick={() => setShowFundForm(true)}
                  className="w-full py-2.5 rounded-full bg-chs-red text-white text-xs font-semibold"
                >
                  Fund wallet
                </button>
              ) : (
                <form onSubmit={handleFundWallet} className="space-y-2">
                  <CurrencyInput value={fundAmount} onChange={setFundAmount} placeholder="Amount to fund (₦)" />
                  {fundError && <p className="text-[10px] text-chs-red">{fundError}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowFundForm(false)}
                      className="flex-1 py-2 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold">
                      Cancel
                    </button>
                    <button type="submit" disabled={funding}
                      className="flex-1 py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                      {funding ? "Opening..." : "Continue to pay"}
                    </button>
                  </div>
                </form>
              )}
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
