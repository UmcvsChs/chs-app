"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

const REASONS = [
  { value: "relocation", label: "Relocating (travel, job, school, etc.)" },
  { value: "medical", label: "Urgent medical need" },
  { value: "financial", label: "Urgent financial need" },
  { value: "other", label: "Other genuine urgent reason" },
];

// The frontend for backend-v2/48_urgent_emergency_sale.sql — every
// real requirement enforced there (already verified, already
// ID-verified, a real discount, a real deadline) is surfaced here
// clearly UP FRONT, so an owner who doesn't yet qualify sees exactly
// why, rather than submitting and hitting a raw database error.
export default function UrgentSalePage() {
  const params = useParams();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState<{
    title: string; price: number; purpose: string; verification_status: string;
    is_urgent_sale: boolean; owner_id: string;
  } | null>(null);
  const [sellerVerified, setSellerVerified] = useState(false);

  const [originalPrice, setOriginalPrice] = useState<number | "">("");
  const [reason, setReason] = useState(REASONS[0].value);
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (authLoading || !session) return;
    (async () => {
      const [{ data: prop }, { data: profile }] = await Promise.all([
        supabase
          .from("properties")
          .select("title, price, purpose, verification_status, is_urgent_sale, owner_id")
          .eq("id", params.id as string)
          .single(),
        supabase
          .from("profiles")
          .select("valid_id_verified")
          .eq("id", session.user.id)
          .single(),
      ]);
      setProperty(prop);
      setSellerVerified(profile?.valid_id_verified ?? false);
      setLoading(false);
    })();
  }, [authLoading, session, params.id]);

  async function handleSubmit() {
    if (!originalPrice || !property || originalPrice <= property.price) {
      setError("The original price must be higher than your current listed price — this needs to be a real discount.");
      return;
    }
    if (!deadline) {
      setError("Please set a real date by which you need this sold.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("properties")
      .update({
        is_urgent_sale: true,
        urgent_sale_original_price: originalPrice,
        urgent_sale_reason: reason,
        urgent_sale_deadline: deadline,
      })
      .eq("id", params.id as string);

    setSubmitting(false);
    if (updateError) {
      // The database trigger's own real message — surfaced directly,
      // not swallowed behind a generic "something went wrong".
      setError(updateError.message);
      return;
    }
    setSuccess(true);
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }
  if (!session) {
    router.push("/login");
    return null;
  }
  if (!property || property.owner_id !== session.user.id) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm text-gray-500 mb-4">This listing could not be found, or you don&apos;t have permission to manage it.</p>
        <Link href="/owner" className="text-sm font-semibold text-chs-red">Back to My Properties</Link>
      </div>
    );
  }

  const qualifies = property.purpose === "sale" && property.verification_status === "verified" && sellerVerified;

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-lg font-semibold text-chs-charcoal mb-2">🚨 Urgent Sale is live</p>
        <p className="text-sm text-gray-500 mb-4">
          Our team has been notified and will help fast-track buyer interest for you.
        </p>
        <Link href="/owner" className="text-sm font-semibold text-chs-red">Back to My Properties</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen zone-owner bg-[var(--zone-bg)] px-4 py-8">
      <div className="max-w-md mx-auto">
        <Link href="/owner" className="text-xs text-gray-400">← Back to My Properties</Link>
        <h1 className="font-serif text-2xl font-bold text-red-600 mt-1 mb-1">🚨 Urgent Sale</h1>
        <p className="text-sm text-gray-500 mb-6">{property.title}</p>

        {property.is_urgent_sale && (
          <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-4">
            This listing is already an active Urgent Sale.
          </p>
        )}

        {!qualifies ? (
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-2">
            <p className="text-sm font-bold text-chs-charcoal mb-2">Before you can activate this:</p>
            <div className={`text-xs flex items-center gap-2 ${property.purpose === "sale" ? "text-green-600" : "text-red-500"}`}>
              {property.purpose === "sale" ? "✓" : "✕"} Listing purpose must be &quot;Sale&quot;
            </div>
            <div className={`text-xs flex items-center gap-2 ${property.verification_status === "verified" ? "text-green-600" : "text-red-500"}`}>
              {property.verification_status === "verified" ? "✓" : "✕"} Property must already be verified
            </div>
            <div className={`text-xs flex items-center gap-2 ${sellerVerified ? "text-green-600" : "text-red-500"}`}>
              {sellerVerified ? "✓" : "✕"} Your identity must be ID-verified
            </div>
            {!sellerVerified && (
              <Link href="/profile" className="inline-block mt-2 text-xs font-semibold text-chs-red underline">
                Verify your ID in Profile →
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Original price (current listed price is {formatNaira(property.price)})
              </label>
              <input
                type="number"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value ? Number(e.target.value) : "")}
                placeholder="e.g. 15,000,000"
                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Must be higher than your current price — this becomes the real, visible &quot;before&quot; price buyers see.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600">Reason</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600">Real deadline — when do you need this sold by?</label>
              <input
                type="date"
                value={deadline}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Once this date passes, Urgent Sale turns off automatically unless you renew it.
              </p>
            </div>

            {error && <p className="text-xs text-chs-red bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <button onClick={handleSubmit} disabled={submitting}
              className="w-full py-3 rounded-full bg-red-600 text-white text-sm font-semibold disabled:opacity-50">
              {submitting ? "Activating..." : "Activate Urgent Sale"}
            </button>
            <p className="text-[10px] text-gray-400 text-center">
              Our team is notified immediately and will help fast-track buyer interest.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
