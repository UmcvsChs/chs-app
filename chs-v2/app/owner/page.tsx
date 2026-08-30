"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Property } from "@/types/property";
import { Offer } from "@/types/offer";
import { Inspection } from "@/types/inspection";
import { RentalApplication } from "@/types/rentalApplication";
import { EngageRequest } from "@/types/engageRequest";
import { MediaRequest } from "@/types/mediaRequest";
import { formatNaira, purposeLabel } from "@/lib/format";
import RaiseDisputeForm from "@/components/RaiseDisputeForm";
import GuidePrompt from "@/components/GuidePrompt";
import EngageChatThread from "@/components/EngageChatThread";
import { EngageDocumentsList } from "@/components/EngageDocuments";
import { HostShortletCheckInOut } from "@/components/ShortletCheckInOut";
import ShortletMessageThread from "@/components/ShortletMessageThread";
import TransactionCommissions from "@/components/TransactionCommissions";
import IssueNoticeForm from "@/components/IssueNoticeForm";
import RequestTermination from "@/components/RequestTermination";
import HouseRulesUpload from "@/components/HouseRulesUpload";

interface TenancyBasic {
  id: string;
  tenant_id: string;
  property_id: string;
  status: string;
  management_delegated: boolean;
}

interface PropertyWithActivity extends Property {
  offers: Offer[];
  inspections: Inspection[];
  rentalApplications: RentalApplication[];
  mediaRequests: MediaRequest[];
}

export default function OwnerDashboard() {
  const router = useRouter();
  const { session, profile, testModeRole, loading: authLoading } = useAuth();
  const [properties, setProperties] = useState<PropertyWithActivity[]>([]);
  const [tenancies, setTenancies] = useState<TenancyBasic[]>([]);
  const [rentCollected, setRentCollected] = useState(0);
  const [engageRequests, setEngageRequests] = useState<EngageRequest[]>([]);
  const [shortletBookings, setShortletBookings] = useState<{ id: string; guest_full_name: string; check_in: string; check_out: string; status: string; properties: { title: string }[] | null }[]>([]);
  const [faultReports, setFaultReports] = useState<{ id: string; category: string; description: string; status: string; properties: { title: string }[] | null }[]>([]);
  const [rentToOwnRequests, setRentToOwnRequests] = useState<{ id: string; total_price: number; monthly_amount: number; properties: { title: string }[] | null }[]>([]);
  const [approvingRtoId, setApprovingRtoId] = useState<string | null>(null);
  const [sellerOfferNotes, setSellerOfferNotes] = useState<Record<string, string>>({});
  const [confirmingJobId, setConfirmingJobId] = useState<string | null>(null);
  const [confirmJobMessage, setConfirmJobMessage] = useState<Record<string, string>>({});
  const [engageUnreadCount, setEngageUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [disputingTenancy, setDisputingTenancy] = useState<TenancyBasic | null>(null);
  const [issuingNoticeTenancy, setIssuingNoticeTenancy] = useState<TenancyBasic | null>(null);
  const [noticeIssued, setNoticeIssued] = useState(false);
  const [disputeSubmitted, setDisputeSubmitted] = useState(false);

  // A real access check — not just a UI nicety, since row-level security
  // on the actual database is the true protection here, but this stops
  // someone who genuinely isn't an owner from even seeing a confusing
  // empty dashboard.
  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    const allRoles = profile ? [profile.role, ...(profile.secondary_roles || [])] : [];
    // Pre-launch admin testing bypass — see AuthContext.tsx. A super
    // admin previewing this dashboard in test mode skips the real
    // role check entirely, but still only ever sees their own real data.
    const inTestMode = profile?.is_super_admin && testModeRole === "owner";
    if (profile && !allRoles.includes("owner") && !inTestMode) {
      router.push("/");
      return;
    }
    // Real T&Cs gate — per direct instruction, a genuine scroll-to-
    // accept, not a passive link. Checked before the dashboard loads
    // at all.
    if (profile && !profile.terms_accepted_at) {
      router.push("/accept-terms?redirect=/owner");
      return;
    }
    if (profile && !profile.guide_roles_seen.includes("owner")) {
      // Genuinely external-state-driven UI toggle — profile.guide_roles_seen
      // only becomes known after the real async profile fetch completes,
      // so there's no pure render-time alternative here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowGuide(true);
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, profile, testModeRole]);

  async function loadData() {
    if (!session) return;
    setLoading(true);

    supabase
      .from("shortlet_bookings")
      .select("id, guest_full_name, check_in, check_out, status, properties!inner(title, owner_id)")
      .eq("properties.owner_id", session.user.id)
      .in("status", ["confirmed", "active"])
      .then(({ data }) => setShortletBookings((data as unknown as typeof shortletBookings) || []));

    // Real fix found during the audit — owners previously had zero
    // visibility into maintenance issues on their own directly-managed
    // properties. Only a delegated manager's dashboard ever showed this.
    supabase
      .from("fault_reports")
      .select("id, category, description, status, property_id, properties!inner(title, owner_id)")
      .eq("properties.owner_id", session.user.id)
      .neq("status", "resolved")
      .then(({ data }) => setFaultReports((data as unknown as typeof faultReports) || []));

    supabase
      .from("rent_to_own_agreements")
      .select("id, total_price, monthly_amount, properties(title)")
      .eq("seller_id", session.user.id)
      .eq("status", "requested")
      .then(({ data }) => setRentToOwnRequests((data as unknown as typeof rentToOwnRequests) || []));

    const { data: ownedProperties } = await supabase
      .from("properties")
      .select("*")
      .eq("owner_id", session.user.id)
      .order("created_at", { ascending: false });

    if (!ownedProperties) {
      setProperties([]);
      setLoading(false);
      return;
    }

    // Real fix: this used to fire 4 separate queries PER property
    // (offers, inspections, applications, media requests) — fine for
    // an owner with 1-2 listings, but N properties meant N×4 real
    // database round-trips on every dashboard load. An agent or
    // property manager with 50 listings would trigger 200 concurrent
    // queries. Batched here into 4 total queries regardless of how
    // many properties an owner has, then grouped in memory by
    // property_id — same real data, a fraction of the round-trips.
    const propertyIds = ownedProperties.map((p) => p.id);
    const [allOffersRes, allInspectionsRes, allApplicationsRes, allMediaRequestsRes] = await Promise.all([
      supabase.from("offers").select("*").in("property_id", propertyIds).order("created_at", { ascending: false }),
      supabase.from("inspections").select("*").in("property_id", propertyIds).order("created_at", { ascending: false }),
      supabase.from("rental_applications").select("*").in("property_id", propertyIds).order("created_at", { ascending: false }),
      supabase.from("media_requests").select("*").in("property_id", propertyIds).eq("status", "pending").order("created_at", { ascending: false }),
    ]);

    const groupBy = <T extends { property_id: string }>(rows: T[] | null) => {
      const map = new Map<string, T[]>();
      for (const row of rows || []) {
        if (!map.has(row.property_id)) map.set(row.property_id, []);
        map.get(row.property_id)!.push(row);
      }
      return map;
    };
    const offersByProperty = groupBy(allOffersRes.data);
    const inspectionsByProperty = groupBy(allInspectionsRes.data);
    const applicationsByProperty = groupBy(allApplicationsRes.data);
    const mediaRequestsByProperty = groupBy(allMediaRequestsRes.data);

    const withActivity = ownedProperties.map((property) => ({
      ...property,
      offers: offersByProperty.get(property.id) || [],
      inspections: inspectionsByProperty.get(property.id) || [],
      rentalApplications: applicationsByProperty.get(property.id) || [],
      mediaRequests: mediaRequestsByProperty.get(property.id) || [],
    })) as PropertyWithActivity[];

    setProperties(withActivity);

    const { data: ownedTenancies } = await supabase
      .from("tenancies")
      .select("id, tenant_id, property_id, status, management_delegated")
      .eq("landlord_id", session.user.id);
    setTenancies(ownedTenancies || []);

    const { data: ownedEngageRequests } = await supabase
      .from("engage_chs_requests")
      .select("*")
      .eq("owner_id", session.user.id)
      .order("created_at", { ascending: false });
    setEngageRequests(ownedEngageRequests || []);

    // Real aggregate unread count for the dedicated Engage CHS badge —
    // per direct instruction, separate from the general notification
    // bell. One message-count query per real request, summed — the
    // same real comparison EngageChatThread does per-conversation.
    if (ownedEngageRequests && ownedEngageRequests.length > 0) {
      const counts = await Promise.all(
        ownedEngageRequests.map((r) =>
          supabase
            .from("engage_chs_messages")
            .select("id", { count: "exact", head: true })
            .eq("request_id", r.id)
            .neq("sender_id", session.user.id)
            .gt("created_at", r.client_last_read_at)
        )
      );
      setEngageUnreadCount(counts.reduce((sum, c) => sum + (c.count || 0), 0));
    }

    // Real "rent collected" — restored, found missing during the
    // systematic Owner dashboard comparison. Genuinely summed from
    // real credit transactions whose description actually mentions
    // rent, not just any credit to the wallet, which could include
    // other real income types too (e.g. a withdrawal reversal).
    const { data: walletData } = await supabase
      .from("wallet_transactions")
      .select("amount, direction, description")
      .eq("user_id", session.user.id)
      .eq("wallet_type", "main")
      .eq("direction", "credit");
    const rentSum = (walletData || [])
      .filter((t) => (t.description || "").toLowerCase().includes("rent"))
      .reduce((sum, t) => sum + Number(t.amount), 0);
    setRentCollected(rentSum);

    setLoading(false);
  }

  async function handleApproveRentToOwn(agreementId: string) {
    setApprovingRtoId(agreementId);
    const { error } = await supabase.rpc("approve_rent_to_own_request", { p_agreement_id: agreementId });
    setApprovingRtoId(null);
    if (!error) loadData();
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


  async function handleOfferDecision(offerId: string, status: "accepted" | "rejected") {
    setActionError(null);
    const sellerNote = sellerOfferNotes[offerId]?.trim() || null;
    const { data: offer, error } = await supabase.from("offers").update({ status, seller_response_note: sellerNote }).eq("id", offerId).select("*, properties(title)").single();
    if (error) {
      setActionError("Could not update this offer. Please try again.");
      return;
    }
    // A real notification for the actual buyer — this is exactly the
    // gap the client specifically flagged: someone acting on something
    // with no way to ever tell the other real person it happened.
    // The real fix here: the seller's own genuine message, if they
    // wrote one, not just a fixed, generic line either way.
    if (offer) {
      await supabase.rpc("notify_user", {
        p_user_id: offer.buyer_id,
        p_title: status === "accepted" ? "Your offer was accepted! Proceed to payment" : "Your offer was declined",
        p_body: sellerNote
          ? sellerNote
          : status === "accepted"
            ? "The owner has accepted your offer. Return to the property page to see your real total due and complete payment."
            : "The owner has declined your offer on this property.",
        p_link: `/property/${offer.property_id}`,
      });

      // The exact real nudge restored from the original app — a
      // genuine, real-world source of stale listings is an owner who
      // simply forgets to mark a property unavailable once a deal
      // closes. Nudging right at the moment the deal starts moving
      // forward, not waiting until it's fully done, since that's the
      // actual point the owner is genuinely thinking about it.
      if (status === "accepted") {
        const propertyTitle = (offer as unknown as { properties?: { title: string } }).properties?.title || "This property";
        await supabase.rpc("notify_user", {
          p_user_id: session!.user.id,
          p_title: "📌 Reminder: update your listing status",
          p_body: `${propertyTitle} — you've accepted an offer of ${formatNaira(offer.amount)}. Once this sale is finalised, remember to mark the listing as sold so buyers stop asking about a property that's no longer available.`,
          p_link: `/property/${offer.property_id}`,
        });
      }
    }
    loadData();
  }

  async function handleApplicationDecision(applicationId: string, status: "approved" | "owner_declined") {
    setActionError(null);

    if (status === "approved") {
      // The real fix: this now genuinely creates the tenancy and
      // generates the correct, two-sided rental commission (5%
      // tenant, 5.5% landlord) at the exact same real moment —
      // previously this only flipped a status label and never
      // created a real tenancy at all.
      const { error } = await supabase.rpc("approve_rental_application", { p_application_id: applicationId });
      if (error) {
        setActionError(error.message);
        return;
      }
      loadData();
      return;
    }

    const { error } = await supabase.from("rental_applications").update({ status }).eq("id", applicationId).select("*, properties(title)").single();
    if (error) {
      setActionError("Could not update this application. Please try again.");
      return;
    }
    loadData();
  }

  async function handleAnswerRequest(requestId: string, answer: string) {
    if (!answer.trim()) return;
    setActionError(null);
    const { error } = await supabase
      .from("media_requests")
      .update({ status: "answered", answer: answer.trim(), answered_at: new Date().toISOString() })
      .eq("id", requestId);
    if (error) {
      setActionError("Could not save this answer. Please try again.");
      return;
    }
    loadData();
  }

  async function handleTogglePrivacy(propertyId: string, visible: boolean) {
    setActionError(null);
    const { error } = await supabase.from("properties").update({ owner_identity_visible_to_tenant: visible }).eq("id", propertyId);
    if (error) {
      setActionError("Could not update this setting. Please try again.");
      return;
    }
    loadData();
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen zone-owner bg-[var(--zone-bg)] pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <div className="flex justify-between items-center mt-1">
          <h1 className="font-serif text-lg font-bold">My Properties</h1>
          <div className="flex gap-2">
            <Link href="/market-demand" className="bg-white/15 text-xs font-semibold px-3 py-1.5 rounded-full">
              Market Demand
            </Link>
            <Link href="/engage-chs" className="relative bg-white/15 text-xs font-semibold px-3 py-1.5 rounded-full">
              Engage CHS
              {engageUnreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-chs-red text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {engageUnreadCount}
                </span>
              )}
            </Link>
            <Link href="/list-property" className="bg-chs-red text-xs font-semibold px-3 py-1.5 rounded-full">
              + List a property
            </Link>
          </div>
        </div>

        {/* Real summary stats — restored, found missing during the
            systematic Owner dashboard comparison against the real
            original. Every number here is genuinely computed from
            real data, never a placeholder. */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="text-center">
            <p className="font-serif text-lg font-bold">{properties.length}</p>
            <p className="text-[9px] text-white/60 uppercase">Listings</p>
          </div>
          <div className="text-center">
            <p className="font-serif text-lg font-bold">{tenancies.filter((t) => t.status === "active").length}</p>
            <p className="text-[9px] text-white/60 uppercase">Active tenants</p>
          </div>
          <div className="text-center">
            <p className="font-serif text-lg font-bold">{formatNaira(rentCollected)}</p>
            <p className="text-[9px] text-white/60 uppercase">Rent collected</p>
          </div>
        </div>
      </div>

      {actionError && (
        <p className="text-xs text-chs-red bg-chs-amber-light mx-4 mt-3 rounded-lg px-3 py-2">{actionError}</p>
      )}

      {properties.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-12 px-4">
          You don&apos;t have any properties listed yet.
        </p>
      ) : (
        <div className="px-4 py-4 space-y-4">
          {properties.map((property) => (
            <div key={property.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4">
              <div className="flex justify-between items-start mb-2">
                <h2 className="font-semibold text-sm text-chs-charcoal">{property.title}</h2>
                <span className="text-[10px] font-bold uppercase text-chs-red bg-chs-amber-light px-2 py-1 rounded-full">
                  {purposeLabel(property.purpose)}
                </span>
              </div>

              <Link href={`/edit-listing/${property.id}`} className="text-[10px] font-semibold text-chs-red underline">
                Edit listing
              </Link>
              {" · "}
              <Link href={`/analytics/${property.id}`} className="text-[10px] font-semibold text-chs-red underline">
                Analytics
              </Link>
              {" · "}
              <Link href={`/promote/${property.id}`} className="text-[10px] font-semibold text-chs-amber-dark underline">
                ⭐ Promote
              </Link>
              {property.purpose === "sale" && (
                <>
                  {" · "}
                  <Link href={`/urgent-sale/${property.id}`} className="text-[10px] font-semibold text-red-600 underline">
                    🚨 Urgent Sale
                  </Link>
                </>
              )}

              {/* Real, per-property identity privacy toggle — restored,
                  found completely missing during the systematic Owner
                  dashboard comparison. */}
              <div className="flex gap-1.5 mt-1.5">
                <button
                  onClick={() => handleTogglePrivacy(property.id, true)}
                  className={`text-[9px] font-semibold px-2 py-1 rounded-full border ${
                    property.owner_identity_visible_to_tenant ? "bg-chs-red text-white border-chs-red" : "bg-[var(--zone-card)] text-gray-600 border-gray-200"
                  }`}
                >
                  Show my name
                </button>
                <button
                  onClick={() => handleTogglePrivacy(property.id, false)}
                  className={`text-[9px] font-semibold px-2 py-1 rounded-full border ${
                    !property.owner_identity_visible_to_tenant ? "bg-chs-red text-white border-chs-red" : "bg-[var(--zone-card)] text-gray-600 border-gray-200"
                  }`}
                >
                  Keep private
                </button>
              </div>

              {/* Real fix, confirmed by direct testing: this
                  previously showed unconditionally for every
                  listing, including a land sale where "house rules"
                  genuinely makes no sense — a buyer takes full
                  ownership, there's no ongoing occupancy relationship
                  the way there is for a real tenant, shortlet guest,
                  or someone progressively paying toward ownership. */}
              {session && ["rent", "lease", "shortlet", "rent_to_own"].includes(property.purpose) && (
                <HouseRulesUpload propertyId={property.id} session={session} />
              )}

              {property.offers.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-chs-charcoal mb-1">Offers ({property.offers.length})</p>
                  {property.offers.map((offer) => (
                    <div key={offer.id} className="bg-gray-50 rounded-lg p-2.5 mb-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">{formatNaira(offer.amount)}</span>
                        <span className="text-gray-400 capitalize">{offer.status}</span>
                      </div>
                      {property.purpose === "sale" && offer.status === "pending" && (
                        <div className="bg-white rounded-md p-2 mt-1.5 space-y-1 border border-gray-100">
                          <div className="flex justify-between text-[10px]"><span className="text-gray-500">Total buyer will pay you</span><span className="font-semibold">{formatNaira(offer.amount)}</span></div>
                          <div className="flex justify-between text-[10px]"><span className="text-gray-500">Our commission (6%)</span><span className="font-semibold">{formatNaira(offer.amount * 0.06)}</span></div>
                          <div className="flex justify-between text-[10px] border-t border-gray-100 pt-1"><span className="font-bold text-chs-charcoal">You will net</span><span className="font-bold text-chs-red">{formatNaira(offer.amount * 0.94)}</span></div>
                        </div>
                      )}
                      {offer.note && <p className="text-gray-500 mt-1">{offer.note}</p>}
                      {offer.status === "pending" && (
                        <div className="mt-2">
                          <textarea value={sellerOfferNotes[offer.id] || ""} onChange={(e) => setSellerOfferNotes((prev) => ({ ...prev, [offer.id]: e.target.value }))}
                            placeholder="Optional message to the buyer — e.g. a reason, or the amount you'd actually accept"
                            rows={2} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
                          <div className="flex gap-2">
                            <button onClick={() => handleOfferDecision(offer.id, "accepted")}
                              className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                              Offer Accepted — Proceed to Payment
                            </button>
                            <button onClick={() => handleOfferDecision(offer.id, "rejected")}
                              className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                              Decline
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {property.rentalApplications.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-chs-charcoal mb-1">
                    Rental applications ({property.rentalApplications.length})
                  </p>
                  {property.rentalApplications.map((app) => (
                    <div key={app.id} className="bg-gray-50 rounded-lg p-2.5 mb-2 text-xs">
                      <p>Guarantor: {app.guarantor_name} — {app.guarantor_phone}</p>
                      <p className="text-gray-500">Move-in: {app.move_in_date}</p>
                      <p className="text-gray-400 capitalize mt-1">Status: {app.status.replace(/_/g, " ")}</p>
                      {app.status === "awaiting_owner_decision" && (
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleApplicationDecision(app.id, "approved")}
                            className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                            Approve
                          </button>
                          <button onClick={() => handleApplicationDecision(app.id, "owner_declined")}
                            className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {property.inspections.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-chs-charcoal mb-1">
                    Inspection requests ({property.inspections.length})
                  </p>
                  {property.inspections.map((insp) => (
                    <InspectionRequestRow key={insp.id} inspection={insp} onMarked={loadData} />
                  ))}
                </div>
              )}

              {property.mediaRequests.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-chs-charcoal mb-1">
                    Questions awaiting your answer ({property.mediaRequests.length})
                  </p>
                  {property.mediaRequests.map((req) => (
                    <MediaRequestAnswerRow key={req.id} request={req} onAnswer={handleAnswerRequest} />
                  ))}
                </div>
              )}

              {property.offers.length === 0 && property.rentalApplications.length === 0 && property.inspections.length === 0 && property.mediaRequests.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">No activity on this property yet.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {tenancies.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs font-bold text-chs-charcoal mb-2">Active tenancies</p>
          {tenancies.map((t) => (
            <div key={t.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 capitalize">{t.status}</span>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setIssuingNoticeTenancy(t); setNoticeIssued(false); }}
                    className="text-[10px] font-semibold text-chs-charcoal underline"
                  >
                    Issue notice
                  </button>
                  <button
                    onClick={() => { setDisputingTenancy(t); setDisputeSubmitted(false); }}
                    className="text-[10px] font-semibold text-chs-red underline"
                  >
                    Raise a dispute
                  </button>
                </div>
              </div>
              {t.management_delegated && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-[10px] text-chs-amber-dark font-semibold mb-1">✓ CHS is managing this property</p>
                  <RequestTermination tenancyId={t.id} onDone={loadData} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {session && <TransactionCommissions session={session} />}

      {shortletBookings.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs font-bold text-chs-charcoal mb-2">🏠 Shortlet Guests</p>
          {shortletBookings.map((b) => (
            <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
              <p className="text-xs font-semibold text-chs-charcoal">{b.properties?.[0]?.title || "Property"}</p>
              <p className="text-[10px] text-gray-400">{b.guest_full_name} · {b.check_in} → {b.check_out}</p>
              <HostShortletCheckInOut bookingId={b.id} propertyTitle={b.properties?.[0]?.title || "Property"} />
              <ShortletMessageThread bookingId={b.id} viewerRole="host" guestName={b.guest_full_name} />
            </div>
          ))}
        </div>
      )}

      {rentToOwnRequests.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs font-bold text-chs-charcoal mb-2">🏠 Rent-to-Own Requests</p>
          {rentToOwnRequests.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
              <p className="text-xs font-semibold text-chs-charcoal">{r.properties?.[0]?.title || "Property"}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {formatNaira(r.monthly_amount)}/month toward {formatNaira(r.total_price)} total
              </p>
              <button onClick={() => handleApproveRentToOwn(r.id)} disabled={approvingRtoId === r.id}
                className="mt-2 w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                {approvingRtoId === r.id ? "Approving..." : "✓ Approve this request"}
              </button>
            </div>
          ))}
        </div>
      )}

      {faultReports.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs font-bold text-chs-charcoal mb-2">🔧 Maintenance Requests</p>
          {faultReports.map((f) => (
            <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
              <p className="text-xs font-semibold text-chs-charcoal">{f.properties?.[0]?.title || "Property"} — {f.category}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{f.description}</p>
              <span className="inline-block mt-1 text-[9px] font-bold uppercase text-chs-red bg-chs-amber-light px-2 py-1 rounded-full">
                {f.status.replace(/_/g, " ")}
              </span>
              {f.status === "completed_pending_confirmation" && (
                <div className="mt-2">
                  {confirmJobMessage[f.id] && <p className="text-[10px] text-gray-600 mb-1">{confirmJobMessage[f.id]}</p>}
                  <button onClick={() => handleConfirmJobCompletion(f.id)} disabled={confirmingJobId === f.id}
                    className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                    {confirmingJobId === f.id ? "Processing..." : "✓ Confirm work done & pay artisan"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {engageRequests.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs font-bold text-chs-charcoal mb-2">My CHS Service Requests</p>
          {engageRequests.map((r) => (
            <div key={r.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
              <div className="flex justify-between items-center">
                <p className="text-xs font-semibold text-chs-charcoal">{r.service_type}</p>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  r.status === "accepted" || r.status === "agreement_signed" ? "text-chs-red bg-chs-amber-light" :
                  r.status === "rejected" ? "text-gray-500 bg-gray-100" :
                  "text-chs-amber-dark bg-chs-amber-light"
                }`}>
                  {r.status.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">Ref {r.reference}</p>
              {r.admin_note && (
                <p className="text-xs text-gray-600 mt-1.5 bg-gray-50 rounded-lg p-2">{r.admin_note}</p>
              )}
              {session && <EngageChatThread requestId={r.id} session={session} isAdmin={false} reference={r.reference} />}
              <EngageDocumentsList requestId={r.id} />
            </div>
          ))}
        </div>
      )}

      {issuingNoticeTenancy && session && (
        <div className="px-4 pb-6">
          <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4">
            {noticeIssued ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-chs-charcoal mb-1">✓ Notice issued</p>
                <p className="text-xs text-gray-500 mb-3">This is now recorded permanently — the tenant has been notified, and the exact moment they open it will be logged here too.</p>
                <button onClick={() => setIssuingNoticeTenancy(null)} className="text-xs font-semibold text-chs-red">
                  Close
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold text-chs-charcoal mb-3">📋 Issue a Formal Notice</p>
                <IssueNoticeForm
                  tenancyId={issuingNoticeTenancy.id}
                  tenantId={issuingNoticeTenancy.tenant_id}
                  session={session}
                  onSuccess={() => setNoticeIssued(true)}
                  onCancel={() => setIssuingNoticeTenancy(null)}
                />
              </>
            )}
          </div>
        </div>
      )}

      {disputingTenancy && session && (
        <div className="px-4 pb-6">
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
                <p className="text-xs font-bold text-chs-charcoal mb-3">Raise a dispute</p>
                <RaiseDisputeForm
                  session={session}
                  tenancyId={disputingTenancy.id}
                  againstUserId={disputingTenancy.tenant_id}
                  onSuccess={() => setDisputeSubmitted(true)}
                  onCancel={() => setDisputingTenancy(null)}
                />
              </>
            )}
          </div>
        </div>
      )}
      {showGuide && <GuidePrompt role="owner" onDismiss={() => setShowGuide(false)} />}
    </div>
  );
}

// A small, self-contained answer row — keeps its own local input state,
// only calling back up to the parent once a real answer is actually
// submitted, rather than lifting every keystroke into the main
// dashboard's state.
function MediaRequestAnswerRow({
  request,
  onAnswer,
}: {
  request: MediaRequest;
  onAnswer: (id: string, answer: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  return (
    <div className="bg-gray-50 rounded-lg p-2.5 mb-2 text-xs">
      <p className="font-semibold text-chs-charcoal">{request.description}</p>
      <div className="flex gap-2 mt-2">
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answer..."
          className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
        />
        <button
          onClick={() => onAnswer(request.id, answer)}
          className="px-3 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold"
        >
          Answer
        </button>
      </div>
    </div>
  );
}

// The real Readiness Score display — see
// backend-v2/56_buyer_readiness_score.sql. Never blocks or hides the
// request itself; it's purely information for the owner to prioritize
// their own time, exactly the real problem this was built to solve.
function InspectionRequestRow({
  inspection,
  onMarked,
}: {
  inspection: Inspection;
  onMarked: () => void;
}) {
  const [score, setScore] = useState<number | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    supabase.rpc("get_readiness_score", { p_user_id: inspection.requester_id }).then(({ data }) => {
      if (typeof data === "number") setScore(data);
    });
  }, [inspection.requester_id]);

  const scheduledPast = new Date(`${inspection.requested_date}T${inspection.requested_time}`) < new Date();
  const needsAttendanceMark = scheduledPast && (inspection.status === "confirmed" || inspection.status === "pending");

  async function handleMark(attended: boolean) {
    setMarking(true);
    await supabase.rpc("mark_inspection_attendance", { p_inspection_id: inspection.id, p_attended: attended });
    setMarking(false);
    onMarked();
  }

  return (
    <div className="bg-gray-50 rounded-lg p-2.5 mb-2 text-xs">
      <div className="flex justify-between items-start">
        <div>
          <p>{inspection.requested_date} at {inspection.requested_time}</p>
          <p className="text-gray-500">{inspection.meeting_point}</p>
        </div>
        {score !== null && (
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
            score >= 60 ? "bg-green-100 text-green-700" : score >= 30 ? "bg-amber-100 text-amber-700" : "bg-gray-200 text-gray-500"
          }`}>
            {score}/100 ready
          </span>
        )}
      </div>
      {needsAttendanceMark && (
        <div className="flex gap-1.5 mt-2">
          <button onClick={() => handleMark(true)} disabled={marking}
            className="px-3 py-1 rounded-full bg-green-600 text-white text-[10px] font-semibold disabled:opacity-50">
            They showed up
          </button>
          <button onClick={() => handleMark(false)} disabled={marking}
            className="px-3 py-1 rounded-full bg-gray-300 text-gray-700 text-[10px] font-semibold disabled:opacity-50">
            No-show
          </button>
        </div>
      )}
      {inspection.status === "no_show" && (
        <p className="text-[10px] text-chs-red mt-1.5">Marked as no-show</p>
      )}
    </div>
  );
}
