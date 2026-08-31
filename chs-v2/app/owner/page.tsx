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
import NotificationBell from "@/components/NotificationBell";
import OwnerAdminMessageThread from "@/components/OwnerAdminMessageThread";
import OfferMessageThread from "@/components/OfferMessageThread";
import MessageThread from "@/components/MessageThread";

interface TenancyBasic {
  id: string;
  tenant_id: string;
  property_id: string;
  status: string;
  management_delegated: boolean;
  lease_end: string;
  notice_given_at: string | null;
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
  const [faultReports, setFaultReports] = useState<{ id: string; category: string; description: string; status: string; approved_vendor: string | null; approved_amount: number | null; properties: { title: string }[] | null; fault_quotations: { vendor_name: string; amount: number; artisans: { user_id: string; trade: string } | null }[] | null }[]>([]);
  const [rentToOwnRequests, setRentToOwnRequests] = useState<{ id: string; total_price: number; monthly_amount: number; properties: { title: string }[] | null }[]>([]);
  const [approvingRtoId, setApprovingRtoId] = useState<string | null>(null);
  const [sellerOfferNotes, setSellerOfferNotes] = useState<Record<string, string>>({});
  const [offerActionMode, setOfferActionMode] = useState<Record<string, "accept" | "decline" | null>>({});
  const [acceptWithInstallment, setAcceptWithInstallment] = useState<Record<string, boolean>>({});
  const [downpaymentPct, setDownpaymentPct] = useState<Record<string, string>>({});
  const [paidOffersAwaitingDispatch, setPaidOffersAwaitingDispatch] = useState<{ id: string; amount: number; properties: { title: string } | null; document_dispatch_requests: { id: string; status: string }[] }[]>([]);
  const [dispatchMethod, setDispatchMethod] = useState<Record<string, string>>({});
  const [dispatchTracking, setDispatchTracking] = useState<Record<string, string>>({});
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<{ total_properties: number; active_listings: number; occupied_or_sold: number; total_real_earnings: number; pending_offers: number; open_fault_reports: number } | null>(null);
  const [showConcernForm, setShowConcernForm] = useState(false);
  const [concernSubject, setConcernSubject] = useState("");
  const [concernMessage, setConcernMessage] = useState("");
  const [submittingConcern, setSubmittingConcern] = useState(false);
  const [concernSubmitted, setConcernSubmitted] = useState(false);
  const [showMessageThread, setShowMessageThread] = useState(false);
  const [earningsLedger, setEarningsLedger] = useState<{ id: string; amount: number; description: string; created_at: string; wallet_type: string }[]>([]);
  const [showEarningsLedger, setShowEarningsLedger] = useState(false);
  const [messagingTenancy, setMessagingTenancy] = useState<TenancyBasic | null>(null);
  const [linkingAgentPropertyId, setLinkingAgentPropertyId] = useState<string | null>(null);
  const [postListingAgentId, setPostListingAgentId] = useState("");
  const [linkingAgent, setLinkingAgent] = useState(false);
  const [linkAgentError, setLinkAgentError] = useState<string | null>(null);
  const [revokingAgentId, setRevokingAgentId] = useState<string | null>(null);
  const [replacingAgentPropertyId, setReplacingAgentPropertyId] = useState<string | null>(null);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentPhone, setNewAgentPhone] = useState("");
  const [newAgentChsId, setNewAgentChsId] = useState("");
  const [submittingReplacement, setSubmittingReplacement] = useState(false);
  const [replacementRequestSubmitted, setReplacementRequestSubmitted] = useState(false);
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
      .select("id, category, description, status, approved_vendor, approved_amount, property_id, properties!inner(title, owner_id), fault_quotations(vendor_name, amount, artisans(user_id, trade))")
      .eq("properties.owner_id", session.user.id)
      .neq("status", "resolved")
      .then(({ data }) => setFaultReports((data as unknown as typeof faultReports) || []));

    supabase
      .from("rent_to_own_agreements")
      .select("id, total_price, monthly_amount, properties(title)")
      .eq("seller_id", session.user.id)
      .eq("status", "requested")
      .then(({ data }) => setRentToOwnRequests((data as unknown as typeof rentToOwnRequests) || []));

    // Real fix found through direct client testing: a seller had no
    // way to see a real payment had landed, no visibility into their
    // real held balance for that specific sale, and nowhere to mark
    // real documents as sent.
    supabase
      .from("offers")
      .select("id, amount, properties!inner(title, owner_id), document_dispatch_requests(id, status)")
      .eq("properties.owner_id", session.user.id)
      .eq("payment_status", "paid")
      .eq("legal_transfer_confirmed", false)
      .then(({ data }) => setPaidOffersAwaitingDispatch((data as unknown as typeof paidOffersAwaitingDispatch) || []));

    // Real, genuine portfolio-wide summary — replacing what used to
    // require mentally tallying numbers down a long scrolling list.
    supabase.rpc("get_owner_portfolio_summary", { p_owner_id: session.user.id }).then(({ data }) => {
      if (data && data[0]) setPortfolioSummary(data[0]);
    });

    // Real, itemized earnings ledger — every real credit this owner
    // has genuinely received, not a single opaque total.
    supabase
      .from("wallet_transactions")
      .select("id, amount, description, created_at, wallet_type")
      .eq("user_id", session.user.id)
      .eq("direction", "credit")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setEarningsLedger(data || []));

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
      .select("id, tenant_id, property_id, status, management_delegated, lease_end, notice_given_at")
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


  async function handleRaiseConcern() {
    if (!concernSubject.trim() || !concernMessage.trim()) return;
    setSubmittingConcern(true);
    const { error } = await supabase.rpc("raise_owner_concern", { p_property_id: null, p_subject: concernSubject.trim(), p_message: concernMessage.trim() });
    setSubmittingConcern(false);
    if (!error) {
      setConcernSubmitted(true);
      setConcernSubject("");
      setConcernMessage("");
    }
  }

  async function handleRevokeAgent(propertyId: string) {
    setRevokingAgentId(propertyId);
    setActionError(null);
    const { error } = await supabase.rpc("revoke_managing_agent", { p_property_id: propertyId });
    setRevokingAgentId(null);
    if (error) {
      setActionError(error.message);
      return;
    }
    loadData();
  }

  async function handleRequestReplacement(propertyId: string) {
    setSubmittingReplacement(true);
    const { error } = await supabase.rpc("request_agent_replacement", {
      p_property_id: propertyId,
      p_chs_id: newAgentChsId.trim(),
      p_name: newAgentName.trim(),
      p_phone: newAgentPhone.trim(),
    });
    setSubmittingReplacement(false);
    if (!error) {
      setReplacementRequestSubmitted(true);
      setNewAgentName("");
      setNewAgentPhone("");
      setNewAgentChsId("");
    }
  }

  async function handleLinkAgentPostListing(propertyId: string) {
    if (!postListingAgentId.trim()) return;
    setLinkingAgent(true);
    setLinkAgentError(null);
    const { error } = await supabase.rpc("link_managing_agent_by_id", { p_property_id: propertyId, p_chs_agent_id: postListingAgentId.trim() });
    setLinkingAgent(false);
    if (error) {
      setLinkAgentError(error.message);
      return;
    }
    setLinkingAgentPropertyId(null);
    setPostListingAgentId("");
    loadData();
  }

  async function handleMarkDispatched(offerId: string) {
    setDispatchingId(offerId);
    setActionError(null);
    const { error } = await supabase.rpc("mark_documents_dispatched", {
      p_offer_id: offerId,
      p_method: dispatchMethod[offerId] || "Courier",
      p_tracking: dispatchTracking[offerId] || null,
    });
    setDispatchingId(null);
    if (error) {
      setActionError(error.message);
      return;
    }
    loadData();
  }

  async function handleAcceptWithInstallment(offerId: string) {
    setActionError(null);
    const pct = Number(downpaymentPct[offerId]);
    if (!pct || pct <= 0 || pct > 100) {
      setActionError("Please enter a real, valid down payment percentage between 1 and 100.");
      return;
    }
    const { error } = await supabase.rpc("accept_offer_with_installment", { p_offer_id: offerId, p_downpayment_pct: pct });
    if (error) {
      setActionError(error.message);
      return;
    }
    loadData();
  }

  async function handleOfferDecision(offerId: string, status: "accepted" | "rejected") {
    setActionError(null);
    const sellerNote = sellerOfferNotes[offerId]?.trim() || null;
    if (status === "rejected" && !sellerNote) {
      setActionError("Please state a real reason for declining — this protects both you and the buyer if it's ever disputed, and helps them understand what it would take to reach a deal.");
      return;
    }
    const { data: offer, error } = await supabase.from("offers").update({ status, seller_response_note: sellerNote }).eq("id", offerId).select("*, properties(title)").single();
    if (error) {
      setActionError(error.message.includes("phone number") || error.message.includes("email")
        ? error.message
        : "Could not update this offer. Please try again.");
      return;
    }
    // A real notification for the actual buyer — this is exactly the
    // gap the client specifically flagged: someone acting on something
    // with no way to ever tell the other real person it happened.
    // This fixed, system-generated text is always safe to deliver
    // directly — it's the seller's own free-text note, if they wrote
    // one, that carries the real risk of taking a live negotiation
    // off-platform, so that part alone routes through real CHS
    // moderation instead of straight to the buyer.
    if (offer) {
      await supabase.rpc("notify_user", {
        p_user_id: offer.buyer_id,
        p_title: status === "accepted" ? "Your offer was accepted! Proceed to payment" : "Your offer was declined",
        p_body: status === "accepted"
          ? "The owner has accepted your offer. Return to the property page to see your real total due and complete payment."
          : "The owner has declined your offer on this property.",
        p_link: `/property/${offer.property_id}`,
      });

      if (sellerNote) {
        await supabase.rpc("send_precommit_message", { p_offer_id: offerId, p_text: sellerNote });
      }

      // The exact real nudge restored from the original app — a
      // genuine, real-world source of stale listings is an owner who
      // simply forgets to mark a property unavailable once a deal
      // closes. Nudging right at the moment the deal starts moving
      // forward, not waiting until it's fully done, since that's the
      // actual point the owner is genuinely thinking about it.
      // Real fix per direct client testing: this used to ask the
      // owner to manually remember to mark a listing sold — stale
      // advice from before payment itself automatically updated the
      // property's real status. Replaced with an accurate message
      // reflecting what genuinely happens now, with no manual step
      // left for the owner to forget.
      if (status === "accepted") {
        const propertyTitle = (offer as unknown as { properties?: { title: string } }).properties?.title || "This property";
        await supabase.rpc("notify_user", {
          p_user_id: session!.user.id,
          p_title: "✓ Offer accepted",
          p_body: `${propertyTitle} — you've accepted an offer of ${formatNaira(offer.amount)}. Once the buyer completes payment, CHS automatically marks this listing sold and removes it from search — no action needed from you.`,
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
          <div className="flex items-center gap-2 shrink-0">
            <h1 className="font-serif text-lg font-bold">My Properties</h1>
            <NotificationBell />
          </div>
          <div className="flex gap-2 items-center overflow-x-auto max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link href="/market-demand" className="shrink-0 whitespace-nowrap bg-white/15 text-xs font-semibold px-3 py-1.5 rounded-full">
              Market Demand
            </Link>
            <Link href="/engage-chs" className="shrink-0 whitespace-nowrap relative bg-white/15 text-xs font-semibold px-3 py-1.5 rounded-full">
              Engage CHS
              {engageUnreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-chs-red text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {engageUnreadCount}
                </span>
              )}
            </Link>
            <Link href="/list-property" className="shrink-0 whitespace-nowrap bg-chs-red text-xs font-semibold px-3 py-1.5 rounded-full">
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
          {portfolioSummary && (
            <>
              <div className="text-center">
                <p className="font-serif text-lg font-bold">{portfolioSummary.occupied_or_sold}</p>
                <p className="text-[9px] text-white/60 uppercase">Sold / Occupied</p>
              </div>
              <div className="text-center">
                <p className="font-serif text-lg font-bold">{portfolioSummary.pending_offers}</p>
                <p className="text-[9px] text-white/60 uppercase">Pending offers</p>
              </div>
              <div className="text-center">
                <p className="font-serif text-lg font-bold">{portfolioSummary.open_fault_reports}</p>
                <p className="text-[9px] text-white/60 uppercase">Open faults</p>
              </div>
            </>
          )}
        </div>
        <p className="text-[9px] text-white/50 uppercase font-semibold mt-4 mb-1.5">Quick Actions</p>
        <div className="grid grid-cols-4 gap-1.5">
          <button onClick={() => { setShowConcernForm(!showConcernForm); setShowMessageThread(false); setShowEarningsLedger(false); }}
            className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-center ${showConcernForm ? "bg-chs-red" : "bg-white/15"}`}>
            <span className="text-base">⚠️</span>
            <span className="text-[8px] text-white font-semibold leading-tight">Raise a<br />Concern</span>
          </button>
          <button onClick={() => { setShowMessageThread(!showMessageThread); setShowConcernForm(false); setShowEarningsLedger(false); }}
            className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-center ${showMessageThread ? "bg-chs-red" : "bg-white/15"}`}>
            <span className="text-base">💬</span>
            <span className="text-[8px] text-white font-semibold leading-tight">Direct Line<br />to CHS</span>
          </button>
          <button onClick={() => { setShowEarningsLedger(!showEarningsLedger); setShowConcernForm(false); setShowMessageThread(false); }}
            className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-center ${showEarningsLedger ? "bg-chs-red" : "bg-white/15"}`}>
            <span className="text-base">📊</span>
            <span className="text-[8px] text-white font-semibold leading-tight">Earnings<br />History</span>
          </button>
          <Link href="/list-property"
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-center bg-chs-red">
            <span className="text-base">➕</span>
            <span className="text-[8px] text-white font-semibold leading-tight">List a<br />Property</span>
          </Link>
        </div>
        {showConcernForm && (
          <div className="bg-white rounded-lg p-3 mt-2">
            {concernSubmitted ? (
              <p className="text-xs text-green-700 font-semibold text-center py-2">✓ Your concern has been sent to CHS — you&apos;ll be notified once it&apos;s addressed.</p>
            ) : (
              <>
                <input type="text" placeholder="Subject" value={concernSubject} onChange={(e) => setConcernSubject(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs mb-1.5" />
                <textarea placeholder="Describe your concern in detail" value={concernMessage} onChange={(e) => setConcernMessage(e.target.value)}
                  rows={3} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs mb-1.5" />
                <button onClick={handleRaiseConcern} disabled={submittingConcern || !concernSubject.trim() || !concernMessage.trim()}
                  className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                  {submittingConcern ? "Sending..." : "Send to CHS"}
                </button>
              </>
            )}
          </div>
        )}
        {showMessageThread && session && (
          <div className="mt-2">
            <OwnerAdminMessageThread ownerId={session.user.id} viewerRole="owner" />
          </div>
        )}
        {showEarningsLedger && (
          <div className="bg-white rounded-lg p-3 mt-2 max-h-72 overflow-y-auto">
            {earningsLedger.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">No real earnings recorded yet.</p>
            ) : (
              earningsLedger.map((tx) => (
                <div key={tx.id} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-[11px] text-chs-charcoal font-semibold">{tx.description}</p>
                    <p className="text-[9px] text-gray-400">{new Date(tx.created_at).toLocaleDateString()} · {tx.wallet_type === "escrow_held" ? "Held (pending document transfer)" : "Main wallet"}</p>
                  </div>
                  <p className="text-xs font-bold text-green-700">+{formatNaira(tx.amount)}</p>
                </div>
              ))
            )}
          </div>
        )}
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

              {property.purpose !== "sale" && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  {property.managing_agent_id ? (
                    <>
                      <p className="text-[10px] text-green-700 font-semibold mb-1">✓ A real agent has full management authority on this property</p>
                      <button onClick={() => handleRevokeAgent(property.id)} disabled={revokingAgentId === property.id}
                        className="text-[10px] font-semibold text-chs-red underline">
                        {revokingAgentId === property.id ? "Revoking..." : "⚠️ Relieve this agent of duty"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setLinkingAgentPropertyId(linkingAgentPropertyId === property.id ? null : property.id)}
                        className="text-[10px] font-semibold text-chs-red underline">
                        🤝 Grant an agent full management authority
                      </button>
                      <button onClick={() => setReplacingAgentPropertyId(replacingAgentPropertyId === property.id ? null : property.id)}
                        className="text-[10px] font-semibold text-chs-charcoal underline ml-3">
                        Request a new agent through CHS
                      </button>
                    </>
                  )}
                  {linkingAgentPropertyId === property.id && !property.managing_agent_id && (
                    <div className="mt-2 bg-[var(--zone-card)] rounded-lg p-2.5">
                      <input type="text" placeholder="Agent's real CHS ID, e.g. CHS-AGT-12345" value={postListingAgentId}
                        onChange={(e) => setPostListingAgentId(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
                      {linkAgentError && <p className="text-[10px] text-chs-red mb-1.5">{linkAgentError}</p>}
                      <button onClick={() => handleLinkAgentPostListing(property.id)} disabled={linkingAgent}
                        className="w-full py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
                        {linkingAgent ? "Linking..." : "Link this agent"}
                      </button>
                    </div>
                  )}
                  {replacingAgentPropertyId === property.id && (
                    <div className="mt-2 bg-[var(--zone-card)] rounded-lg p-2.5">
                      {replacementRequestSubmitted ? (
                        <p className="text-[10px] text-green-700 font-semibold text-center py-1">✓ Sent to CHS — we&apos;ll verify their identity and grant access.</p>
                      ) : (
                        <>
                          <p className="text-[9px] text-gray-500 mb-1.5">Real name, phone, or CHS ID — whatever you have. CHS will verify before granting any access.</p>
                          <input type="text" placeholder="New agent's real name" value={newAgentName}
                            onChange={(e) => setNewAgentName(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
                          <input type="text" placeholder="Phone number" value={newAgentPhone}
                            onChange={(e) => setNewAgentPhone(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
                          <input type="text" placeholder="Real CHS ID, if you have it (optional)" value={newAgentChsId}
                            onChange={(e) => setNewAgentChsId(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
                          <button onClick={() => handleRequestReplacement(property.id)} disabled={submittingReplacement}
                            className="w-full py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
                            {submittingReplacement ? "Sending..." : "Send to CHS for verification"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

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
                      {offer.status === "pending" && !offerActionMode[offer.id] && (
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => setOfferActionMode((prev) => ({ ...prev, [offer.id]: "accept" }))}
                            className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                            Accept Offer
                          </button>
                          <button onClick={() => { setOfferActionMode((prev) => ({ ...prev, [offer.id]: "decline" })); setActionError(null); }}
                            className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                            Decline Offer
                          </button>
                        </div>
                      )}
                      {offer.status === "pending" && offerActionMode[offer.id] === "accept" && (
                        <div className="mt-2">
                          <textarea value={sellerOfferNotes[offer.id] || ""} onChange={(e) => setSellerOfferNotes((prev) => ({ ...prev, [offer.id]: e.target.value }))}
                            placeholder="Optional message to the buyer — reviewed by CHS before delivery. Please don't include a phone number or email; all negotiation stays on-platform until payment is made."
                            rows={2} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
                          <label className="flex items-center gap-1.5 mb-1.5">
                            <input type="checkbox" checked={!!acceptWithInstallment[offer.id]}
                              onChange={(e) => setAcceptWithInstallment((prev) => ({ ...prev, [offer.id]: e.target.checked }))} />
                            <span className="text-[10px] text-gray-600">Accept a down payment instead of full payment</span>
                          </label>
                          {acceptWithInstallment[offer.id] && (
                            <input type="number" min={1} max={100} placeholder="Minimum down payment %, e.g. 30"
                              value={downpaymentPct[offer.id] || ""} onChange={(e) => setDownpaymentPct((prev) => ({ ...prev, [offer.id]: e.target.value }))}
                              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
                          )}
                          {actionError && <p className="text-[10px] text-chs-red mb-1.5">{actionError}</p>}
                          <div className="flex gap-2">
                            <button onClick={() => acceptWithInstallment[offer.id] ? handleAcceptWithInstallment(offer.id) : handleOfferDecision(offer.id, "accepted")}
                              className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                              Confirm — Offer Accepted, Proceed to Payment
                            </button>
                            <button onClick={() => setOfferActionMode((prev) => ({ ...prev, [offer.id]: null }))}
                              className="px-3 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                              Back
                            </button>
                          </div>
                        </div>
                      )}
                      {offer.status === "pending" && offerActionMode[offer.id] === "decline" && (
                        <div className="mt-2">
                          <textarea value={sellerOfferNotes[offer.id] || ""} onChange={(e) => setSellerOfferNotes((prev) => ({ ...prev, [offer.id]: e.target.value }))}
                            placeholder="Required — why you're declining, and what you'd actually accept if anything. Reviewed by CHS before delivery; no phone numbers or emails."
                            rows={2} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
                          {actionError && <p className="text-[10px] text-chs-red mb-1.5">{actionError}</p>}
                          <div className="flex gap-2">
                            <button onClick={() => handleOfferDecision(offer.id, "rejected")}
                              className="flex-1 py-1.5 rounded-full bg-gray-600 text-white text-[10px] font-semibold">
                              Confirm Decline
                            </button>
                            <button onClick={() => { setOfferActionMode((prev) => ({ ...prev, [offer.id]: null })); setActionError(null); }}
                              className="px-3 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                              Back
                            </button>
                          </div>
                        </div>
                      )}
                      {(offer.status === "pending" || offer.status === "accepted") && (
                        <OfferMessageThread offerId={offer.id} viewerRole="seller" viewerId={session?.user.id || ""} />
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
                <span className="text-xs text-gray-500 capitalize">{t.status}</span>                <div className="flex gap-3">
                  <button
                    onClick={() => setMessagingTenancy(t)}
                    className="text-[10px] font-semibold text-chs-red underline"
                  >
                    💬 Message tenant
                  </button>
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
              {t.lease_end && (() => {
                const daysLeft = Math.ceil((new Date(t.lease_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <p className="text-[10px] text-gray-500 mt-1.5">
                    {daysLeft > 0 ? `${daysLeft} real day${daysLeft !== 1 ? "s" : ""} to next rent due` : "Rent is due"}
                    {t.notice_given_at && <span className="text-green-700 font-semibold"> · Tenant has given non-renewal notice</span>}
                  </p>
                );
              })()}
              {t.management_delegated && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-[10px] text-chs-amber-dark font-semibold mb-1">✓ CHS is managing this property</p>
                  <RequestTermination tenancyId={t.id} onDone={loadData} />
                </div>
              )}
            </div>
          ))}

          {messagingTenancy && session && (
            <MessageThread
              tenancyId={messagingTenancy.id}
              session={session}
              recipientId={messagingTenancy.tenant_id}
              recipientLabel="Your tenant"
              onClose={() => setMessagingTenancy(null)}
            />
          )}
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

      {paidOffersAwaitingDispatch.length > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-chs-red rounded-xl p-4 mb-2">
            <p className="text-sm font-bold text-white mb-1">💰 Real payment received — action needed</p>
            <p className="text-[11px] text-white/80">A buyer has paid in full. Your real net proceeds are visible in your Wallet, held until you send real documents and the buyer confirms receipt.</p>
          </div>
          {paidOffersAwaitingDispatch.map((offer) => {
            const dispatchReq = offer.document_dispatch_requests?.[0];
            return (
              <div key={offer.id} className="bg-white rounded-xl border-2 border-chs-red p-3 mb-2">
                <p className="text-sm font-semibold text-chs-charcoal mb-1">{offer.properties?.title || "Property"}</p>
                <p className="text-xs text-gray-500 mb-2">Sold for {formatNaira(offer.amount)} — real proceeds held pending document transfer.</p>
                {!dispatchReq && (
                  <p className="text-[10px] text-gray-400 mb-2">Waiting on the buyer to request their documents, or you can send them proactively below.</p>
                )}
                {dispatchReq?.status === "requested" && (
                  <p className="text-[10px] bg-chs-amber-light text-chs-amber-dark rounded-full px-2 py-1 mb-2 inline-block">⏳ Buyer has requested your real documents</p>
                )}
                {dispatchReq?.status === "dispatched" ? (
                  <p className="text-[10px] bg-green-50 text-green-700 rounded-full px-2 py-1 inline-block">📦 Marked dispatched — waiting on buyer to confirm receipt</p>
                ) : (
                  <>
                    <select value={dispatchMethod[offer.id] || "Courier"} onChange={(e) => setDispatchMethod((prev) => ({ ...prev, [offer.id]: e.target.value }))}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5">
                      <option>Courier</option>
                      <option>Barrister / Legal representative</option>
                      <option>Hand delivery</option>
                    </select>
                    <input type="text" placeholder="Tracking reference (optional)" value={dispatchTracking[offer.id] || ""}
                      onChange={(e) => setDispatchTracking((prev) => ({ ...prev, [offer.id]: e.target.value }))}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
                    <button onClick={() => handleMarkDispatched(offer.id)} disabled={dispatchingId === offer.id}
                      className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                      {dispatchingId === offer.id ? "Saving..." : "✓ Mark real documents as sent"}
                    </button>
                  </>
                )}
              </div>
            );
          })}
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
              {f.fault_quotations && f.fault_quotations.length > 0 && (
                <div className="bg-[var(--zone-card)] rounded-lg p-2 mt-2">
                  <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Real artisan correspondence</p>
                  {f.fault_quotations.map((q, i) => (
                    <div key={i} className="flex justify-between text-[10px] py-0.5">
                      <span className="text-chs-charcoal">
                        {q.vendor_name}{q.artisans?.trade ? ` (${q.artisans.trade})` : ""}
                        {f.approved_vendor === q.vendor_name && <span className="text-green-700 font-semibold"> ✓ Approved</span>}
                      </span>
                      <span className="font-semibold">{formatNaira(q.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
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
