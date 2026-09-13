"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RoleBadge from "@/components/RoleBadge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import WalletQuickView from "@/components/WalletQuickView";

// Real, new page — the backend for Rent-to-Own installment payments
// (pay_rent_to_own_installment) was already live, correct, and tested
// directly against the database with real numbers, but no frontend
// screen ever called it. A buyer with an active agreement had no way
// to actually pay. This is that missing screen, built to match the
// exact real pattern already proven on the Tenant dashboard's rent
// payment card (real pre-payment total shown, real error handling for
// insufficient_balance, real receipt reference shown after payment).

interface RtoAgreement {
  id: string;
  property_id: string;
  total_price: number;
  monthly_amount: number;
  portion_pct: number;
  total_paid: number;
  ownership_pct: number;
  status: "requested" | "active" | "completed" | "defaulted" | "cancelled" | "declined";
  started_at: string | null;
  completed_at: string | null;
  properties: { title: string; location_area: string; street_address: string | null } | null;
  seller: { full_name: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  requested: "Waiting for the owner's approval",
  active: "Active",
  completed: "Completed — you own this property",
  defaulted: "Defaulted",
  cancelled: "Cancelled",
  declined: "Declined by the owner",
};

export default function RentToOwnPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [agreements, setAgreements] = useState<RtoAgreement[]>([]);
  const [buyerCommissionPct, setBuyerCommissionPct] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payMessage, setPayMessage] = useState<Record<string, string>>({});

  async function loadData() {
    if (!session) return;
    setLoading(true);

    const [agreementsRes, settingRes] = await Promise.all([
      supabase
        .from("rent_to_own_agreements")
        .select(
          "id, property_id, total_price, monthly_amount, portion_pct, total_paid, ownership_pct, status, started_at, completed_at, properties(title, location_area, street_address), seller:seller_id(full_name)"
        )
        .eq("buyer_id", session.user.id),
      supabase.from("platform_settings").select("value").eq("key", "rent_to_own_buyer_commission_pct").maybeSingle(),
    ]);

    setAgreements((agreementsRes.data as unknown as RtoAgreement[]) || []);
    setBuyerCommissionPct(settingRes.data ? Number(settingRes.data.value) : 0);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  async function handlePayInstallment(agreementId: string) {
    setPayingId(agreementId);
    setPayMessage((prev) => ({ ...prev, [agreementId]: "" }));
    const { data, error } = await supabase.rpc("pay_rent_to_own_installment", { p_agreement_id: agreementId });
    setPayingId(null);
    if (error) {
      setPayMessage((prev) => ({
        ...prev,
        [agreementId]: error.message.includes("insufficient_balance")
          ? "Insufficient wallet balance for this installment's real total. Fund your wallet and try again."
          : error.message,
      }));
      return;
    }
    setPayMessage((prev) => ({
      ...prev,
      [agreementId]: `✓ Paid ${formatNaira(data.real_total_paid)} (installment ${formatNaira(data.installment)} + your real ${formatNaira(data.buyer_commission)} commission). Ref: ${data.reference}`,
    }));
    loadData();
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  const active = agreements.filter((a) => a.status === "active");
  const other = agreements.filter((a) => a.status !== "active");

  return (
    <div className="min-h-screen zone-buyer bg-[var(--zone-bg)] pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <RoleBadge label="Mortgage (Rent to Own)" />
        <div className="flex justify-between items-end mt-1 gap-2">
          <h1 className="font-serif text-lg font-bold">My Mortgage (Rent to Own)</h1>
          {session && <WalletQuickView userId={session.user.id} />}
        </div>
        <div className="flex gap-1.5 mt-2">
          <Link href="/my-offers" className="bg-white/15 text-[10px] font-semibold px-3 py-1.5 rounded-full">My Offers</Link>
          <Link href="/my-receipts" className="bg-white/15 text-[10px] font-semibold px-3 py-1.5 rounded-full">My Transactions</Link>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        {agreements.length === 0 ? (
          <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4 text-center">
            <p className="text-sm text-gray-500">No Mortgage (Rent to Own) agreements yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Browse properties listed as Mortgage (Rent to Own) and request one from the property page.
            </p>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div>
                <p className="text-xs font-bold text-chs-charcoal mb-2">Active agreement{active.length > 1 ? "s" : ""}</p>
                {active.map((a) => {
                  const buyerCommission = Math.round((a.monthly_amount * buyerCommissionPct) / 100);
                  const realTotalDue = a.monthly_amount + buyerCommission;
                  const remaining = Math.max(0, a.total_price - a.total_paid);
                  return (
                    <div key={a.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-3">
                      <p className="text-sm font-semibold text-chs-charcoal">{a.properties?.title}</p>
                      <p className="text-xs font-semibold text-gray-600">📍 {a.properties?.street_address || "No street address on file"}</p>
                      <p className="text-xs text-gray-500">{a.properties?.location_area}</p>
                      <p className="text-xs text-gray-500 mt-1">Seller: {a.seller?.full_name || "—"}</p>

                      <div className="bg-white rounded-lg p-2.5 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">Ownership so far</span>
                          <span className="text-xs font-bold text-chs-charcoal">{a.ownership_pct.toFixed(2)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                          <div
                            className="bg-chs-red h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, a.ownership_pct)}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-2 text-[11px] text-gray-600">
                          <span>Paid so far</span>
                          <span>{formatNaira(a.total_paid)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-gray-600">
                          <span>Remaining toward full price</span>
                          <span>{formatNaira(remaining)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-gray-600">
                          <span>Total property price</span>
                          <span>{formatNaira(a.total_price)}</span>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-2.5 mt-2 text-[11px] text-gray-600">
                        <div className="flex justify-between"><span>Monthly installment</span><span>{formatNaira(a.monthly_amount)}</span></div>
                        <div className="flex justify-between"><span>Your real CHS commission ({buyerCommissionPct}%)</span><span>{formatNaira(buyerCommission)}</span></div>
                        <div className="flex justify-between font-bold text-chs-charcoal border-t border-gray-100 pt-1 mt-1">
                          <span>Real total due now</span><span>{formatNaira(realTotalDue)}</span>
                        </div>
                      </div>

                      {payMessage[a.id] && <p className="text-[10px] text-gray-600 mt-1.5">{payMessage[a.id]}</p>}

                      <button
                        onClick={() => handlePayInstallment(a.id)}
                        disabled={payingId === a.id}
                        className="mt-2 w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50"
                      >
                        {payingId === a.id ? "Processing..." : `Pay this month's installment — ${formatNaira(realTotalDue)}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {other.length > 0 && (
              <div>
                <p className="text-xs font-bold text-chs-charcoal mb-2">Other agreements</p>
                {other.map((a) => (
                  <div key={a.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                    <p className="text-sm font-semibold text-chs-charcoal">{a.properties?.title}</p>
                    <p className="text-xs text-gray-500">{a.properties?.location_area}</p>
                    <span
                      className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${
                        a.status === "completed"
                          ? "text-white bg-chs-red"
                          : a.status === "declined" || a.status === "cancelled" || a.status === "defaulted"
                          ? "text-gray-500 bg-gray-100"
                          : "text-chs-amber-dark bg-chs-amber-light"
                      }`}
                    >
                      {STATUS_LABELS[a.status] || a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
