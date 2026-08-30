"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HouseRulesAcknowledgment from "@/components/HouseRulesAcknowledgment";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import RaiseDisputeForm from "@/components/RaiseDisputeForm";
import TransactionCommissions from "@/components/TransactionCommissions";
import { FormalNotice, NOTICE_TYPE_LABELS } from "@/types/formalNotice";
import MessageThread from "@/components/MessageThread";
import GuidePrompt from "@/components/GuidePrompt";

interface ApplicationWithProperty {
  id: string;
  status: string;
  move_in_date: string;
  created_at: string;
  properties: { title: string; location_area: string } | null;
}

interface TenancyWithProperty {
  id: string;
  property_id: string;
  landlord_id: string;
  manager_id: string | null;
  lease_start: string;
  lease_end: string;
  annual_rent: number;
  status: string;
  notice_given_at: string | null;
  properties: { title: string; location_area: string; owner_identity_visible_to_tenant: boolean } | null;
  landlord: { full_name: string } | null;
  manager: { full_name: string } | null;
}

interface InspectionWithProperty {
  id: string;
  requested_date: string;
  requested_time: string;
  status: string;
  properties: { title: string; location_area: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Under review by CHS",
  awaiting_owner_decision: "Awaiting the owner's decision",
  approved: "Approved",
  owner_declined: "Declined by the owner",
};

export default function TenantDashboard() {
  const router = useRouter();
  const { session, profile, testModeRole, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState<ApplicationWithProperty[]>([]);
  const [tenancies, setTenancies] = useState<TenancyWithProperty[]>([]);
  const [payingRentId, setPayingRentId] = useState<string | null>(null);
  const [payRentMessage, setPayRentMessage] = useState<Record<string, string>>({});
  const [givingNoticeId, setGivingNoticeId] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<Record<string, string>>({});
  const [serviceCharges, setServiceCharges] = useState<{ id: string; amount: number; description: string; due_date: string; status: string; properties: { title: string }[] | null }[]>([]);
  const [payingChargeId, setPayingChargeId] = useState<string | null>(null);
  const [chargeMessage, setChargeMessage] = useState<string | null>(null);
  const [inspections, setInspections] = useState<InspectionWithProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [disputingTenancy, setDisputingTenancy] = useState<TenancyWithProperty | null>(null);
  const [disputeSubmitted, setDisputeSubmitted] = useState(false);
  const [notices, setNotices] = useState<FormalNotice[]>([]);
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);
  const [messagingTenancy, setMessagingTenancy] = useState<TenancyWithProperty | null>(null);

  async function loadData() {
    if (!session) return;
    setLoading(true);

    const [applicationsRes, tenanciesRes, inspectionsRes, serviceChargesRes] = await Promise.all([
      supabase
        .from("rental_applications")
        .select("id, status, move_in_date, created_at, properties(title, location_area)")
        .eq("tenant_id", session.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("tenancies")
        .select("id, property_id, landlord_id, manager_id, lease_start, lease_end, annual_rent, status, notice_given_at, properties(title, location_area, owner_identity_visible_to_tenant), landlord:landlord_id(full_name), manager:manager_id(full_name)")
        .eq("tenant_id", session.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("inspections")
        .select("id, requested_date, requested_time, status, properties(title, location_area)")
        .eq("requester_id", session.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("service_charges")
        .select("id, amount, description, due_date, status, properties(title)")
        .eq("tenant_id", session.user.id)
        .order("due_date", { ascending: true }),
    ]);

    setApplications((applicationsRes.data as unknown as ApplicationWithProperty[]) || []);
    setTenancies((tenanciesRes.data as unknown as TenancyWithProperty[]) || []);
    setInspections((inspectionsRes.data as unknown as InspectionWithProperty[]) || []);
    setServiceCharges((serviceChargesRes.data as typeof serviceCharges) || []);

    // Fetching the list itself is NOT the same as "viewing" a specific
    // notice — merely loading the dashboard must never silently count as
    // a real read receipt. This is exactly the real bug the original
    // app found and fixed: an earlier version accidentally marked every
    // notice as viewed the instant it loaded, which would have made the
    // whole read-receipt feature worthless — a false "viewed" timestamp
    // is arguably worse than no timestamp at all. The actual receipt
    // only ever fires from handleExpandNotice below, a genuine,
    // deliberate action.
    const tenancyIds = (tenanciesRes.data || []).map((t: { id: string }) => t.id);
    if (tenancyIds.length > 0) {
      const { data: noticesData } = await supabase
        .from("formal_notices")
        .select("*")
        .in("tenancy_id", tenancyIds)
        .order("issued_at", { ascending: false });
      setNotices(noticesData || []);
    }

    setLoading(false);
  }

  async function handlePayRent(tenancyId: string) {
    setPayingRentId(tenancyId);
    setPayRentMessage((prev) => ({ ...prev, [tenancyId]: "" }));
    const { error } = await supabase.rpc("pay_rent", { p_tenancy_id: tenancyId });
    setPayingRentId(null);
    if (error) {
      setPayRentMessage((prev) => ({ ...prev, [tenancyId]: error.message }));
      return;
    }
    setPayRentMessage((prev) => ({ ...prev, [tenancyId]: "✓ Rent paid — lease renewed." }));
    loadData();
  }

  async function handleGiveNotice(tenancyId: string) {
    setGivingNoticeId(tenancyId);
    setNoticeMessage((prev) => ({ ...prev, [tenancyId]: "" }));
    const { error } = await supabase.rpc("give_non_renewal_notice", { p_tenancy_id: tenancyId });
    setGivingNoticeId(null);
    if (error) {
      setNoticeMessage((prev) => ({ ...prev, [tenancyId]: error.message }));
      return;
    }
    setNoticeMessage((prev) => ({ ...prev, [tenancyId]: "✓ Notice given — your landlord has been informed." }));
    loadData();
  }

  async function handlePayServiceCharge(chargeId: string) {
    setPayingChargeId(chargeId);
    setChargeMessage(null);
    const { error } = await supabase.rpc("pay_service_charge", { p_charge_id: chargeId });
    setPayingChargeId(null);
    if (error) {
      setChargeMessage(error.message);
      return;
    }
    setChargeMessage("✓ Service charge paid.");
    loadData();
  }

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    const allRoles = profile ? [profile.role, ...(profile.secondary_roles || [])] : [];
    // Pre-launch admin testing bypass — see AuthContext.tsx.
    const inTestMode = profile?.is_super_admin && testModeRole === "tenant";
    if (profile && !allRoles.includes("tenant") && !inTestMode) {
      router.push("/");
      return;
    }
    if (profile && !profile.terms_accepted_at) {
      router.push("/accept-terms?redirect=/tenant");
      return;
    }
    if (profile && !profile.guide_roles_seen.includes("tenant")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowGuide(true);
    }
    // Real network fetch, not a synchronous setState — loadData is
    // async and only calls setState after a genuine await on Supabase's
    // response, so this is the standard, safe "fetch on mount" pattern.
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, profile, testModeRole]);

  // The real, deliberate view action — the only place a read receipt is
  // ever allowed to fire, and only ever once per notice (the first
  // view), matching the original's exact, carefully-tested behaviour.
  async function handleExpandNotice(notice: FormalNotice) {
    setExpandedNoticeId(expandedNoticeId === notice.id ? null : notice.id);
    if (!notice.first_viewed_at) {
      const { error } = await supabase
        .from("formal_notices")
        .update({ first_viewed_at: new Date().toISOString(), status: "acknowledged" })
        .eq("id", notice.id);
      if (!error) {
        setNotices((prev) => prev.map((n) => (n.id === notice.id ? { ...n, first_viewed_at: new Date().toISOString(), status: "acknowledged" } : n)));
      }
    }
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen zone-tenant bg-[var(--zone-bg)] pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <h1 className="font-serif text-lg font-bold mt-1">My Rentals</h1>
      </div>

      <div className="px-4 py-4 space-y-5">
        {notices.length > 0 && (
          <div>
            <p className="text-xs font-bold text-chs-charcoal mb-2">📋 Formal notices</p>
            {notices.map((n) => (
              <div key={n.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                <button
                  onClick={() => handleExpandNotice(n)}
                  className="w-full flex justify-between items-center text-left"
                >
                  <div>
                    <p className="text-xs font-semibold text-chs-charcoal">{NOTICE_TYPE_LABELS[n.notice_type]}</p>
                    <p className="text-[10px] text-gray-400">Ref {n.reference} · {new Date(n.issued_at).toLocaleDateString()}</p>
                  </div>
                  <span className="text-gray-400 text-xs">{expandedNoticeId === n.id ? "▲" : "▼"}</span>
                </button>
                {expandedNoticeId === n.id && (
                  <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                    {Object.entries(n.details).map(([label, value]) =>
                      value ? (
                        <p key={label} className="text-[11px] text-gray-600">
                          <span className="font-semibold text-chs-charcoal">{label}:</span> {value}
                        </p>
                      ) : null
                    )}
                    <p className="text-[9px] text-gray-400 mt-2">
                      {n.first_viewed_at
                        ? `Viewed ${new Date(n.first_viewed_at).toLocaleString()}`
                        : "Marking as viewed now"}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tenancies.length > 0 && (
          <div>
            <p className="text-xs font-bold text-chs-charcoal mb-2">Active tenancy</p>
            {tenancies.map((t) => (
              <div key={t.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                <p className="text-sm font-semibold text-chs-charcoal">{t.properties?.title}</p>
                <p className="text-xs text-gray-500">{t.properties?.location_area}</p>
                {/* Real owner identity display — restored, found
                    missing entirely during the systematic Owner
                    dashboard comparison. Genuinely respects the
                    owner's own real privacy choice, never overriding
                    it. */}
                <p className="text-xs text-gray-500 mt-1">
                  {t.properties?.owner_identity_visible_to_tenant
                    ? `Landlord: ${t.landlord?.full_name || "—"}`
                    : `Property Manager: ${t.manager?.full_name || "CHS Property Manager"}`}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {t.lease_start} → {t.lease_end}
                </p>
                {(() => {
                  const daysLeft = Math.ceil((new Date(t.lease_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const withinNoticeWindow = daysLeft <= 90 && daysLeft > 0;
                  return (
                    <div className={`mt-1.5 rounded-lg px-2.5 py-1.5 ${withinNoticeWindow && !t.notice_given_at ? "bg-chs-amber-light" : "bg-[var(--zone-card)]"}`}>
                      <p className="text-xs font-bold text-chs-charcoal">
                        {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left to your next rent` : "Your rent is due"}
                      </p>
                      {t.notice_given_at ? (
                        <p className="text-[10px] text-green-700 mt-0.5">✓ You&apos;ve given notice — not renewing this tenancy</p>
                      ) : (
                        <>
                          {withinNoticeWindow && (
                            <p className="text-[10px] text-chs-amber-dark mt-0.5">
                              If you&apos;re not renewing, please give notice — the requested window (90 days before lease end) is closing.
                            </p>
                          )}
                          <button onClick={() => handleGiveNotice(t.id)} disabled={givingNoticeId === t.id}
                            className="mt-1 text-[10px] font-semibold text-chs-red underline disabled:opacity-50">
                            {givingNoticeId === t.id ? "Submitting..." : "I&apos;m not renewing — give notice"}
                          </button>
                        </>
                      )}
                      {noticeMessage[t.id] && <p className="text-[10px] text-gray-600 mt-1">{noticeMessage[t.id]}</p>}
                    </div>
                  );
                })()}
                <p className="text-sm font-bold text-chs-charcoal mt-1">{formatNaira(t.annual_rent)}/year</p>
                {payRentMessage[t.id] && <p className="text-[10px] text-gray-600 mt-1">{payRentMessage[t.id]}</p>}
                <button onClick={() => handlePayRent(t.id)} disabled={payingRentId === t.id}
                  className="mt-1.5 w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                  {payingRentId === t.id ? "Processing..." : `Pay rent — ${formatNaira(t.annual_rent)}`}
                </button>
                <Link href={`/condition-report/${t.id}`} className="block mt-1 text-[10px] font-semibold text-chs-red underline">
                  Submit move-in condition report
                </Link>
                {session && <HouseRulesAcknowledgment tenancyId={t.id} propertyId={t.property_id} session={session} />}
                <span className="inline-block mt-1 text-[10px] font-bold uppercase text-chs-red bg-chs-amber-light px-2 py-1 rounded-full capitalize">
                  {t.status.replace(/_/g, " ")}
                </span>
                <button
                  onClick={() => { setDisputingTenancy(t); setDisputeSubmitted(false); }}
                  className="block mt-2 text-[10px] font-semibold text-chs-red underline"
                >
                  Raise a dispute about this tenancy
                </button>
                <button
                  onClick={() => setMessagingTenancy(t)}
                  className="block mt-1 text-[10px] font-semibold text-chs-charcoal underline"
                >
                  💬 Message {t.manager_id ? "property manager" : "landlord"}
                </button>
              </div>
            ))}
          </div>
        )}

        {messagingTenancy && session && (
          <MessageThread
            tenancyId={messagingTenancy.id}
            session={session}
            recipientId={messagingTenancy.manager_id || messagingTenancy.landlord_id}
            recipientLabel={messagingTenancy.properties?.title || "Conversation"}
            onClose={() => setMessagingTenancy(null)}
          />
        )}

        {disputingTenancy && session && (
          <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4">
            {disputeSubmitted ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-chs-charcoal mb-1">✓ Dispute submitted</p>
                <p className="text-xs text-gray-500 mb-3">CHS will review this and reach out to both parties.</p>
                <button onClick={() => setDisputingTenancy(null)} className="text-xs font-semibold text-chs-red">
                  Close
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold text-chs-charcoal mb-3">
                  Raise a dispute — {disputingTenancy.properties?.title}
                </p>
                <RaiseDisputeForm
                  session={session}
                  tenancyId={disputingTenancy.id}
                  againstUserId={disputingTenancy.landlord_id}
                  onSuccess={() => setDisputeSubmitted(true)}
                  onCancel={() => setDisputingTenancy(null)}
                />
              </>
            )}
          </div>
        )}

        <div>
          <p className="text-xs font-bold text-chs-charcoal mb-2">My applications</p>
          {applications.length === 0 ? (
            <p className="text-sm text-gray-400">No rental applications yet.</p>
          ) : (
            applications.map((app) => (
              <div key={app.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                <p className="text-sm font-semibold text-chs-charcoal">{app.properties?.title}</p>
                <p className="text-xs text-gray-500">{app.properties?.location_area}</p>
                <p className="text-xs text-gray-500 mt-1">Move-in: {app.move_in_date}</p>
                <span
                  className={`inline-block mt-1 text-[10px] font-bold px-2 py-1 rounded-full ${
                    app.status === "approved"
                      ? "text-white bg-chs-red"
                      : app.status === "owner_declined"
                      ? "text-gray-500 bg-gray-100"
                      : "text-chs-amber-dark bg-chs-amber-light"
                  }`}
                >
                  {STATUS_LABELS[app.status] || app.status}
                </span>
              </div>
            ))
          )}
        </div>

        {session && <TransactionCommissions session={session} />}

        {serviceCharges.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-chs-charcoal mb-2">💰 Estate service charges</p>
            {chargeMessage && <p className="text-[10px] text-gray-600 bg-gray-50 rounded-lg px-2 py-1.5 mb-2">{chargeMessage}</p>}
            <div className="space-y-2">
              {serviceCharges.map((c) => (
                <div key={c.id} className="bg-white rounded-lg border border-gray-100 p-3">
                  <p className="text-xs font-semibold text-chs-charcoal">{c.description}</p>
                  <p className="text-[10px] text-gray-400">{c.properties?.[0]?.title} · Due {c.due_date}</p>
                  <div className="flex justify-between items-center mt-1.5">
                    <p className="text-sm font-bold text-chs-charcoal">{formatNaira(c.amount)}</p>
                    {c.status === "paid" ? (
                      <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full">✓ Paid</span>
                    ) : (
                      <button onClick={() => handlePayServiceCharge(c.id)} disabled={payingChargeId === c.id}
                        className="px-3 py-1 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
                        {payingChargeId === c.id ? "Paying..." : "Pay now"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-bold text-chs-charcoal mb-2">My inspection requests</p>
          {inspections.length === 0 ? (
            <p className="text-sm text-gray-400">No inspection requests yet.</p>
          ) : (
            inspections.map((insp) => (
              <div key={insp.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                <p className="text-sm font-semibold text-chs-charcoal">{insp.properties?.title}</p>
                <p className="text-xs text-gray-500">
                  {insp.requested_date} at {insp.requested_time}
                </p>
                <span className="inline-block mt-1 text-[10px] font-bold uppercase text-gray-500 bg-gray-100 px-2 py-1 rounded-full capitalize">
                  {insp.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      {showGuide && <GuidePrompt role="tenant" onDismiss={() => setShowGuide(false)} />}
    </div>
  );
}
