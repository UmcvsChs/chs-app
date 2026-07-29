"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { MarketplaceCategory } from "@/types/marketplace";

const CATEGORIES: { value: MarketplaceCategory; label: string }[] = [
  { value: "interior_design", label: "Interior Design" },
  { value: "furniture", label: "Furniture" },
  { value: "bedding_textiles", label: "Bedding & Textiles" },
  { value: "home_equipment", label: "Electronics & Home Appliances" },
  { value: "kitchen_supplies", label: "Kitchen" },
  { value: "building_materials", label: "Building Materials" },
  { value: "security_services", label: "Security Services" },
  { value: "cleaning_services", label: "Cleaning Services" },
  { value: "fumigation_pest_control", label: "Fumigation & Pest Control" },
  { value: "facilities_maintenance", label: "Facilities Maintenance" },
];
// A service-type vendor's real work depends on genuinely covering the
// area a client is in — a security firm operating only in Lagos is no
// use to someone in Kaduna. Products don't have this same constraint.
const SERVICE_CATEGORIES: MarketplaceCategory[] = [
  "security_services", "cleaning_services", "fumigation_pest_control", "facilities_maintenance",
];
import { NIGERIAN_STATES } from "@/lib/geoData";

export default function BecomeVendorPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState<MarketplaceCategory>("furniture");
  const [cacNumber, setCacNumber] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("Kaduna");
  const [lga, setLga] = useState("");
  const [serviceStates, setServiceStates] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isServiceCategory = SERVICE_CATEGORIES.includes(category);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) {
      setError("Please enter your business name.");
      return;
    }
    if (!session) return;

    setError(null);
    setSubmitting(true);

    // Genuinely separate verification path from a real-estate owner's
    // NIN/liveness check — a vendor's real proof is CAC registration,
    // matching exactly how the original schema was designed. Starts
    // unverified, same honest human-reviewed pattern used throughout.
    const { error: insertError } = await supabase.from("marketplace_vendors").insert({
      user_id: session.user.id,
      business_name: businessName.trim(),
      category,
      cac_number: cacNumber.trim() || null,
      description: description.trim() || null,
      phone: phone.trim() || null,
      location_state: state,
      location_lga: lga.trim() || null,
      service_states: isServiceCategory ? serviceStates.split(",").map((s) => s.trim()).filter(Boolean) : null,
      verification_status: "pending",
    });

    if (insertError) {
      setError("Could not register as a vendor. Please try again.");
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
        <p className="text-lg font-semibold text-chs-charcoal mb-2">✓ Vendor registration submitted</p>
        <p className="text-sm text-gray-500 mb-4">
          CHS will review and verify your business before your products appear publicly.
        </p>
        <Link href="/vendor" className="text-sm font-semibold text-chs-red">Go to your vendor dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">Become a Marketplace vendor</h1>
        <p className="text-sm text-gray-500 mb-6">Sell furniture, materials, and more through CHS.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Business name</label>
            <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as MarketplaceCategory)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">CAC registration number (if applicable)</label>
            <input type="text" value={cacNumber} onChange={(e) => setCacNumber(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Phone number</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">State</label>
            <select value={state} onChange={(e) => setState(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
              {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">LGA</label>
            <input type="text" value={lga} onChange={(e) => setLga(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          {isServiceCategory && (
            <div>
              <label className="text-xs font-semibold text-gray-600">States you genuinely cover</label>
              <input type="text" value={serviceStates} onChange={(e) => setServiceStates(e.target.value)}
                placeholder="e.g. Lagos, Abuja (FCT), Kaduna"
                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              <p className="text-[10px] text-gray-400 mt-1">
                Separate multiple states with commas. Only shown to clients in these states.
              </p>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-600">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={submitting}
            className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
            {submitting ? "Submitting..." : "Register as vendor"}
          </button>
        </form>
      </div>
    </div>
  );
}
