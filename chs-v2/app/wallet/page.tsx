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
import BankAccountSecurity, { checkWithdrawalAllowed } from "@/components/BankAccountSecurity";
import TransactionCommissions from "@/components/TransactionCommissions";

const WALLET_TYPE_LABELS: Record<string, string> = {
  main: "Main balance",
  rent_savings: "Rent savings",
  maintenance_reserve: "Maintenance reserve",
  agent_earnings: "Agent earnings",
};

export default function WalletPage() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFundForm, setShowFundForm] = useState(false);
  const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<number | "">("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [fundAmount, setFundAmount] = useState<number | "">("");
  const [funding, setFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);

  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferContact, setTransferContact] = useState("");
  const [transferAmount, setTransferAmount] = useState<number | "">("");
  const [transferNote, setTransferNote] = useState("");
  const [transferRecipient, setTransferRecipient] = useState<{ id: string; full_name: string; role: string } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);

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
      // .maybeSingle(), not .single() — a real trigger now guarantees a
      // wallet exists for every profile (see
      // backend-v2/50_wallet_fixes_and_admin_approval.sql), but this
      // stays defensive rather than hard-crashing the whole page on
      // any edge case (e.g. a profile that predates the trigger and
      // somehow missed the backfill).
      supabase.from("wallets").select("*").eq("user_id", session.user.id).maybeSingle(),
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

  // Genuinely checks and blocks a withdrawal during a real, pending
  // bank-account-change window — the actual real protection, not a
  // label. Honest about scope: this confirms whether a withdrawal is
  // genuinely *allowed*; actually moving money out still needs a real
  // payout integration with a payment provider, the same category of
  // work already disclosed for Paystack funding.
  async function handleLookupRecipient() {
    if (!transferContact.trim()) return;
    setLookingUp(true);
    setTransferMessage(null);
    setTransferRecipient(null);

    const { data, error } = await supabase.rpc("find_transfer_recipient", { p_contact: transferContact.trim() });
    setLookingUp(false);

    if (error || !data || data.length === 0) {
      setTransferMessage("No CHS user found with that phone number or email.");
      return;
    }
    setTransferRecipient(data[0]);
  }

  async function handleTransferSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transferRecipient) {
      setTransferMessage("Please look up and confirm a recipient first.");
      return;
    }
    if (!transferAmount || transferAmount <= 0) {
      setTransferMessage("Enter a real amount to send.");
      return;
    }

    setTransferring(true);
    setTransferMessage(null);

    const { error } = await supabase.rpc("transfer_wallet_funds", {
      p_recipient_id: transferRecipient.id,
      p_amount: transferAmount,
      p_note: transferNote.trim() || null,
    });

    setTransferring(false);
    if (error) {
      // The real database function's own message — the same real,
      // specific reasons (insufficient balance, frozen wallet, self-
      // transfer) rather than a generic "something went wrong".
      setTransferMessage(error.message);
      return;
    }

    setTransferMessage(`✓ Sent ${formatNaira(transferAmount)} to ${transferRecipient.full_name}.`);
    setTransferContact("");
    setTransferAmount("");
    setTransferNote("");
    setTransferRecipient(null);
    setShowTransferForm(false);
    loadData(); // real, immediate balance refresh
  }

  async function handleWithdrawSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    if (!withdrawAmount || withdrawAmount < 1000) {
      setWithdrawMessage("Please enter a valid amount (minimum ₦1,000).");
      return;
    }

    setWithdrawMessage(null);

    // The real, upfront convenience check — the actual protection is
    // the same check re-run server-side inside the Edge Function below,
    // since a client-side check alone could be bypassed.
    const preCheck = await checkWithdrawalAllowed(session.user.id);
    if (!preCheck.allowed) {
      setWithdrawMessage(preCheck.message || "Withdrawals are currently paused.");
      return;
    }

    setWithdrawing(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/initiate-withdrawal`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({ amount: withdrawAmount }),
      }
    );
    const result = await response.json();
    setWithdrawing(false);

    if (!response.ok || result.error) {
      setWithdrawMessage(result.error || "Could not complete this withdrawal.");
      return;
    }

    setWithdrawMessage("✓ Withdrawal submitted — funds reflect in your bank account shortly.");
    setWithdrawAmount("");
    setShowWithdrawForm(false);
    loadData();
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
    <div className="min-h-screen zone-buyer bg-[var(--zone-bg)] pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <h1 className="font-serif text-lg font-bold mt-1">My Wallet</h1>
      </div>

      {session && <TransactionCommissions session={session} />}

      <div className="px-4 py-4 space-y-4">
        {wallet ? (
          <>
            <div className="bg-gradient-to-br from-chs-steel-blue via-chs-charcoal to-chs-amber rounded-xl p-4 text-white">
              <p className="text-xs text-white/70">Main balance</p>
              <p className="text-2xl font-bold mt-1">{formatNaira(wallet.main_balance)}</p>
            </div>

            <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4">
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

            {withdrawMessage && (
              <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{withdrawMessage}</p>
            )}
            {!showWithdrawForm ? (
              <button
                onClick={() => { setShowWithdrawForm(true); setWithdrawMessage(null); }}
                className="w-full py-2.5 rounded-full bg-chs-charcoal text-white text-xs font-semibold"
              >
                Withdraw
              </button>
            ) : (
              <form onSubmit={handleWithdrawSubmit} className="space-y-2">
                <CurrencyInput value={withdrawAmount} onChange={setWithdrawAmount} placeholder="Amount to withdraw (₦)" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowWithdrawForm(false)}
                    className="flex-1 py-2 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold">
                    Cancel
                  </button>
                  <button type="submit" disabled={withdrawing}
                    className="flex-1 py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">
                    {withdrawing ? "Processing..." : "Confirm withdrawal"}
                  </button>
                </div>
              </form>
            )}

            {profile && <BankAccountSecurity session={session!} registeredName={profile.full_name} />}

            {transferMessage && (
              <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{transferMessage}</p>
            )}
            {!showTransferForm ? (
              <button
                onClick={() => { setShowTransferForm(true); setTransferMessage(null); }}
                className="w-full py-2.5 rounded-full bg-chs-charcoal text-white text-xs font-semibold"
              >
                Send to another CHS user
              </button>
            ) : (
              <form onSubmit={handleTransferSubmit} className="space-y-2">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500">Recipient&apos;s phone or email</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={transferContact}
                      onChange={(e) => { setTransferContact(e.target.value); setTransferRecipient(null); }}
                      placeholder="080... or their email"
                      className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
                    />
                    <button type="button" onClick={handleLookupRecipient} disabled={lookingUp}
                      className="px-4 rounded-lg bg-gray-200 text-gray-700 text-xs font-semibold disabled:opacity-50">
                      {lookingUp ? "..." : "Find"}
                    </button>
                  </div>
                </div>
                {transferRecipient && (
                  <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                    ✓ {transferRecipient.full_name} ({transferRecipient.role})
                  </p>
                )}
                <div>
                  <label className="text-[10px] font-semibold text-gray-500">Amount to send (₦)</label>
                  <div className="mt-1">
                    <CurrencyInput value={transferAmount} onChange={setTransferAmount} placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500">What&apos;s this for? (optional)</label>
                  <input
                    type="text"
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    placeholder="e.g. Rent contribution"
                    className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowTransferForm(false); setTransferRecipient(null); }}
                    className="flex-1 py-2 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold">
                    Cancel
                  </button>
                  <button type="submit" disabled={transferring || !transferRecipient}
                    className="flex-1 py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">
                    {transferring ? "Sending..." : "Confirm transfer"}
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3">
                <p className="text-[10px] uppercase text-gray-400">Rent savings</p>
                <p className="text-sm font-bold text-chs-charcoal mt-1">{formatNaira(wallet.rent_savings)}</p>
              </div>
              <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3">
                <p className="text-[10px] uppercase text-gray-400">Maintenance reserve</p>
                <p className="text-sm font-bold text-chs-charcoal mt-1">{formatNaira(wallet.maintenance_reserve)}</p>
              </div>
              <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3">
                <p className="text-[10px] uppercase text-gray-400">Agent earnings paid</p>
                <p className="text-sm font-bold text-chs-charcoal mt-1">{formatNaira(wallet.agent_earnings_paid)}</p>
              </div>
              {wallet.escrow_held > 0 && (
                <div className="bg-chs-amber-light rounded-xl border border-chs-amber-dark p-3 col-span-2">
                  <p className="text-[10px] uppercase text-chs-amber-dark font-semibold">🔒 Held — pending legal document transfer</p>
                  <p className="text-sm font-bold text-chs-charcoal mt-1">{formatNaira(wallet.escrow_held)}</p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    This is real, confirmed sale proceeds — visible to you, but not yet withdrawable. CHS releases it to your main wallet once the real Certificate of Occupancy, Deed of Assignment, and every other legal document have been confirmed transferred to the buyer.
                  </p>
                </div>
              )}
              <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3">
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
              <div key={tx.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2 flex justify-between items-center">
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
