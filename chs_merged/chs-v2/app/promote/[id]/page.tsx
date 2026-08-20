"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

// Real, genuine listing promotion — the original app's version never
// actually charged anyone (a local variable update and a toast, no
// real payment). Built properly here: a real wallet debit through the
// existing real wallet infrastructure, with a real, checkable expiry.
const PROMOTE_TIERS = [
  { name: "7-Day Boost", price: 5000, days: 7, desc: "Top of category results for a week" },
  { name: "30-Day Featured", price: 15000, days: 30, desc: "Priority in Featured Properties for a month" },
  { name: "90-Day Premium", price: 35000, days: 90, desc: "Best value — top placement for a full quarter" },
];

export default function PromoteListingPage() {
  const params = useParams();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [propertyTitle, setPropertyTitle] = useState("");
  const [selectedTier, setSelectedTier] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ tier: string; price: number } | null>(null);

  useEffect(() => {
    if (authLoading || !session) return;
    supabase
      .from("properties")
      .select("title, owner_id")
      .eq("id", params.id as string)
      .single()
      .then(({ data }) => {
        if (!data || data.owner_id !== session.user.id) {
          setError("This listing could not be found, or you don't have permission to promote it.");
        } else {
          setPropertyTitle(data.title);
        }
        setLoading(false);
      });
  }, [authLoading, session, params.id]);

  async function handleConfirm() {
    if (!session) return;
    const tier = PROMOTE_TIERS[selectedTier];
    setSubmitting(true);
    setError(null);

    const { data: succeeded, error: rpcError } = await supabase.rpc("promote_listing", {
      p_property_id: params.id as string,
      p_owner_id: session.user.id,
      p_amount: tier.price,
      p_days: tier.days,
      p_tier_name: tier.name,
    });

    setSubmitting(false);
    if (rpcError || !succeeded) {
      setError("Insufficient wallet balance for this tier. Please top up your wallet first.");
      return;
    }
    setSuccess({ tier: tier.name, price: tier.price });
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }
  if (!session) {
    router.push("/login");
    return null;
  }
  if (error && !propertyTitle) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm text-gray-500 mb-4">{error}</p>
        <Link href="/owner" className="text-sm font-semibold text-chs-red">Back to My Properties</Link>
      </div>
    );
  }
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-lg font-semibold text-chs-charcoal mb-2">⭐ {success.tier} activated</p>
        <p className="text-sm text-gray-500 mb-4">
          {formatNaira(success.price)} was genuinely debited from your wallet — your listing now appears first.
        </p>
        <Link href="/owner" className="text-sm font-semibold text-chs-red">Back to My Properties</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen zone-owner bg-[var(--zone-bg)] px-4 py-8">
      <div className="max-w-md mx-auto">
        <Link href="/owner" className="text-xs text-gray-400">← Back to My Properties</Link>
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mt-1 mb-1">⭐ Promote listing</h1>
        <p className="text-sm text-gray-500 mb-6">{propertyTitle}</p>

        <div className="space-y-2">
          {PROMOTE_TIERS.map((tier, i) => (
            <button
              key={tier.name}
              onClick={() => setSelectedTier(i)}
              className={`w-full text-left rounded-xl p-3 border-2 ${
                selectedTier === i ? "border-chs-red bg-chs-amber-light" : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-chs-charcoal">{tier.name}</span>
                <span className="font-serif text-base font-bold text-chs-red">{formatNaira(tier.price)}</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">{tier.desc}</p>
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2 mt-3">{error}</p>}

        <button onClick={handleConfirm} disabled={submitting}
          className="w-full mt-4 py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
          {submitting ? "Processing..." : `Activate — ${formatNaira(PROMOTE_TIERS[selectedTier].price)}`}
        </button>
      </div>
    </div>
  );
}
