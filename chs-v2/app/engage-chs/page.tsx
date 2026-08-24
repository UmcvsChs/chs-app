"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { uploadDocument } from "@/lib/storage";
import { ENGAGE_SERVICE_TYPES, ENGAGE_CATEGORY_FIELDS, ENGAGE_NEXT_STEPS, ENGAGE_SPECIFICATION_FIELDS } from "@/types/engageCategoryFields";
import ServiceTncGate from "@/components/ServiceTncGate";
import CurrencyInput from "@/components/CurrencyInput";

function generateReference(): string {
  return "CHS-ENG-" + Math.floor(1000 + Math.random() * 9000);
}

type Stage = "service" | "tnc_gate" | "requirements" | "details" | "acknowledged" | "review" | "submitted";

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
  const [budgetMin, setBudgetMin] = useState<number | "">("");
  const [budgetMax, setBudgetMax] = useState<number | "">("");
  const [wantsToSpecify, setWantsToSpecify] = useState(true);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [documents, setDocuments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryFields = ENGAGE_CATEGORY_FIELDS[serviceType] || [];
  const showSpecifications = serviceType === "Full construction / project management" || serviceType === "Renovation project management";

  useEffect(() => {
    if (!session) return;
    supabase
      .from("properties")
      .select("id, title")
      .eq("owner_id", session.user.id)
      .then(({ data }) => setOwnedProperties(data || []));
  }, [session]);

  useEffect(() => {
    // Real, sensible default — the client's own registered email, so
    // they don't have to retype it unless it's genuinely different.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (session?.user.email && !contactEmail) setContactEmail(session.user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function handleReviewContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please tell us a bit more before we submit this.");
      return;
    }
    if (!contactPhone.trim()) {
      setError("Please provide an active phone number — so CHS can call you directly if anything needs quick clarification.");
      return;
    }
    if (!contactEmail.trim()) {
      setError("Please provide a real email address.");
      return;
    }
    // The real fix, per direct instruction: nothing gets submitted yet
    // — a genuine plain-language summary of everything entered comes
    // first, so both sides are confirmed on the same page before
    // anything is actually sent.
    setError(null);
    setStage("review");
  }

  async function handleActualSubmit() {
    if (!session) return;

    setError(null);
    setSubmitting(true);

    const categoryDetails: Record<string, string> = {};
    categoryFields.forEach((f) => {
      categoryDetails[f.label] = categoryValues[f.id] || "";
    });
    if (showSpecifications) {
      categoryDetails["Client preferences"] = wantsToSpecify ? "Client has specific preferences (below)" : "Client asked CHS to recommend, subject to client approval";
      if (wantsToSpecify) {
        ENGAGE_SPECIFICATION_FIELDS.forEach((f) => {
          if (categoryValues[f.id]?.trim()) {
            categoryDetails[`Specification: ${f.label}`] = categoryValues[f.id].trim();
          }
        });
      }
    }

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
        contact_phone: contactPhone.trim(),
        contact_email: contactEmail.trim(),
        budget: budgetMin === "" ? "Not specified"
          : budgetMax === "" || budgetMax === budgetMin ? `₦${budgetMin.toLocaleString("en-NG")}`
          : `₦${budgetMin.toLocaleString("en-NG")} - ₦${budgetMax.toLocaleString("en-NG")}`,
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
        <p className="text-sm text-gray-500 mb-5">Here&apos;s exactly what happens next:</p>
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
            {(serviceType === "Construction monitoring" || serviceType === "Full construction / project management") && (
              <Link href="/construction-roadmap"
                className="block bg-chs-amber-light rounded-lg px-3 py-2.5 text-xs text-chs-amber-dark">
                🏗️ Before you continue — see real quantities, permits, and payment plan by bedroom count →
              </Link>
            )}
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

            {showSpecifications && (
              <div className="rounded-xl border-2 border-gray-200 bg-white p-3 space-y-3">
                <p className="text-xs font-bold text-chs-charcoal">Material & finish preferences</p>
                <p className="text-[10px] text-gray-400">
                  Real, specific preferences some clients hold strongly to (cement brand, block type, roof color, and
                  more) — genuinely optional. Tell us exactly what you want, or let CHS recommend and you approve.
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setWantsToSpecify(true)}
                    className={`flex-1 py-2 rounded-full text-xs font-semibold ${wantsToSpecify ? "bg-chs-red text-white" : "bg-gray-100 text-gray-500"}`}>
                    I have specific preferences
                  </button>
                  <button type="button" onClick={() => setWantsToSpecify(false)}
                    className={`flex-1 py-2 rounded-full text-xs font-semibold ${!wantsToSpecify ? "bg-chs-red text-white" : "bg-gray-100 text-gray-500"}`}>
                    Let CHS recommend
                  </button>
                </div>
                {wantsToSpecify && ENGAGE_SPECIFICATION_FIELDS.map((f) => (
                  <div key={f.id}>
                    <label className="text-xs font-semibold text-gray-600">{f.label}</label>
                    <input
                      type="text"
                      value={categoryValues[f.id] || ""}
                      onChange={(e) => setCategoryValues({ ...categoryValues, [f.id]: e.target.value })}
                      placeholder={f.placeholder}
                      className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-xs"
                    />
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-600">Estimated budget (₦)</label>
              <p className="text-[10px] text-gray-400 mb-1">Fills in real comma-separated Naira as you type — leave the second box empty if you have one exact figure, not a range.</p>
              <div className="flex gap-2">
                <CurrencyInput value={budgetMin} onChange={setBudgetMin} placeholder="Minimum (or exact amount)" />
                <CurrencyInput value={budgetMax} onChange={setBudgetMax} placeholder="Maximum (optional)" />
              </div>
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
          <form onSubmit={handleReviewContinue} className="space-y-3">
            <p className="text-xs text-gray-500 mb-1">Last real step — your details and any other relevant context.</p>
            <div>
              <label className="text-xs font-semibold text-gray-600">Property location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Malali GRA, Kaduna" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-600">Active phone number</label>
                <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="080..." className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Email</label>
                <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@email.com" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 -mt-2">
              So CHS can call you directly if anything ever needs quick, real clarification.
            </p>
            <div>
              <label className="text-xs font-semibold text-gray-600">Tell us more</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                placeholder="Anything else relevant CHS should know" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
            </div>
            {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setStage("requirements")} className="flex-1 py-3 rounded-full bg-gray-200 text-gray-600 text-sm font-semibold">Back</button>
              <button type="submit"
                className="flex-1 py-3 rounded-full bg-chs-red text-white text-sm font-semibold">
                Review before submitting
              </button>
            </div>
          </form>
        )}

        {stage === "review" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 mb-1">
              Please confirm this is accurate — nothing has been sent to CHS yet.
            </p>
            <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3 text-xs">
              <div>
                <p className="font-bold text-chs-charcoal">Service</p>
                <p className="text-gray-600">{serviceType}</p>
              </div>
              {categoryFields.filter((f) => categoryValues[f.id]?.trim()).length > 0 && (
                <div>
                  <p className="font-bold text-chs-charcoal">Your requirements</p>
                  {categoryFields.filter((f) => categoryValues[f.id]?.trim()).map((f) => (
                    <p key={f.id} className="text-gray-600">{f.label}: <span className="text-chs-charcoal">{categoryValues[f.id]}</span></p>
                  ))}
                </div>
              )}
              {showSpecifications && (
                <div>
                  <p className="font-bold text-chs-charcoal">Material & finish preferences</p>
                  <p className="text-gray-600">
                    {wantsToSpecify ? "You have specific preferences:" : "You asked CHS to recommend, subject to your approval."}
                  </p>
                  {wantsToSpecify && ENGAGE_SPECIFICATION_FIELDS.filter((f) => categoryValues[f.id]?.trim()).map((f) => (
                    <p key={f.id} className="text-gray-600">{f.label}: <span className="text-chs-charcoal">{categoryValues[f.id]}</span></p>
                  ))}
                </div>
              )}
              <div>
                <p className="font-bold text-chs-charcoal">Budget</p>
                <p className="text-gray-600">
                  {budgetMin === "" ? "Not specified"
                    : budgetMax === "" || budgetMax === budgetMin ? `₦${budgetMin.toLocaleString("en-NG")}`
                    : `₦${budgetMin.toLocaleString("en-NG")} - ₦${budgetMax.toLocaleString("en-NG")}`}
                </p>
              </div>
              {location.trim() && (
                <div>
                  <p className="font-bold text-chs-charcoal">Location</p>
                  <p className="text-gray-600">{location}</p>
                </div>
              )}
              <div>
                <p className="font-bold text-chs-charcoal">Additional details</p>
                <p className="text-gray-600">{description}</p>
              </div>
              <div>
                <p className="font-bold text-chs-charcoal">Contact</p>
                <p className="text-gray-600">{contactPhone} · {contactEmail}</p>
              </div>
              {documents.length > 0 && (
                <div>
                  <p className="font-bold text-chs-charcoal">Attached documents</p>
                  <p className="text-gray-600">{documents.length} file{documents.length > 1 ? "s" : ""}</p>
                </div>
              )}
            </div>
            {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setStage("details")}
                className="flex-1 py-3 rounded-full bg-gray-200 text-gray-600 text-sm font-semibold">
                Go back and edit
              </button>
              <button onClick={handleActualSubmit} disabled={submitting}
                className="flex-1 py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
                {submitting ? "Submitting..." : "Yes, submit this"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
