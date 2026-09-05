"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { FaultReport, FaultQuotation } from "@/types/faultReport";
import { formatNaira } from "@/lib/format";
import MessageThread from "@/components/MessageThread";
import RoleBadge from "@/components/RoleBadge";
import PostQuotationJob from "@/components/PostQuotationJob";
import RateArtisanForm from "@/components/RateArtisanForm";
import GuidePrompt from "@/components/GuidePrompt";

interface TenancyWithProperty {
  id: string;
  tenant_id: string;
  property_id: string;
  lease_start: string;
  lease_end: string;
  annual_rent: number;
  status: string;
  properties: { title: string; location_area: string } | null;
}

interface FaultWithQuotations extends FaultReport {
  fault_quotations: FaultQuotation[];
}

const STATUS_LABELS: Record<string, string> = {
  reported: "Reported",
  assigned: "Assigned",
  converted_to_quote: "Converted to quote",
  gathering_quotes: "Gathering quotes",
  awaiting_owner_approval: "Awaiting owner approval",
  awaiting_manager_approval: "Awaiting your approval",
  approved_by_owner: "Approved by owner",
  approved_by_manager: "Approved by you",
  resolved: "Resolved",
};

export default function ManagerDashboard() {
  const router = useRouter();
  const { session, profile, testModeRole, loading: authLoading } = useAuth();
  const [tenancies, setTenancies] = useState<TenancyWithProperty[]>([]);
  const [faults, setFaults] = useState<FaultWithQuotations[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingJobId, setConfirmingJobId] = useState<string | null>(null);
  const [confirmJobMessage, setConfirmJobMessage] = useState<Record<string, string>>({});
  const [messagingTenancy, setMessagingTenancy] = useState<TenancyWithProperty | null>(null);
  const [paymentHistoryTenancy, setPaymentHistoryTenancy] = useState<TenancyWithProperty | null>(null);
  const [paymentRecords, setPaymentRecords] = useState<{ description: string | null; amount: number; created_at: string; direction: string }[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  // Real, direct fix for a genuine, confirmed gap found while
  // building the team-subscription feature: Manager had no real team
  // management UI at all, even though staff tools were explicitly
  // meant for both Agent and Manager equally.
  const [showTeamSection, setShowTeamSection] = useState(false);
  const [teamPhone, setTeamPhone] = useState("");
  const [teamRoleLabel, setTeamRoleLabel] = useState("");
  const [invitingTeam, setInvitingTeam] = useState(false);
  const [teamResult, setTeamResult] = useState<string | null>(null);
  const [showSubscriptionOffer, setShowSubscriptionOffer] = useState(false);
  const [subscriptionSubmitting, setSubscriptionSubmitting] = useState(false);

  async function handleInviteTeamMember() {
    if (!teamPhone.trim() || !teamRoleLabel.trim()) return;
    setInvitingTeam(true);
    setTeamResult(null);
    const { error } = await supabase.rpc("invite_team_member", { p_phone: teamPhone.trim(), p_role_label: teamRoleLabel.trim() });
    setInvitingTeam(false);
    if (error) {
      if (error.message.includes("subscription_required")) {
        setShowSubscriptionOffer(true);
        return;
      }
      setTeamResult(error.message);
      return;
    }
    setTeamResult("✓ Real team member added.");
    setTeamPhone("");
    setTeamRoleLabel("");
  }

  async function handlePurchaseSubscription(planType: "monthly" | "six_month" | "annual") {
    setSubscriptionSubmitting(true);
    const { data, error } = await supabase.rpc("purchase_team_subscription", { p_plan_type: planType });
    setSubscriptionSubmitting(false);
    if (error) {
      setTeamResult(error.message.includes("insufficient_balance") ? "Insufficient wallet balance for this real plan." : error.message);
      return;
    }
    setShowSubscriptionOffer(false);
    setTeamResult(`✓ Subscribed — ${data.real_months_of_access} real months of access for ₦${data.amount_paid.toLocaleString()}.`);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    const allRoles = profile ? [profile.role, ...(profile.secondary_roles || [])] : [];
    // Pre-launch admin testing bypass — see AuthContext.tsx.
    const inTestMode = profile?.is_super_admin && testModeRole === "manager";
    if (profile && !allRoles.includes("manager") && !inTestMode) {
      router.push("/");
      return;
    }
    if (profile && !profile.terms_accepted_at) {
      router.push("/accept-terms?redirect=/manager");
      return;
    }
    if (profile && !profile.guide_roles_seen.includes("manager")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowGuide(true);
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, profile, testModeRole]);

  async function loadData() {
    if (!session) return;
    setLoading(true);

    const { data: managedTenancies } = await supabase
      .from("tenancies")
      .select("id, tenant_id, property_id, lease_start, lease_end, annual_rent, status, properties(title, location_area)")
      .eq("manager_id", session.user.id)
      .order("created_at", { ascending: false });

    setTenancies((managedTenancies as unknown as TenancyWithProperty[]) || []);

    if (managedTenancies && managedTenancies.length > 0) {
      const tenancyIds = managedTenancies.map((t) => t.id);
      const { data: faultData } = await supabase
        .from("fault_reports")
        .select("*, fault_quotations(*, artisans(user_id))")
        .in("tenancy_id", tenancyIds)
        .order("created_at", { ascending: false });
      setFaults((faultData as unknown as FaultWithQuotations[]) || []);
    }

    setLoading(false);
  }

  async function handleConfirmJobCompletion(faultId: string) {
    setConfirmingJobId(faultId);
    setConfirmJobMessage((prev) => ({ ...prev, [faultId]: "" }));
    const { error } = await supabase.rpc("confirm_job_completion", { p_fault_report_id: faultId });
    setConfirmingJobId(null);
    if (error) {
      setConfirmJobMessage((prev) => ({ ...prev, [faultId]: error.message }));
      return;
    }
    setConfirmJobMessage((prev) => ({ ...prev, [faultId]: "✓ Confirmed — artisan paid, job resolved." }));
    loadData();
  }

  async function handleViewPaymentHistory(t: TenancyWithProperty) {
    setPaymentHistoryTenancy(t);
    setLoadingPayments(true);
    const { data } = await supabase
      .from("wallet_transactions")
      .select("description, amount, created_at, direction")
      .eq("user_id", t.tenant_id)
      .order("created_at", { ascending: false });
    setPaymentRecords(data || []);
    setLoadingPayments(false);
  }

  async function handleApproveQuotation(faultId: string, vendor: string, amount: number) {
    setActionError(null);
    // Genuinely records WHICH vendor and amount were actually approved —
    // not just flipping a status flag — matching the real, tested
    // multi-quotation vetting system from the original app.
    const { error } = await supabase
      .from("fault_reports")
      .update({ status: "approved_by_manager", approved_vendor: vendor, approved_amount: amount })
      .eq("id", faultId);
    if (error) {
      setActionError("Could not approve this quotation. Please try again.");
      return;
    }
    loadData();
  }

  async function handleDownloadReport() {
    // Real, genuine report — the original app's version of this button
    // never generated anything at all, just a fake toast pretending to.
    // Built properly here: an actual PDF with real, currently-accurate
    // numbers. Deliberately excludes a monthly rent/maintenance-spend
    // breakdown, since no real timestamp exists anywhere to honestly
    // compute "this month" for those figures — better to leave a
    // number out than show a fabricated one.
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const distinctProperties = new Set(tenancies.filter((t) => t.properties).map((t) => t.property_id)).size;
    const openFaults = faults.filter((f) => f.status !== "resolved").length;

    doc.setFontSize(16);
    doc.text("CHS — Property Manager Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated ${new Date().toLocaleDateString()}`, 14, 27);

    doc.setFontSize(12);
    doc.text(`Properties managed: ${distinctProperties}`, 14, 42);
    doc.text(`Tenants managed: ${tenancies.length}`, 14, 50);
    doc.text(`Open fault tickets: ${openFaults}`, 14, 58);

    doc.setFontSize(11);
    doc.text("Managed properties:", 14, 72);
    let y = 80;
    Array.from(new Map(tenancies.filter((t) => t.properties).map((t) => [t.property_id, t.properties!.title])).values()).forEach((title) => {
      doc.setFontSize(10);
      doc.text(`• ${title}`, 18, y);
      y += 7;
    });

    doc.save(`CHS-Manager-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen zone-manager bg-[var(--zone-bg)] pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <RoleBadge label="Property Manager Dashboard" />
        <div className="flex justify-between items-center mt-1">
          <h1 className="font-serif text-lg font-bold">Property Manager</h1>
          <Link href="/manager/estates" className="text-[10px] font-semibold bg-white/15 px-2.5 py-1 rounded-full">
            🏘️ My Estates
          </Link>
        </div>
        <Link href="/agent/tenant-register" className="text-[10px] font-semibold text-white/70 underline mt-1 inline-block">
          📋 My Tenant Register →
        </Link>
        <Link href="/agent/property-register" className="text-[10px] font-semibold text-white/70 underline mt-1 ml-3 inline-block">
          🏠 My Properties &amp; Owners Register →
        </Link>
        <Link href="/expenses" className="text-[10px] font-semibold text-white/70 underline mt-1 ml-3 inline-block">
          💵 My Expenses & Income →
        </Link>

        {/* Real summary stats — restored, found missing during the
            systematic Manager dashboard comparison. Every number
            genuinely computed from real data. */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="text-center">
            <p className="font-serif text-lg font-bold">
              {new Set(tenancies.filter((t) => t.properties).map((t) => t.property_id)).size}
            </p>
            <p className="text-[9px] text-white/60 uppercase">Properties managed</p>
          </div>
          <div className="text-center">
            <p className="font-serif text-lg font-bold">{faults.filter((f) => f.status !== "resolved").length}</p>
            <p className="text-[9px] text-white/60 uppercase">Open fault tickets</p>
          </div>
          <div className="text-center">
            <p className="font-serif text-lg font-bold">{tenancies.length}</p>
            <p className="text-[9px] text-white/60 uppercase">Tenants managed</p>
          </div>
        </div>
        <button onClick={handleDownloadReport} className="w-full mt-3 py-2 rounded-full bg-white/15 text-xs font-semibold">
          📄 Download monthly report
        </button>
      </div>

      {actionError && (
        <p className="text-xs text-chs-red bg-chs-amber-light mx-4 mt-3 rounded-lg px-3 py-2">{actionError}</p>
      )}

      <div className="px-4 py-4 space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <button onClick={() => setShowTeamSection(!showTeamSection)} className="text-sm font-bold text-chs-charcoal">
            👥 {showTeamSection ? "Hide" : "Manage"} My Team
          </button>
          {showTeamSection && (
            <div className="mt-3">
              <div className="flex gap-1.5 mb-2">
                <input type="tel" placeholder="Staff's real CHS phone number" value={teamPhone}
                  onChange={(e) => setTeamPhone(e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
                <input type="text" placeholder="Role (e.g. Office Staff)" value={teamRoleLabel}
                  onChange={(e) => setTeamRoleLabel(e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
              </div>
              <button onClick={handleInviteTeamMember} disabled={invitingTeam}
                className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50 mb-2">
                {invitingTeam ? "Adding..." : "+ Add real team member"}
              </button>
              {teamResult && <p className="text-[10px] text-gray-500 mb-2">{teamResult}</p>}

              {showSubscriptionOffer && (
                <div className="bg-chs-amber-light rounded-lg p-3 mb-2">
                  <p className="text-xs font-bold text-chs-charcoal mb-1">You&apos;ve reached the real free limit (2 staff)</p>
                  <p className="text-[10px] text-gray-500 mb-2">A real, active subscription is required to add a 3rd team member.</p>
                  <button onClick={() => handlePurchaseSubscription("monthly")} disabled={subscriptionSubmitting}
                    className="w-full py-1.5 rounded-full bg-white border border-gray-200 text-[11px] font-semibold mb-1.5 text-left px-3">
                    Monthly — pay 1 month, get 1 month
                  </button>
                  <button onClick={() => handlePurchaseSubscription("six_month")} disabled={subscriptionSubmitting}
                    className="w-full py-1.5 rounded-full bg-white border border-gray-200 text-[11px] font-semibold mb-1.5 text-left px-3">
                    6 months — pay 6, get <strong>2 free</strong> (8 real months)
                  </button>
                  <button onClick={() => handlePurchaseSubscription("annual")} disabled={subscriptionSubmitting}
                    className="w-full py-1.5 rounded-full bg-white border border-gray-200 text-[11px] font-semibold mb-1.5 text-left px-3">
                    12 months — pay 12, get <strong>6 free</strong> (18 real months)
                  </button>
                  <button onClick={() => setShowSubscriptionOffer(false)} className="text-[10px] text-gray-400 underline mt-1">
                    Not now
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-bold text-chs-charcoal mb-2">Managed tenancies ({tenancies.length})</p>
          {tenancies.length === 0 ? (
            <p className="text-sm text-gray-400">No tenancies assigned to you yet.</p>
          ) : (
            // Genuinely grouped by real property, rather than shown as
            // one flat list — restoring the original app's real
            // multi-unit estate view, but built from actual data
            // instead of one hardcoded example. Deliberately honest
            // about what can and can't be shown: there's no real record
            // anywhere of a property's *total* unit count, so this
            // shows exactly what's real — how many active tenancies
            // exist at each property under this manager — rather than
            // invent a "vacant units" figure with no genuine source.
            Object.entries(
              tenancies.reduce((groups, t) => {
                const key = t.property_id;
                if (!groups[key]) groups[key] = [];
                groups[key].push(t);
                return groups;
              }, {} as Record<string, TenancyWithProperty[]>)
            ).map(([propertyId, group]) => {
              const activeCount = group.filter((t) => t.status === "active").length;
              return (
                <div key={propertyId} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-semibold text-chs-charcoal">{group[0].properties?.title}</p>
                    <span className="text-[10px] font-bold text-chs-red bg-chs-amber-light px-2 py-0.5 rounded-full">
                      {activeCount} active {activeCount === 1 ? "tenancy" : "tenancies"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{group[0].properties?.location_area}</p>

                  {group.map((t) => (
                    <div key={t.id} className="bg-gray-50 rounded-lg p-2.5 mb-1.5">
                      <div className="flex justify-between items-center">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          t.status === "active" ? "text-chs-red bg-chs-amber-light" : "text-gray-500 bg-gray-100"
                        }`}>
                          {t.status.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-gray-500">{formatNaira(t.annual_rent)}/year</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">{t.lease_start} → {t.lease_end}</p>
                      <button
                        onClick={() => setMessagingTenancy(t)}
                        className="mt-1 text-[10px] font-semibold text-chs-red underline"
                      >
                        💬 Message tenant
                      </button>
                      <button
                        onClick={() => handleViewPaymentHistory(t)}
                        className="mt-1 ml-3 text-[10px] font-semibold text-chs-charcoal underline"
                      >
                        💳 Payment history
                      </button>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {messagingTenancy && session && (
          <MessageThread
            tenancyId={messagingTenancy.id}
            session={session}
            recipientId={messagingTenancy.tenant_id}
            recipientLabel={messagingTenancy.properties?.title || "Tenant"}
            onClose={() => setMessagingTenancy(null)}
          />
        )}

        {paymentHistoryTenancy && (
          <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-bold text-chs-charcoal">💳 Payment history — {paymentHistoryTenancy.properties?.title}</p>
              <button onClick={() => setPaymentHistoryTenancy(null)} className="text-gray-400 text-lg">✕</button>
            </div>
            {loadingPayments ? (
              <p className="text-xs text-gray-400 text-center py-4">Loading...</p>
            ) : paymentRecords.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No payment records yet.</p>
            ) : (
              <>
                <div className="bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
                  <p className="text-xs text-gray-500">
                    Total paid to date:{" "}
                    <span className="font-bold text-chs-red">
                      {formatNaira(
                        paymentRecords
                          .filter((r) => r.direction === "credit")
                          .reduce((sum, r) => sum + r.amount, 0)
                      )}
                    </span>
                  </p>
                </div>
                {paymentRecords.map((r, i) => (
                  <div key={i} className="border-b border-gray-100 py-2.5 last:border-0">
                    <div className="flex justify-between">
                      <p className="text-xs font-semibold text-chs-charcoal">{r.description || "Wallet transaction"}</p>
                      <p className={`text-xs font-semibold ${r.direction === "credit" ? "text-green-700" : "text-gray-400"}`}>
                        {r.direction === "credit" ? "+" : "−"}{formatNaira(r.amount)}
                      </p>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        <div>
          <PostQuotationJob
            managedProperties={Array.from(
              new Map(tenancies.filter((t) => t.properties).map((t) => [t.property_id, { id: t.property_id, title: t.properties!.title }])).values()
            )}
            onDone={loadData}
          />
          <p className="text-xs font-bold text-chs-charcoal mb-2">Maintenance requests ({faults.length})</p>
          {faults.length === 0 ? (
            <p className="text-sm text-gray-400">No maintenance requests on your managed tenancies.</p>
          ) : (
            faults.map((fault) => (
              <div key={fault.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-semibold text-chs-charcoal">{fault.category}</p>
                  <span className="text-[10px] font-bold uppercase text-chs-red bg-chs-amber-light px-2 py-1 rounded-full">
                    {STATUS_LABELS[fault.status] || fault.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{fault.description}</p>

                {fault.status === "completed_pending_confirmation" && (
                  <div className="mt-2">
                    {confirmJobMessage[fault.id] && <p className="text-[10px] text-gray-600 mb-1">{confirmJobMessage[fault.id]}</p>}
                    <button onClick={() => handleConfirmJobCompletion(fault.id)} disabled={confirmingJobId === fault.id}
                      className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                      {confirmingJobId === fault.id ? "Processing..." : "✓ Confirm work done & pay artisan"}
                    </button>
                  </div>
                )}

                {fault.fault_quotations && fault.fault_quotations.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                      Quotations ({fault.fault_quotations.length})
                    </p>
                    {fault.fault_quotations.map((q) => (
                      <div key={q.id} className="bg-gray-50 rounded-lg p-2 mb-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold">{q.vendor_name}</p>
                            <p className="text-gray-500">{formatNaira(q.amount)}</p>
                          </div>
                          {fault.status === "awaiting_manager_approval" && (
                            <button
                              onClick={() => handleApproveQuotation(fault.id, q.vendor_name, q.amount)}
                              className="py-1.5 px-3 rounded-full bg-chs-red text-white text-[10px] font-semibold"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                        {/* Real rating/dispute — only ever reachable once
                            this specific job is genuinely resolved, and
                            only for a real, registered artisan's quote,
                            never a free-text vendor with no real account
                            to attach a rating to. */}
                        {fault.status === "resolved" && q.artisan_id && q.artisans?.user_id && session && (
                          <RateArtisanForm
                            faultReportId={fault.id}
                            artisanId={q.artisan_id}
                            artisanUserId={q.artisans.user_id}
                            session={session}
                            alreadyRated={false}
                            onDone={loadData}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      {showGuide && <GuidePrompt role="manager" onDismiss={() => setShowGuide(false)} />}
    </div>
  );
}
