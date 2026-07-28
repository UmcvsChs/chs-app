"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const SERVICE_TYPES = [
  "Full property management",
  "Tenant sourcing only",
  "Rent collection only",
  "Maintenance coordination only",
];

function generateReference(): string {
  return "CHS-ENG-" + Math.floor(1000 + Math.random() * 9000);
}

export default function EngageChsPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please tell us a bit about what you need.");
      return;
    }
    if (!session) return;

    setError(null);
    setSubmitting(true);

    const { error: insertError } = await supabase.from("engage_chs_requests").insert({
      reference: generateReference(),
      owner_id: session.user.id,
      service_type: serviceType,
      description: description.trim(),
      location: location.trim() || null,
    });

    if (insertError) {
      setError("Could not submit this request. Please try again.");
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
        <p className="text-lg font-semibold text-chs-charcoal mb-2">✓ Request submitted</p>
        <p className="text-sm text-gray-500 mb-4">CHS will reach out to you shortly to discuss this.</p>
        <Link href="/owner" className="text-sm font-semibold text-chs-red">Back to My Properties</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">Engage CHS</h1>
        <p className="text-sm text-gray-500 mb-6">
          Let CHS professionally manage your property, so you don&apos;t have to.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Service needed</label>
            <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
              {SERVICE_TYPES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Property location</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Malali GRA, Kaduna" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Tell us more</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
              placeholder="What do you need help with?" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={submitting}
            className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
            {submitting ? "Submitting..." : "Submit request"}
          </button>
        </form>
      </div>
    </div>
  );
}
