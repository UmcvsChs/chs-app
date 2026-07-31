"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { uploadDocument } from "@/lib/storage";
import { ARTISAN_TRADES, EQUIPMENT_TIERS } from "@/types/artisan";
import { NIGERIAN_STATES, LGA_BY_STATE } from "@/lib/geoData";

export default function BecomeArtisanPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [trade, setTrade] = useState("painter");
  const [otherTrade, setOtherTrade] = useState("");
  const [yearsExperience, setYearsExperience] = useState<number | "">("");
  const [certBody, setCertBody] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);
  const [equipmentTier, setEquipmentTier] = useState("basic");
  const [baseState, setBaseState] = useState("Kaduna");
  const [baseLga, setBaseLga] = useState("");
  const [willingToTravel, setWillingToTravel] = useState(false);
  const [artisanType, setArtisanType] = useState<"independent" | "chs_agent">("independent");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (trade === "other" && !otherTrade.trim()) {
      setError("Please describe your trade.");
      return;
    }
    if (!yearsExperience && yearsExperience !== 0) {
      setError("Please enter your years of experience.");
      return;
    }
    if (!session) return;

    setError(null);
    setSubmitting(true);

    let certUrl: string | null = null;
    if (certFile) certUrl = await uploadDocument(certFile, session.user.id, "artisan-certification");

    const { error: insertError } = await supabase.from("artisans").insert({
      user_id: session.user.id,
      trade,
      other_trade_description: trade === "other" ? otherTrade.trim() : null,
      years_experience: yearsExperience,
      certification_body: certBody.trim() || null,
      certification_document_url: certUrl,
      equipment_tier: equipmentTier,
      base_state: baseState,
      base_lga: baseLga.trim() || null,
      willing_to_travel_interstate: willingToTravel,
      artisan_type: artisanType,
      verification_status: "pending",
    });

    if (insertError) {
      setError("Could not submit your registration. Please try again.");
      setSubmitting(false);
      return;
    }
    setSuccess(true);
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }
  if (!session) {
    router.push("/login");
    return null;
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-lg font-semibold text-chs-charcoal mb-2">✓ Registration submitted</p>
        <p className="text-sm text-gray-500 mb-4">
          CHS will review your details before you appear in the real, verified pool of maintenance artisans. Your work will be rated after every completed job — that&apos;s genuinely what earns you priority here.
        </p>
        <Link href="/" className="text-sm font-semibold text-chs-red">Back to homepage</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">Register as a Maintenance Artisan</h1>
        <p className="text-sm text-gray-500 mb-6">
          Join CHS&apos;s real, verified pool of trusted artisans — painters, plumbers, electricians, carpenters, bricklayers, and more.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Trade</label>
            <select value={trade} onChange={(e) => setTrade(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
              {ARTISAN_TRADES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {trade === "other" && (
            <input type="text" value={otherTrade} onChange={(e) => setOtherTrade(e.target.value)}
              placeholder="Describe your trade" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          )}

          <div>
            <label className="text-xs font-semibold text-gray-600">Years of experience</label>
            <input type="number" min={0} value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value === "" ? "" : parseInt(e.target.value))}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Certification body (optional)</label>
            <input type="text" value={certBody} onChange={(e) => setCertBody(e.target.value)}
              placeholder="e.g. NABTEB, a trade association — leave blank if none"
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>

          {certBody.trim() && (
            <div>
              <label className="text-xs font-semibold text-gray-600">Upload your certificate</label>
              <input type="file" accept="image/*,application/pdf" onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                className="w-full mt-1 text-xs" />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-600">Equipment level</label>
            <select value={equipmentTier} onChange={(e) => setEquipmentTier(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
              {EQUIPMENT_TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Base state</label>
            <select value={baseState} onChange={(e) => { setBaseState(e.target.value); setBaseLga(""); }}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
              {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Base LGA</label>
            <select value={baseLga} onChange={(e) => setBaseLga(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
              <option value="">Select an LGA</option>
              {(LGA_BY_STATE[baseState] || []).map((lga) => <option key={lga}>{lga}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={willingToTravel} onChange={(e) => setWillingToTravel(e.target.checked)} />
            I&apos;m willing to travel interstate when a job genuinely requires it
          </label>

          <div>
            <label className="text-xs font-semibold text-gray-600">Registering as</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button type="button" onClick={() => setArtisanType("independent")}
                className={`py-2 rounded-lg border-2 text-xs font-semibold ${artisanType === "independent" ? "border-chs-red bg-chs-amber-light" : "border-gray-200 bg-white"}`}>
                Independent
              </button>
              <button type="button" onClick={() => setArtisanType("chs_agent")}
                className={`py-2 rounded-lg border-2 text-xs font-semibold ${artisanType === "chs_agent" ? "border-chs-red bg-chs-amber-light" : "border-gray-200 bg-white"}`}>
                CHS Maintenance Agent
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={submitting}
            className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
            {submitting ? "Submitting..." : "Register"}
          </button>
        </form>
      </div>
    </div>
  );
}
