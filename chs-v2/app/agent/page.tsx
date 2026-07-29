"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { AgentReferral } from "@/types/agentReferral";
import { formatNaira } from "@/lib/format";

const STAGE_LABELS: Record<string, string> = {
  enquiry: "New enquiry",
  inspection: "Inspection booked",
  offer: "Offer made",
  completed: "Completed",
  lost: "Lost",
};

export default function AgentDashboard() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [referrals, setReferrals] = useState<AgentReferral[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    const allRoles = profile ? [profile.role, ...(profile.secondary_roles || [])] : [];
    if (profile && !allRoles.includes("agent")) {
      router.push("/");
      return;
    }
    loadReferrals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, profile]);

  async function loadReferrals() {
    if (!session) return;
    setLoading(true);

    // Deliberately queries the masked VIEW, never the underlying real
    // table — the buyer's identity is intentionally never exposed to an
    // agent, by design already built into the original schema.
    const { data } = await supabase
      .from("agent_referrals_masked")
      .select("*")
      .or(`listing_agent_id.eq.${session.user.id},referring_agent_id.eq.${session.user.id}`)
      .order("created_at", { ascending: false });

    setReferrals(data || []);
    setLoading(false);
  }

  function copyReferralLink() {
    if (!session) return;
    const link = `${window.location.origin}?ref=${session.user.id.slice(0, 8)}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const totalEarned = referrals
    .filter((r) => r.stage === "completed" && r.agent_payout)
    .reduce((sum, r) => sum + (r.agent_payout || 0), 0);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <h1 className="font-serif text-lg font-bold mt-1">Agent Dashboard</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Verification status — reusing the same real fields built
            during the original app's #15 and #16 fixes, an honest
            human-reviewed status, not a fake automated pass. */}
        {profile && (
          <div className="bg-white rounded-xl border border-gray-100 p-3 flex gap-4 text-xs">
            <div>
              <p className="text-gray-400">Membership</p>
              <p className={`font-semibold ${profile.membership_verified ? "text-chs-red" : "text-chs-amber-dark"}`}>
                {profile.membership_verified ? "✓ Verified" : "⏳ Pending review"}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Valid ID</p>
              <p className={`font-semibold ${profile.valid_id_verified ? "text-chs-red" : "text-chs-amber-dark"}`}>
                {profile.valid_id_verified ? "✓ Verified" : "⏳ Pending review"}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-chs-charcoal mb-2">Your referral link</p>
          <p className="text-xs text-gray-500 mb-3">
            Share this — you earn commission on any resulting transaction.
          </p>
          <button
            onClick={copyReferralLink}
            className="w-full py-2.5 rounded-full bg-chs-red text-white text-xs font-semibold"
          >
            {copied ? "✓ Copied!" : "Copy my referral link"}
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-chs-charcoal">Total earned (completed deals)</p>
          <p className="text-xl font-bold text-chs-charcoal mt-1">{formatNaira(totalEarned)}</p>
        </div>

        <div>
          <p className="text-xs font-bold text-chs-charcoal mb-2">My referrals ({referrals.length})</p>
          {referrals.length === 0 ? (
            <p className="text-sm text-gray-400">No referrals yet — share your link to get started.</p>
          ) : (
            referrals.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-3 mb-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-chs-charcoal">{r.masked_reference}</span>
                  <span className="text-[10px] font-bold uppercase text-chs-red bg-chs-amber-light px-2 py-1 rounded-full">
                    {STAGE_LABELS[r.stage]}
                  </span>
                </div>
                {r.agent_payout !== null && (
                  <p className="text-gray-500 mt-1">Your share: {formatNaira(r.agent_payout)}</p>
                )}
                {r.split_50_50 && <p className="text-gray-400 mt-1">Split 50/50 with another agent</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
