"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Artisan, ArtisanRating, ArtisanJobDispute } from "@/types/artisan";
import GuidePrompt from "@/components/GuidePrompt";

interface OpenFault {
  id: string;
  category: string;
  description: string;
  urgency: string;
  location_in_property: string | null;
  tenancies: { management_delegated: boolean } | null;
}

export default function ArtisanDashboard() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [artisanName, setArtisanName] = useState<string>("");
  const [openFaults, setOpenFaults] = useState<OpenFault[]>([]);
  const [myRatings, setMyRatings] = useState<ArtisanRating[]>([]);
  const [myDisputes, setMyDisputes] = useState<ArtisanJobDispute[]>([]);
  const [completedJobs, setCompletedJobs] = useState<{ id: string; category: string }[]>([]);
  const [activeJobs, setActiveJobs] = useState<{ id: string; category: string; status: string }[]>([]);
  const [markingCompleteId, setMarkingCompleteId] = useState<string | null>(null);
  const [jobActionMessage, setJobActionMessage] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [quotingFaultId, setQuotingFaultId] = useState<string | null>(null);
  const [quoteAmount, setQuoteAmount] = useState<number | "">("");
  const [quoteNote, setQuoteNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [disputingFaultId, setDisputingFaultId] = useState<string | null>(null);
  const [disputeText, setDisputeText] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    if (profile && !profile.terms_accepted_at) {
      router.push("/accept-terms?redirect=/artisan");
      return;
    }
    if (profile && !profile.guide_roles_seen.includes("artisan")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowGuide(true);
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, profile]);

  async function loadData() {
    if (!session) return;
    setLoading(true);

    const { data: artisanData } = await supabase
      .from("artisans")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();
    setArtisan(artisanData);

    if (artisanData) {
      const { data: profileData } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).single();
      setArtisanName(profileData?.full_name || "Registered artisan");
      // The real, hard priority rule: an independent artisan genuinely
      // never even sees faults on a property where management is truly
      // delegated to CHS — those are only ever opened to real,
      // verified CHS Maintenance Agents. This is enforced here, in
      // what's actually shown, not just a soft UI hint.
      const { data: faultsData } = await supabase
        .from("fault_reports")
        .select("id, category, description, urgency, location_in_property, tenancies(management_delegated)")
        .in("status", ["reported", "assigned", "gathering_quotes"])
        .order("created_at", { ascending: false });

      const visibleFaults = (faultsData || []).filter((f) => {
        const isDelegated = (f as unknown as OpenFault).tenancies?.management_delegated === true;
        return artisanData.artisan_type === "chs_agent" || !isDelegated;
      });
      setOpenFaults(visibleFaults as unknown as OpenFault[]);

      const [ratingsRes, disputesRes] = await Promise.all([
        supabase.from("artisan_ratings").select("*").eq("artisan_id", artisanData.id).order("created_at", { ascending: false }),
        supabase.from("artisan_job_disputes").select("*").or(`raised_by.eq.${session.user.id},against.eq.${session.user.id}`).order("created_at", { ascending: false }),
      ]);
      setMyRatings(ratingsRes.data || []);
      setMyDisputes(disputesRes.data || []);

      // Real completed jobs — where this artisan's own quotation was
      // the one genuinely approved and the fault is genuinely resolved
      // — this is the only real basis for either a rating or a dispute
      // to exist, matching the design's "only after real work happened"
      // principle.
      const { data: myQuotes } = await supabase
        .from("fault_quotations")
        .select("fault_report_id, fault_reports(id, category, status)")
        .eq("artisan_id", artisanData.id);
      const resolved = (myQuotes || [])
        .map((q) => q.fault_reports as unknown as { id: string; category: string; status: string })
        .filter((f) => f && f.status === "resolved");
      setCompletedJobs(resolved);

      // Real, active jobs this artisan's own quote won — either
      // awaiting them to mark the work done, or already marked and
      // awaiting the real owner/manager to confirm and release payment.
      const active = (myQuotes || [])
        .map((q) => q.fault_reports as unknown as { id: string; category: string; status: string })
        .filter((f) => f && (f.status === "approved_by_owner" || f.status === "approved_by_manager" || f.status === "completed_pending_confirmation"));
      setActiveJobs(active);
    }

    setLoading(false);
  }

  async function handleMarkJobComplete(faultId: string) {
    setMarkingCompleteId(faultId);
    setJobActionMessage((prev) => ({ ...prev, [faultId]: "" }));
    const { error } = await supabase.rpc("submit_job_completion", { p_fault_report_id: faultId });
    setMarkingCompleteId(null);
    if (error) {
      setJobActionMessage((prev) => ({ ...prev, [faultId]: error.message }));
      return;
    }
    setJobActionMessage((prev) => ({ ...prev, [faultId]: "✓ Marked complete — awaiting owner confirmation and payment." }));
    loadData();
  }

  async function handleSubmitQuote(faultId: string) {
    if (!quoteAmount || !artisan) {
      setActionError("Please enter a quote amount.");
      return;
    }
    setActionError(null);
    setSubmitting(true);

    const { error } = await supabase.from("fault_quotations").insert({
      fault_report_id: faultId,
      artisan_id: artisan.id,
      vendor_name: artisanName,
      amount: quoteAmount,
      submitted_by: "artisan",
      note: quoteNote.trim() || null,
    });

    if (error) {
      setActionError("Could not submit your quote. Please try again.");
      setSubmitting(false);
      return;
    }

    setQuotingFaultId(null);
    setQuoteAmount("");
    setQuoteNote("");
    setSubmitting(false);
    loadData();
  }

  async function handleRaiseDispute(faultId: string) {
    if (!disputeText.trim() || !session) {
      setActionError("Please describe what happened.");
      return;
    }
    setActionError(null);

    // The real, deliberately two-sided dispute — the artisan can raise
    // one about a genuinely difficult client, exactly as much as a
    // client can raise one about the artisan. Fair in both directions.
    const { data: fault } = await supabase.from("fault_reports").select("tenancy_id").eq("id", faultId).single();
    const { data: tenancy } = fault?.tenancy_id
      ? await supabase.from("tenancies").select("landlord_id, tenant_id").eq("id", fault.tenancy_id).single()
      : { data: null };

    const against = tenancy?.landlord_id || tenancy?.tenant_id;
    if (!against) {
      setActionError("Could not identify the other party for this job.");
      return;
    }

    const { error } = await supabase.from("artisan_job_disputes").insert({
      fault_report_id: faultId,
      raised_by: session.user.id,
      against,
      description: disputeText.trim(),
    });

    if (error) {
      setActionError("Could not submit this dispute. Please try again.");
      return;
    }
    setDisputingFaultId(null);
    setDisputeText("");
    loadData();
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  if (!artisan) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm text-gray-500 mb-4">You&apos;re not registered as a Maintenance Artisan yet.</p>
        <Link href="/become-artisan" className="text-sm font-semibold text-white bg-chs-red px-5 py-2.5 rounded-full">
          Register now
        </Link>
      </div>
    );
  }

  const avgRating = myRatings.length > 0
    ? myRatings.reduce((sum, r) => sum + (r.quality_stars + r.reliability_stars + r.conduct_stars) / 3, 0) / myRatings.length
    : null;

  return (
    <div className="min-h-screen zone-artisan bg-[var(--zone-bg)] pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <div className="flex justify-between items-center mt-1">
          <h1 className="font-serif text-lg font-bold capitalize">{artisan.trades?.join(", ")} {artisan.artisan_type === "chs_agent" ? "· CHS Agent" : "· Independent"}</h1>
          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${artisan.verification_status === "verified" ? "bg-chs-red" : "bg-white/15"}`}>
            {artisan.verification_status === "verified" ? "✓ Verified" : "Pending review"}
          </span>
        </div>
        {avgRating && (
          <p className="text-xs text-white/70 mt-1">⭐ {avgRating.toFixed(1)} average — {myRatings.length} completed job{myRatings.length !== 1 ? "s" : ""}</p>
        )}
      </div>

      <div className="px-4 py-4">
        {actionError && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2 mb-3">{actionError}</p>}

        <p className="text-xs font-bold text-chs-charcoal mb-2">Open jobs you can quote for ({openFaults.length})</p>
        {openFaults.length === 0 ? (
          <p className="text-sm text-gray-400 mb-4">No open jobs matching your trade right now.</p>
        ) : (
          openFaults.map((f) => (
            <div key={f.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
              <div className="flex justify-between items-start">
                <p className="text-sm font-semibold text-chs-charcoal">{f.category}</p>
                {f.tenancies?.management_delegated && (
                  <span className="text-[9px] font-bold uppercase bg-chs-amber-light text-chs-amber-dark px-2 py-0.5 rounded-full">CHS Managed</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">{f.description}</p>
              <p className="text-[10px] text-gray-400 mt-1 capitalize">Urgency: {f.urgency}</p>

              {quotingFaultId === f.id ? (
                <div className="mt-2 space-y-1.5">
                  <input type="number" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value === "" ? "" : parseInt(e.target.value))}
                    placeholder="Your quote (₦)" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
                  <textarea value={quoteNote} onChange={(e) => setQuoteNote(e.target.value)} rows={2}
                    placeholder="Note (optional)" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
                  <div className="flex gap-2">
                    <button onClick={() => setQuotingFaultId(null)} className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">Cancel</button>
                    <button onClick={() => handleSubmitQuote(f.id)} disabled={submitting}
                      className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
                      {submitting ? "Submitting..." : "Submit quote"}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setQuotingFaultId(f.id)}
                  className="w-full mt-2 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                  Submit a quote
                </button>
              )}
            </div>
          ))
        )}

        {activeJobs.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-chs-charcoal mb-2">🔧 My active jobs</p>
            <div className="space-y-2">
              {activeJobs.map((job) => (
                <div key={job.id} className="bg-white rounded-lg border border-gray-100 p-3">
                  <p className="text-xs font-semibold text-chs-charcoal">{job.category}</p>
                  {jobActionMessage[job.id] && <p className="text-[10px] text-gray-600 mt-1">{jobActionMessage[job.id]}</p>}
                  {job.status === "completed_pending_confirmation" ? (
                    <p className="text-[10px] text-chs-amber-dark bg-chs-amber-light rounded-full px-2 py-1 mt-1.5 inline-block">
                      ⏳ Awaiting owner/manager confirmation and payment
                    </p>
                  ) : (
                    <button onClick={() => handleMarkJobComplete(job.id)} disabled={markingCompleteId === job.id}
                      className="mt-1.5 w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                      {markingCompleteId === job.id ? "Submitting..." : "Mark job complete"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {completedJobs.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-chs-charcoal mb-2">My completed jobs</p>
            {completedJobs.map((job) => (
              <div key={job.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                <p className="text-xs font-semibold text-chs-charcoal">{job.category}</p>
                {disputingFaultId === job.id ? (
                  <div className="mt-2 space-y-1.5">
                    <textarea value={disputeText} onChange={(e) => setDisputeText(e.target.value)} rows={2}
                      placeholder="Describe what happened — CHS will review both sides."
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
                    <div className="flex gap-2">
                      <button onClick={() => setDisputingFaultId(null)} className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">Cancel</button>
                      <button onClick={() => handleRaiseDispute(job.id)} className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">Submit dispute</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setDisputingFaultId(job.id)} className="mt-1 text-[10px] font-semibold text-chs-red underline">
                    Raise a dispute about this job
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {myDisputes.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-chs-charcoal mb-2">My job disputes ({myDisputes.length})</p>
            {myDisputes.map((d) => (
              <div key={d.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2 text-xs">
                <p className="text-gray-700">{d.description}</p>
                <p className="text-gray-400 mt-1 capitalize">Status: {d.status.replace(/_/g, " ")}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {showGuide && <GuidePrompt role="artisan" onDismiss={() => setShowGuide(false)} />}
    </div>
  );
}
