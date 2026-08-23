"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { startPromoCreditFunding } from "@/lib/paystack";

// Real, genuine listing promotion — the original app's version never
// actually charged anyone (a local variable update and a toast, no
// real payment). Built properly here: a real wallet debit through the
// existing real wallet infrastructure, with a real, checkable expiry.
//
// This fixed-tier system sits ALONGSIDE the newer credit-based system
// below, not replaced by it — a one-off boost for someone promoting a
// single listing once, versus reusable, pausable, day-by-day credits
// for an owner or agent managing several listings over time.
const PROMOTE_TIERS = [
  { name: "7-Day Boost", price: 5000, days: 7, desc: "Top of category results for a week" },
  { name: "30-Day Featured", price: 15000, days: 30, desc: "Priority in Featured Properties for a month" },
  { name: "90-Day Premium", price: 35000, days: 90, desc: "Best value — top placement for a full quarter" },
];

const RANK_LABELS: Record<string, string> = {
  A: "Category A — top placement in your local market",
  B: "Category B",
  C: "Category C",
  D: "Category D",
};

export default function PromoteListingPage() {
  const params = useParams();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"fixed" | "credits">("fixed");

  const [propertyTitle, setPropertyTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fixed-tier state — unchanged from the existing system.
  const [selectedTier, setSelectedTier] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ tier: string; price: number } | null>(null);

  // Credit-based state — real balance, real daily cost, real toggle.
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditsPerDay, setCreditsPerDay] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [rankCategory, setRankCategory] = useState<string | null>(null);
  const [rankNumber, setRankNumber] = useState<number | null>(null);
  const [bucketTopN, setBucketTopN] = useState<number | null>(null);
  const [otherActiveCount, setOtherActiveCount] = useState(0);
  const [otherActiveCreditsPerDay, setOtherActiveCreditsPerDay] = useState(0);
  const [toggling, setToggling] = useState(false);
  const [buyAmount, setBuyAmount] = useState<number | "">(50);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !session) return;
    (async () => {
      const { data: property } = await supabase
        .from("properties")
        .select("title, owner_id")
        .eq("id", params.id as string)
        .single();

      if (!property || property.owner_id !== session.user.id) {
        setError("This listing could not be found, or you don't have permission to promote it.");
        setLoading(false);
        return;
      }
      setPropertyTitle(property.title);

      const [{ data: balanceData }, { data: perDayData }, { data: promo }, { data: otherActive }] = await Promise.all([
        supabase.rpc("get_promo_credit_balance", { p_user_id: session.user.id }),
        supabase.rpc("get_credits_per_day", { p_property_id: params.id as string }),
        supabase
          .from("property_promotions")
          .select("is_active, rank_category, rank_number, bucket_top_n")
          .eq("property_id", params.id as string)
          .maybeSingle(),
        // The real "shared pool" picture — every OTHER listing this
        // owner currently has running, so the cost disclosure below
        // reflects their real total daily draw, not just this one
        // listing in isolation.
        supabase
          .from("property_promotions")
          .select("property_id")
          .eq("owner_id", session.user.id)
          .eq("is_active", true)
          .neq("property_id", params.id as string),
      ]);

      setCreditBalance(balanceData ?? 0);
      setCreditsPerDay(perDayData ?? 1);
      setIsActive(promo?.is_active ?? false);
      setRankCategory(promo?.rank_category ?? null);
      setRankNumber(promo?.rank_number ?? null);
      setBucketTopN(promo?.bucket_top_n ?? null);

      if (otherActive && otherActive.length > 0) {
        setOtherActiveCount(otherActive.length);
        const perDayValues = await Promise.all(
          otherActive.map((p) => supabase.rpc("get_credits_per_day", { p_property_id: p.property_id }))
        );
        setOtherActiveCreditsPerDay(perDayValues.reduce((sum, r) => sum + (r.data ?? 0), 0));
      }

      setLoading(false);
    })();
  }, [authLoading, session, params.id]);

  async function handleConfirmFixedTier() {
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

  async function handleToggleCredits() {
    if (!session) return;
    setToggling(true);
    setError(null);

    const nextActive = !isActive;
    const { error: rpcError } = await supabase.rpc("toggle_property_promotion", {
      p_property_id: params.id as string,
      p_is_active: nextActive,
    });

    setToggling(false);
    if (rpcError) {
      setError("Could not update promotion status. Please try again.");
      return;
    }
    setIsActive(nextActive);
  }

  async function handleBuyCredits() {
    if (!buyAmount || buyAmount < 5) {
      setBuyError("Please enter at least 5 credits.");
      return;
    }
    setBuyError(null);
    setBuying(true);
    try {
      await startPromoCreditFunding(
        buyAmount,
        () => {
          setBuying(false);
          setTimeout(async () => {
            if (!session) return;
            const { data } = await supabase.rpc("get_promo_credit_balance", { p_user_id: session.user.id });
            setCreditBalance(data ?? 0);
          }, 2000); // give the webhook a moment to land, same pattern as wallet funding
        },
        () => setBuying(false)
      );
    } catch {
      setBuying(false);
      setBuyError("Could not start payment. Please try again.");
    }
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
        <p className="text-sm text-gray-500 mb-4">{propertyTitle}</p>

        <div className="flex rounded-full bg-gray-100 p-1 mb-5">
          <button
            onClick={() => setMode("fixed")}
            className={`flex-1 py-2 rounded-full text-xs font-semibold ${mode === "fixed" ? "bg-white shadow text-chs-charcoal" : "text-gray-400"}`}
          >
            Fixed Boost
          </button>
          <button
            onClick={() => setMode("credits")}
            className={`flex-1 py-2 rounded-full text-xs font-semibold ${mode === "credits" ? "bg-white shadow text-chs-charcoal" : "text-gray-400"}`}
          >
            Credits (Pause Anytime)
          </button>
        </div>

        {mode === "fixed" && (
          <>
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

            <button onClick={handleConfirmFixedTier} disabled={submitting}
              className="w-full mt-4 py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
              {submitting ? "Processing..." : `Activate — ${formatNaira(PROMOTE_TIERS[selectedTier].price)}`}
            </button>
          </>
        )}

        {mode === "credits" && (
          <>
            {/* The real, explicit, plain-language disclosure — shown
                before the balance, before the toggle, before any
                payment button, exactly where a real person actually
                decides whether to buy. Not buried in Terms. */}
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 mb-3 space-y-2">
              <p className="text-xs font-bold text-amber-800">📖 How credits actually work — read this first</p>
              <p className="text-xs text-amber-800">
                Your credits are <strong>one shared balance</strong> across every listing you own — not split up per
                listing. <strong>Each listing you turn ON is charged separately, every day</strong>, for as long as
                it stays on. If you turn on 3 listings at once, you pay for all 3 that day, from the same balance.
              </p>
              <p className="text-xs text-amber-800">
                <strong>This listing costs {creditsPerDay ?? 1} credits/day</strong> — based on its real location
                and size. Other listings you own may cost more or less.
              </p>
              {otherActiveCount > 0 && (
                <p className="text-xs text-amber-800 bg-white/60 rounded-lg px-2 py-1.5">
                  You currently have <strong>{otherActiveCount} other listing{otherActiveCount > 1 ? "s" : ""}</strong> turned
                  on, together costing <strong>{otherActiveCreditsPerDay} credits/day</strong>. Turning this one on
                  too would bring your real total to <strong>{otherActiveCreditsPerDay + (creditsPerDay ?? 1)} credits/day</strong>.
                </p>
              )}
              <p className="text-xs text-amber-800">
                There&apos;s no fixed daily limit — the total just depends on how many listings you keep on and each
                one&apos;s own real cost. Turn any listing off any day for free; you&apos;re never charged for a day
                it was off.
              </p>
            </div>

            <div className="rounded-xl border-2 border-gray-200 bg-white p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Your credit balance</span>
                <span className="font-bold text-chs-charcoal">{creditBalance ?? 0} credits</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Cost for this listing</span>
                <span className="font-bold text-chs-charcoal">{creditsPerDay ?? 1} credits / day</span>
              </div>
              {rankCategory && (
                <div className="text-xs text-gray-500 bg-chs-amber-light rounded-lg px-3 py-2">
                  {RANK_LABELS[rankCategory] ?? `Category ${rankCategory}`}
                  {rankNumber && bucketTopN && (
                    <span className="block font-semibold text-chs-charcoal mt-0.5">
                      #{rankNumber} of Top {bucketTopN} in your local market
                    </span>
                  )}
                  {" "}— recalculated daily against other promoted listings in your local market. Spending more
                  relative to others in your same area/size raises your position; this doesn&apos;t cost extra on
                  its own — it&apos;s a comparison, not an add-on purchase.
                </div>
              )}

              <button
                onClick={handleToggleCredits}
                disabled={toggling}
                className={`w-full py-3 rounded-full text-sm font-semibold disabled:opacity-50 ${
                  isActive ? "bg-gray-200 text-chs-charcoal" : "bg-chs-red text-white"
                }`}
              >
                {toggling ? "Updating..." : isActive ? "Turn OFF promotion" : "Turn ON promotion"}
              </button>
              <p className="text-[10px] text-gray-400 text-center">
                Free to toggle, any day — you&apos;re only ever charged {creditsPerDay ?? 1} credits for a day
                it&apos;s actually turned on.
              </p>
            </div>

            {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2 mt-3">{error}</p>}

            <div className="rounded-xl border-2 border-gray-200 bg-white p-4 mt-4 space-y-2">
              <p className="text-sm font-bold text-chs-charcoal">Buy more credits</p>
              <p className="text-[10px] text-gray-400">₦400 per credit — reusable across any of your listings.</p>
              <input
                type="number"
                min={5}
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value ? Number(e.target.value) : "")}
                placeholder="Number of credits"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
              />
              {buyError && <p className="text-xs text-chs-red">{buyError}</p>}
              <button
                onClick={handleBuyCredits}
                disabled={buying}
                className="w-full py-3 rounded-full bg-chs-charcoal text-white text-sm font-semibold disabled:opacity-50"
              >
                {buying ? "Opening..." : `Buy ${buyAmount || 0} credits — ${formatNaira((buyAmount || 0) * 400)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
