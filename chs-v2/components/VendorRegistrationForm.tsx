"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ValidatedInput from "@/components/ValidatedInput";
import { Req, Opt, RequiredLegend } from "@/components/FormMarks";
import { validatePhone } from "@/lib/validators";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { LGA_BY_STATE, NIGERIAN_STATES } from "@/lib/geoData";
import { categoriesFor, KIND_LABEL, MarketplaceKind } from "@/lib/marketplaceCategories";
import type { MarketplaceCategory } from "@/types/marketplace";

// One registration form for the two marketplace paths, so they can never drift apart:
//   kind "vendor"   — sells GOODS (Interior Design, Furniture, Bedding & Textiles, Electronics & Home Appliances, Kitchen, Building Materials)
//   kind "service"  — a SERVICE PROVIDER (Security, Cleaning, Fumigation & Pest Control, Facilities Maintenance)
// The category list shows only the categories that belong to the chosen path. State and LGA are dropdowns, and a service
// provider ticks the states it genuinely covers rather than typing them.
export default function VendorRegistrationForm({ kind }: { kind: MarketplaceKind }) {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const categories = categoriesFor(kind);
  const label = KIND_LABEL[kind];

  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState<MarketplaceCategory>(categories[0].value);
  const [cacNumber, setCacNumber] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("Kaduna");
  const [lga, setLga] = useState("");
  const [coverage, setCoverage] = useState<string[]>(["Kaduna"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const lgas = LGA_BY_STATE[state] || [];

  function changeState(next: string) {
    setState(next);
    setLga(""); // an LGA belongs to ONE state: never keep one from the previous choice
    if (kind === "service" && !coverage.includes(next)) setCoverage([...coverage, next]);
  }
  function toggleCoverage(s: string) {
    setCoverage(coverage.includes(s) ? coverage.filter((x) => x !== s) : [...coverage, s]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    if (!businessName.trim()) { setError("Please enter your business name."); return; }
    const phoneCheck = validatePhone(phone, { international: true });
    if (!phone.trim() || !phoneCheck.valid) { setError(`Phone number: ${phone.trim() ? phoneCheck.message : "please enter your business phone number."}`); return; }
    if (!state) { setError("Please choose your state."); return; }
    if (!lga) { setError("Please choose your LGA."); return; }
    if (kind === "service" && coverage.length === 0) { setError("Please tick at least one state you cover."); return; }
    setError(null);
    setSubmitting(true);

    // A vendor's real proof is CAC registration — separate from a property owner's NIN/liveness check. Starts
    // unverified; CHS is alerted automatically (database trigger) and reviews it under Verification.
    const { error: insertError } = await supabase.from("marketplace_vendors").insert({
      user_id: session.user.id,
      business_name: businessName.trim(),
      category,
      cac_number: cacNumber.trim() || null,
      description: description.trim() || null,
      phone: phoneCheck.value,
      location_state: state,
      location_lga: lga,
      service_states: kind === "service" ? coverage : null,
      verification_status: "pending",
    });
    if (insertError) {
      setError("Could not complete your registration. Please try again.");
      setSubmitting(false);
      return;
    }
    setSuccess(true);
  }

  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  if (!session) { router.push("/login"); return null; }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-lg font-semibold text-chs-charcoal mb-2">✓ {label} registration submitted</p>
        <p className="text-sm text-gray-500 mb-5 max-w-sm">CHS has been alerted and will verify {businessName.trim()}. You can add your listings now; they become visible to buyers once you are verified.</p>
        <Link href="/vendor" className="text-sm font-semibold text-white bg-chs-red px-5 py-2.5 rounded-full">Go to my {label.toLowerCase()} dashboard</Link>
      </div>
    );
  }

  const field = "w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white";
  return (
    <div className="min-h-screen zone-market-browse bg-[var(--zone-bg)] px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">Register as a {label}</h1>
        <p className="text-sm text-gray-500 mb-4">
          {kind === "vendor" ? "Sell goods — furniture, electronics, building materials and more — through CHS." : "Offer security, cleaning, fumigation or facilities maintenance through CHS."}
        </p>
        <RequiredLegend className="mb-3" />

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Business name<Req /></label>
            <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={field} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">{kind === "vendor" ? "What you sell" : "Service you provide"}<Req /></label>
            <select value={category} onChange={(e) => setCategory(e.target.value as MarketplaceCategory)} className={field}>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">{categories.find((c) => c.value === category)?.blurb}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">CAC registration number<Opt /></label>
            <input type="text" value={cacNumber} onChange={(e) => setCacNumber(e.target.value)} className={field} />
            <p className="text-[10px] text-gray-400 mt-1">Verification is faster with it.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Business phone number<Req /></label>
            <ValidatedInput kind="phoneIntl" value={phone} onChange={setPhone} className="w-full mt-1 px-3 py-2.5 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">State<Req /></label>
            <select value={state} onChange={(e) => changeState(e.target.value)} className={field}>
              {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">LGA<Req /></label>
            <select value={lga} onChange={(e) => setLga(e.target.value)} className={field}>
              <option value="">Select your LGA</option>
              {lgas.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          {kind === "service" && (
            <div>
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-600">States you genuinely cover<Req /></label>
                <span className="text-[10px]">
                  <button type="button" onClick={() => setCoverage([...NIGERIAN_STATES])} className="font-semibold text-chs-red underline">All</button>
                  <span className="text-gray-300"> · </span>
                  <button type="button" onClick={() => setCoverage([])} className="font-semibold text-gray-500 underline">Clear</button>
                </span>
              </div>
              <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg bg-white p-2 grid grid-cols-2 gap-x-2 gap-y-1">
                {NIGERIAN_STATES.map((s) => (
                  <label key={s} className="flex items-center gap-1.5 text-[11px] text-chs-charcoal">
                    <input type="checkbox" checked={coverage.includes(s)} onChange={() => toggleCoverage(s)} />{s}
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{coverage.length} state{coverage.length !== 1 ? "s" : ""} selected. Only shown to clients in these states.</p>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-600">About your business<Opt /></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={field} />
          </div>
          {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
            {submitting ? "Submitting..." : `Register as a ${label}`}
          </button>
        </form>
      </div>
    </div>
  );
}
