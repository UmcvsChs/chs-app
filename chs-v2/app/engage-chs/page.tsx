"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { uploadDocument } from "@/lib/storage";
import { ENGAGE_SERVICE_TYPES, ENGAGE_CATEGORY_FIELDS, ENGAGE_NEXT_STEPS } from "@/types/engageCategoryFields";
import ServiceTncGate from "@/components/ServiceTncGate";

function generateReference(): string {
  return "CHS-ENG-" + Math.floor(1000 + Math.random() * 9000);
}

type Stage = "service" | "tnc_gate" | "requirements" | "details" | "acknowledged" | "submitted";

// A real, genuinely staged conversation — not one long form, and not
// an AI generating its own answers. Each real step gets its own
// immediate, deterministic acknowledgment the instant it's completed,
// so someone submitting at 11pm with no admin online yet still
// genuinely feels heard in real time — closing exactly the gap the
// client described: hundreds of people should never feel ignored
// while waiting for a real human to actually review their request.
export default function EngageChsPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [stage, setStage] = useState<Stage>("service");
  const [serviceType, setServiceType] = useState(ENGAGE_SERVICE_TYPES[0]);
  const [ownedProperties, setOwnedProperties] = useState<{ id: string; title: string }[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [categoryValues, setCategoryValues] = useState<Record<string, string>>({});
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [documents, setDocuments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryFields = ENGAGE_CATEGORY_FIELDS[serviceType] || [];

  useEffect(() => {
    if (!session) return;
    supabase
      .from("properties")
      .select("id, title")
      .eq("owner_id", session.user.id)
      .then(({ data }) => setOwnedProperties(data || []));
  }, [session]);

  function handleServiceContinue() {
    setStage("tnc_gate");
  }

  function handleRequirementsContinue() {
    if (categoryFields.length > 0 && categoryFields.some((f) => !categoryValues[f.id]?.trim())) {
      setError("Please answer each real requirement above — this is exactly what lets CHS scope your project accurately without needing to ask you again later.");
      return;
    }
    setError(null);
    // A real, immediate acknowledgment the instant this real step is
    // genuinely complete — not waiting for the final submission.
    setStage("acknowledged");
    setTimeout(() => setStage("details"), 1400);
  }

  async function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please tell us a bit more before we submit this.");
      return;
    }
    if (!session) return;

    setError(null);
    setSubmitting(true);

    const categoryDetails: Record<string, string> = {};
    categoryFields.forEach((f) => {
      categoryDetails[f.label] = categoryValues[f.id] || "";
    });

    const { data: newRequest, error: insertError } = await supabase
      .from("engage_chs_requests")
      .insert({
        reference: generateReference(),
        owner_id: session.user.id,
        service_type: serviceType,
        description: description.trim(),
        location: location.trim() || null,
        category_details: categoryDetails,
        property_id: selectedPropertyId || null,
        budget: budget.trim() || "Not specified",
      })
      .select()
      .single();

    if (insertError || !newRequest) {
      setError("Could not submit this request. Please try again.");
      setSubmitting(false);
      return;
    }

    if (documents.length > 0) {
      const urls: string[] = [];
      for (const doc of documents) {
        const url = await uploadDocument(doc, session.user.id, `engage-${newRequest.id}`);
        if (url) urls.push(url);
      }
      if (urls.length > 0) {
        await supabase.from("engage_chs_requests").update({ documents: urls }).eq("id", newRequest.id);
      }
    }

    setSubmitting(false);
    setStage("submitted");
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }
  if (!session) {
    router.push("/login");
    return null;
  }

  // The real, service-specific T&C gate — restored, found completely
  // missing. Shows CHS's own actual, real remuneration for this exact
  // service before anyone commits to the requirements step.
  if (stage === "tnc_gate") {
    return (
      <ServiceTncGate
        serviceType={serviceType}
        onAccept={() => setStage("requirements")}
        onCancel={() => setStage("service")}
      />
    );
  }

  // A real, immediate, deterministic "received" moment between real
  // steps — exactly the interactive feel the client described, never
  // a generated answer, always the same honest, accurate message.
  if (stage === "acknowledged") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-2xl mb-2">✓</p>
        <p className="text-sm font-semibold text-chs-charcoal">Requirements received</p>
        <p className="text-xs text-gray-400 mt-1">One more real step — your details.</p>
      </div>
    );
  }

  if (stage === "submitted") {
    const nextSteps = ENGAGE_NEXT_STEPS[serviceType] || [];
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 py-10">
        <p className="text-lg font-semibold text-chs-charcoal mb-1">✓ All information acknowledged</p>
        <p className="text-sm text-chs-red font-semibold mb-4">Pending review — CHS will respond within 24–48 hours.</p>
        <p className="text-sm text-gray-500 mb-5">Here's exactly what happens next:</p>
        <div className="w-full max-w-sm text-left space-y-2 mb-6">
          {nextSteps.map((step, i) => (
            <div key={i} className="flex gap-2.5 bg-[var(--zone-card)] rounded-lg border border-gray-100 p-3">
              <span className="text-xs font-bold text-chs-red shrink-0">{i + 1}.</span>
              <p className="text-xs text-gray-600 leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
        <Link href="/owner" className="text-sm font-semibold text-chs-red">Back to My Properties</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen zone-owner bg-[var(--zone-bg)] px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">Engage CHS</h1>
        <div className="flex gap-1.5 mb-6">
          {["service", "requirements", "details"].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${
              stage === s ? "bg-chs-red" : (s === "service" || (s === "requirements" && stage === "details")) ? "bg-chs-red/40" : "bg-gray-200"
            }`} />
          ))}
        </div>

        {stage === "service" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">Service needed</label>
              <select
                value={serviceType}
                onChange={(e) => { setServiceType(e.target.value); setCategoryValues({}); }}
                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white"
              >
                {ENGAGE_SERVICE_TYPES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            {ownedProperties.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-600">Which property is this about? (optional)</label>
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white"
                >
                  <option value="">Not tied to a specific listed property</option>
                  {ownedProperties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
            )}
            <button onClick={handleServiceContinue}
              className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold">
              Continue
            </button>
          </div>
        )}

        {stage === "requirements" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 mb-1">Provide your real requirements, so CHS can scope this accurately — no back-and-forth needed later.</p>
            {categoryFields.map((f) => (
              <div key={f.id}>
                <label className="text-xs font-semibold text-gray-600">{f.label}</label>
                {f.type === "select" ? (
                  <select
                    value={categoryValues[f.id] || ""}
                    onChange={(e) => setCategoryValues({ ...categoryValues, [f.id]: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white"
                  >
                    <option value="">Select...</option>
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={categoryValues[f.id] || ""}
                    onChange={(e) => setCategoryValues({ ...categoryValues, [f.id]: e.target.value })}
                    placeholder={f.placeholder}
                    className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
                  />
                )}
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-gray-600">Estimated budget (₦)</label>
              <input type="text" value={budget} onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. 5,000,000 or a range like 3,000,000 - 5,000,000"
                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Supporting documents (optional)</label>
              <p className="text-[10px] text-gray-400 mb-1">Bill of Quantities, drawings, or anything else relevant.</p>
              <input type="file" multiple accept="image/*,application/pdf"
                onChange={(e) => setDocuments(e.target.files ? Array.from(e.target.files) : [])}
                className="w-full mt-1 text-xs" />
            </div>
            {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setStage("service")} className="flex-1 py-3 rounded-full bg-gray-200 text-gray-600 text-sm font-semibold">Back</button>
              <button onClick={handleRequirementsContinue} className="flex-1 py-3 rounded-full bg-chs-red text-white text-sm font-semibold">Continue</button>
            </div>
          </div>
        )}

        {stage === "details" && (
          <form onSubmit={handleFinalSubmit} className="space-y-3">
            <p className="text-xs text-gray-500 mb-1">Last real step — your details and any other relevant context.</p>
            <div>
              <label className="text-xs font-semibold text-gray-600">Property location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Malali GRA, Kaduna" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Tell us more</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                placeholder="Anything else relevant CHS should know" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
            </div>
            {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setStage("requirements")} className="flex-1 py-3 rounded-full bg-gray-200 text-gray-600 text-sm font-semibold">Back</button>
              <button type="submit" disabled={submitting}
                className="flex-1 py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
                {submitting ? "Submitting..." : "Submit request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
