"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import RoleBadge from "@/components/RoleBadge";
import InfoTip from "@/components/InfoTip";

// Real, new dashboard per direct client request: a genuine, separate,
// restricted view for a real investor or lender doing due diligence —
// business viability, never individual people. Every figure here
// comes from get_investor_dashboard_summary(), a real, narrow
// function that only ever returns pre-aggregated, anonymized totals —
// this page has no path to any raw user or transaction table, and no
// real name, phone number, or address ever appears anywhere on it.

interface InvestorSummary {
  as_of: string;
  growth: {
    total_active_listings: number;
    listings_last_30_days: number;
    listings_by_purpose: Record<string, number>;
    total_real_users: number;
    users_last_30_days: number;
  };
  financial_health: {
    gross_transaction_value_all_time: number;
    successful_transactions: number;
    refunded_transactions: number;
    success_rate_pct: number;
    currently_held_in_escrow: number;
  };
  revenue: {
    total_platform_earnings_all_time: number;
    earnings_last_30_days: number;
    earnings_by_transaction_type: Record<string, number>;
  };
  trust_and_quality: {
    pct_listings_verified: number;
    open_disputes: number;
  };
  geographic_reach: { location_state: string; listing_count: number }[];
}

export default function InvestorPage() {
  const router = useRouter();
  const { session, profile, signOut, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<InvestorSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session || profile?.role !== "investor") {
      router.push("/");
      return;
    }
    supabase.rpc("get_investor_dashboard_summary").then(({ data, error }) => {
      if (error) { setError(error.message); return; }
      setSummary(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, profile]);

  if (authLoading || (!summary && !error)) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading real figures…</div>;
  }

  return (
    <div className="min-h-screen zone-admin bg-[var(--zone-bg)] pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-5">
        <div className="flex justify-between items-center">
          <RoleBadge label="CHS Investor View" />
          <button onClick={() => signOut()} className="bg-white/15 px-3 py-1.5 rounded-full text-xs font-semibold">Log out</button>
        </div>
        <h1 className="font-serif text-xl font-bold mt-2">Real Business Figures</h1>
        <p className="text-xs text-white/70 mt-1">
          Genuine, live platform data for your own due diligence. No individual buyer, seller, or tenant is ever identifiable here.
        </p>
      </div>

      <div className="px-4 py-5 max-w-2xl mx-auto">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3 mb-4">{error}</p>}
        {summary && (
          <>
            <p className="text-[10px] text-gray-400 mb-4">As of {new Date(summary.as_of).toLocaleString()}</p>

            <div className="bg-chs-charcoal text-white rounded-xl p-4 mb-3">
              <p className="text-[10px] text-white/70 uppercase font-bold">Gross Transaction Value <InfoTip text="The total real naira value of every genuinely completed sale on the platform, all time." /></p>
              <p className="font-serif text-2xl font-bold mt-0.5">{formatNaira(summary.financial_health.gross_transaction_value_all_time)}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-[9px] font-bold text-gray-400 uppercase">Active Listings</p>
                <p className="text-lg font-bold text-chs-charcoal">{summary.growth.total_active_listings}</p>
                <p className="text-[10px] text-gray-500">+{summary.growth.listings_last_30_days} last 30 days</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-[9px] font-bold text-gray-400 uppercase">Real Users</p>
                <p className="text-lg font-bold text-chs-charcoal">{summary.growth.total_real_users}</p>
                <p className="text-[10px] text-gray-500">+{summary.growth.users_last_30_days} last 30 days</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3">
              <p className="text-xs font-bold text-chs-charcoal mb-2">📊 Listings by category</p>
              {Object.entries(summary.growth.listings_by_purpose).map(([purpose, count]) => (
                <div key={purpose} className="flex justify-between text-xs mb-1 last:mb-0">
                  <span className="capitalize text-gray-600">{purpose.replace(/_/g, " ")}</span>
                  <span className="font-semibold text-chs-charcoal">{count}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-[9px] font-bold text-green-700 uppercase">Success Rate</p>
                <p className="text-lg font-bold text-chs-charcoal">{summary.financial_health.success_rate_pct}%</p>
                <p className="text-[10px] text-gray-500">{summary.financial_health.successful_transactions} completed</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <p className="text-[9px] font-bold text-gray-500 uppercase">Refunded</p>
                <p className="text-lg font-bold text-chs-charcoal">{summary.financial_health.refunded_transactions}</p>
              </div>
            </div>

            <div className="bg-chs-amber-light rounded-xl p-3 mb-3">
              <p className="text-[9px] font-bold text-chs-amber-dark uppercase">🔒 Currently Held in Escrow</p>
              <p className="text-lg font-bold text-chs-charcoal">{formatNaira(summary.financial_health.currently_held_in_escrow)}</p>
            </div>

            <div className="bg-white rounded-xl border-2 border-chs-red p-3 mb-3">
              <p className="text-xs font-bold text-chs-red mb-1">💰 Real Platform Revenue</p>
              <p className="font-serif text-xl font-bold text-chs-charcoal mb-2">{formatNaira(summary.revenue.total_platform_earnings_all_time)}</p>
              <p className="text-[10px] text-gray-500 mb-2">{formatNaira(summary.revenue.earnings_last_30_days)} in the last 30 days</p>
              {Object.entries(summary.revenue.earnings_by_transaction_type).map(([type, amt]) => (
                <div key={type} className="flex justify-between text-xs mb-0.5">
                  <span className="capitalize text-gray-600">{type.replace(/_/g, " ")}</span>
                  <span className="font-semibold text-chs-charcoal">{formatNaira(amt)}</span>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3">
              <p className="text-xs font-bold text-chs-charcoal mb-2">✓ Trust & Quality</p>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Real listings verified</span>
                <span className="font-semibold text-chs-charcoal">{summary.trust_and_quality.pct_listings_verified}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Open disputes</span>
                <span className="font-semibold text-chs-charcoal">{summary.trust_and_quality.open_disputes}</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-xs font-bold text-chs-charcoal mb-2">🗺️ Geographic Reach</p>
              {summary.geographic_reach.map((g) => (
                <div key={g.location_state} className="flex justify-between text-xs mb-1 last:mb-0">
                  <span className="text-gray-600">{g.location_state}</span>
                  <span className="font-semibold text-chs-charcoal">{g.listing_count} listings</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
