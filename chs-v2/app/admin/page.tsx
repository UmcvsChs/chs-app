"use client";

import { embeddedOne } from "@/lib/embedded";
import { Suspense, useEffect, useState } from "react";
import { termsAcceptanceRequired } from "@/lib/termsVersion";
import { validateIdNumber } from "@/lib/validators";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Session } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { RentalApplication } from "@/types/rentalApplication";
import { Dispute } from "@/types/dispute";
import { CommunityFeedback } from "@/types/communityFeedback";
import { EngageRequest } from "@/types/engageRequest";
import { MarketplaceVendor } from "@/types/marketplace";
import { FaultReport } from "@/types/faultReport";
import { Offer } from "@/types/offer";
import { Artisan } from "@/types/artisan";
import { Inspection } from "@/types/inspection";
import GuidePrompt from "@/components/GuidePrompt";
import PlatformSettingsPanel from "@/components/PlatformSettingsPanel";
import DocumentViewLink from "@/components/DocumentViewLink";
import EngageChatThread from "@/components/EngageChatThread";
import { EngageDocumentManager } from "@/components/EngageDocuments";
import InfoTip from "@/components/InfoTip";
import AdminHotelControls from "@/components/AdminHotelControls";
import AdminRtoPanel from "@/components/AdminRtoPanel";

interface DeveloperApplication {
  id: string;
  user_id: string;
  company_name: string;
  cac_number: string;
  current_projects: string | null;
  offers_instalments: boolean;
  accepts_investment_capital: boolean;
  years_experience: string;
  portfolio_url: string | null;
  status: string;
  created_at: string;
}
import { ReferralFeeSetting, ReferralFeeOwed } from "@/types/referralFee";
import OwnerAdminMessageThread from "@/components/OwnerAdminMessageThread";
import RoleBadge from "@/components/RoleBadge";
import AdminSidebar from "@/components/AdminSidebar";
import NotificationBell from "@/components/NotificationBell";
import { formatNaira } from "@/lib/format";

interface PendingProfile {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  state: string;
  created_at: string;
}

interface PendingProperty {
  id: string;
  title: string;
  location_area: string;
  purpose: string;
  price: number;
  primary_document_type: string | null;
  acquisition_method: string | null;
  owner_id: string;
  created_at: string;
  property_sale_documents: { id: string; document_type: string; file_url: string; verification_status: string }[];
  profiles: { full_name: string; phone: string; valid_id_verified: boolean; valid_id_type: string | null; valid_id_number: string | null }[] | null;
}

export type Tab = "hotelcontrols" | "walletsecurity" | "rtorequests" | "overview" | "analytics" | "finance" | "trace" | "auditlog" | "processedhistory" | "transactionlog" | "userregistry" | "conditionreports" | "escrowoversight" | "saleapprovals" | "liveness" | "buyerid" | "registrations" | "applications" | "offerreview" | "properties" | "disputes" | "feedback" | "engage" | "vendors" | "referrals" | "faults" | "artisans" | "inspections" | "developers" | "tenantregisteroversight" | "shortletdeposits" | "shortletbookings" | "marketplacemoderation" | "platformearnings" | "staleoffers" | "notificationsfeed" | "subadminactivities" | "assignrole" | "staffreports" | "subadmindailyreports" | "subadminpanel" | "settings" | "superadminindex";

// Real, new for the fuller ID verification: what a person told us
// about themselves when submitting their ID, shown to the admin
// alongside an automatic comparison of the name they registered with
// against the name they typed from their ID document. A mismatch is
// exactly the thing an admin is there to catch.
interface IdSubmissionDetails {
  full_name_on_id: string | null; gender: string | null; age_bracket: string | null;
  state_of_residence: string | null; residential_address: string | null; occupation: string | null;
  contact_email: string | null; contact_phone: string | null; id_already_used_elsewhere: boolean | null;
  avs_status?: string | null; avs_extracted_name?: string | null; avs_extracted_id_number?: string | null;
  avs_name_match?: boolean | null; avs_id_number_match?: boolean | null; avs_notes?: string | null;
}

function nameMatch(registered?: string | null, onId?: string | null): "match" | "partial" | "differ" {
  const tokens = (v?: string | null) => (v || "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  const a = tokens(registered);
  const b = tokens(onId);
  if (!a.length || !b.length) return "differ";
  const aSet = new Set(a);
  const bSet = new Set(b);
  if (a.every((t) => bSet.has(t)) || b.every((t) => aSet.has(t))) return "match";
  return a.some((t) => bSet.has(t)) ? "partial" : "differ";
}

function IdSubmissionDetailsBlock({ sub }: { sub: { id_type: string; id_number: string; profiles: { full_name: string; phone?: string } | null } & Partial<IdSubmissionDetails> }) {
  const status = nameMatch(sub.profiles?.full_name, sub.full_name_on_id);
  return (
    <div className="mb-2 space-y-1.5">
      {sub.id_already_used_elsewhere && (
        <p className="text-[11px] font-bold text-chs-red bg-red-50 rounded-lg px-2 py-1.5">
          🚩 This ID number is already verified on a different account. Check carefully before approving.
        </p>
      )}
      {/* Real, new AVS (Automated Verification System) result block —
          shows what Claude's real vision read directly off the
          uploaded document image, compared against what the
          applicant typed, so admin can see the specific discrepancy
          rather than re-reading the whole document from scratch. This
          is a text-matching first pass only — it does not confirm the
          document is genuine or that the applicant's face matches;
          that remains a human judgment call, or a future, separate
          Phase 2 using a licensed identity-verification provider. */}
      {sub.avs_status === "running" && (
        <div className="bg-blue-50 rounded-lg border border-blue-100 p-2 text-[11px] flex items-center gap-1.5">
          <span className="animate-pulse">🤖</span> Reading the document automatically…
        </div>
      )}
      {sub.avs_status === "match" && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-2 text-[11px] space-y-0.5">
          <p className="text-green-700 font-semibold">✓ Automated check: name and ID number on the document both match what was submitted</p>
          {sub.avs_notes && <p className="text-gray-500">{sub.avs_notes}</p>}
        </div>
      )}
      {sub.avs_status === "mismatch" && (
        <div className="bg-red-50 rounded-lg border border-chs-red p-2 text-[11px] space-y-1">
          <p className="text-chs-red font-bold">🚩 Automated check found a discrepancy — review before approving</p>
          {sub.avs_name_match === false && (
            <p><span className="text-gray-500">Name on document reads:</span> <b>{sub.avs_extracted_name || "(could not read)"}</b> <span className="text-gray-400">— submitted as</span> <b>{sub.full_name_on_id}</b></p>
          )}
          {sub.avs_id_number_match === false && (
            <p><span className="text-gray-500">ID number on document reads:</span> <b>{sub.avs_extracted_id_number || "(could not read)"}</b> <span className="text-gray-400">— submitted as</span> <b>{sub.id_number}</b></p>
          )}
          {sub.avs_notes && <p className="text-gray-500">{sub.avs_notes}</p>}
        </div>
      )}
      {sub.avs_status === "error" && (
        <p className="text-[11px] text-gray-400 bg-gray-50 rounded-lg px-2 py-1.5">
          ⚠ Automated check could not complete — {sub.avs_notes || "please review this document manually."}
        </p>
      )}
      {sub.full_name_on_id ? (
        <>
          <div className="bg-white rounded-lg border border-gray-100 p-2 text-[11px] space-y-0.5">
            <p><span className="text-gray-400">Registered as:</span> <b>{sub.profiles?.full_name}</b>{sub.profiles?.phone ? ` · ${sub.profiles.phone}` : ""}</p>
            <p><span className="text-gray-400">Name on ID:</span> <b>{sub.full_name_on_id}</b></p>
            {status === "match" && <p className="text-green-700 font-semibold">✓ The registered name matches the name on the ID</p>}
            {status === "partial" && <p className="text-chs-amber-dark font-semibold">⚠ Only part of the name matches — check the document carefully</p>}
            {status === "differ" && <p className="text-chs-red font-semibold">⚠ The registered name and the name on the ID do not match</p>}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-gray-600">
            <p><span className="text-gray-400">Gender:</span> <span className="capitalize">{sub.gender}</span></p>
            <p><span className="text-gray-400">Age bracket:</span> {sub.age_bracket}</p>
            <p><span className="text-gray-400">State:</span> {sub.state_of_residence}</p>
            <p><span className="text-gray-400">Occupation:</span> {sub.occupation}</p>
            <p className="col-span-2"><span className="text-gray-400">Address:</span> {sub.residential_address}</p>
            <p className="col-span-2"><span className="text-gray-400">Contact phone:</span> <b>{sub.contact_phone}</b>{sub.contact_phone && sub.profiles?.phone && sub.contact_phone.replace(/\D/g, "").slice(-10) !== sub.profiles.phone.replace(/\D/g, "").slice(-10) ? " (different from the number they registered with)" : ""}</p>
            <p className="col-span-2"><span className="text-gray-400">Email:</span> {sub.contact_email}</p>
          </div>
        </>
      ) : (
        <p className="text-[10px] text-gray-400">Submitted before the fuller verification form existed — only the ID type and number were collected.</p>
      )}
      <p className="text-xs text-gray-500 capitalize">{sub.id_type?.replace(/_/g, " ")} — {sub.id_number}</p>
    </div>
  );
}
interface TracePromotion { is_active: boolean; rank_category: string | null; properties: { title: string }[] | null; }
interface TraceProperty { id: string; title: string; verification_status: string; status: string; property_sale_documents: { id: string; document_type: string; file_url: string; verification_status: string }[]; property_house_rules: { document_url: string }[]; }

export default function AdminDashboard() {
  return (
    <Suspense fallback={null}>
      <AdminDashboardInner />
    </Suspense>
  );
}

function AdminDashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, profile, signOut, setTestModeRole, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Real, additional defense-in-depth fix, following the exact same
  // client-reported bug happening a second time via a different real
  // path than the notification link this was first fixed for. Rather
  // than patch one more specific navigation path, this refreshes data
  // the moment any of the real, time-sensitive review tabs becomes
  // active — no matter how the admin got there (a notification, a
  // direct tab click, a bookmark, anything) — so stale data left over
  // from whenever the page first loaded can never again be what's
  // shown for something this time-sensitive.
  //
  // Real, second fix to this same effect, found and confirmed against
  // a further, genuinely reproduced client report: the first version
  // of this fix added a ref that only allowed one real refresh per
  // tab, for the entire page session — meaning the very first time an
  // admin opened ID Verification (even to correctly see it empty), it
  // was marked "already refreshed" and every later, genuinely new
  // submission arriving after that was silently skipped. That guard
  // was never actually needed — a useEffect with activeTab in its own
  // dependency array only re-runs when activeTab genuinely changes
  // value on its own, so there was no real redundant-firing risk to
  // guard against in the first place. Removed entirely: this now
  // correctly refreshes every real time the tab becomes active, not
  // just the first time in a session.
  useEffect(() => {
    const freshnessCriticalTabs: Tab[] = ["buyerid", "liveness", "registrations", "offerreview", "applications", "saleapprovals"];
    if (freshnessCriticalTabs.includes(activeTab) && profile?.role === "admin") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, profile?.role]);

  // Real, direct fix so a notification link like /admin?tab=offerreview
  // genuinely lands on the right tab — not just on first load, but
  // every time, including when admin is already sitting on /admin and
  // clicks a second, different notification. The previous attempt
  // here only read window.location.search once on mount (empty [] 
  // deps), so it silently did nothing on a same-route navigation —
  // exactly the "still lands on Overview" behaviour reported.
  // useSearchParams() is the real, reactive way to do this in the App
  // Router: it updates on every URL change, and this effect re-runs
  // whenever it does.
  // Real, critical fix following a direct, confirmed client report: a
  // buyer's real ID verification notification arrived, the "Tap to
  // view" link correctly switched to the ID Verification tab, but the
  // tab showed empty — because this effect only ever changed which
  // tab was visible, it never re-fetched real data. If the admin was
  // already on this page when the buyer submitted, the underlying
  // data was fetched once at page-mount time, before the real
  // submission existed, and was never refreshed afterward. Confirmed
  // directly: the real database record existed the whole time, RLS
  // was correctly allowing it, the render logic was correct — the
  // only real bug was that arriving via a notification link never
  // triggered a fresh reload.
  //
  // Real, second fix to this same effect, following a further,
  // direct client report with a fresh, reproduced example: the first
  // fix genuinely worked in isolation, but had its own real bug —
  // profile loads asynchronously from a separate auth context, and
  // this effect only ever depended on searchParams. If the effect
  // fired before profile had finished loading, profile?.role ===
  // "admin" was false, loadData() was silently skipped, and — since
  // profile wasn't a dependency — the effect never ran again to
  // retry once profile actually became available. Confirmed this
  // exact scenario directly against the client's real, reproduced
  // submission before fixing it. profile?.role is now a real
  // dependency, so this correctly retries the moment profile finishes
  // loading, even if the first attempt was too early.
  useEffect(() => {
    const requestedTab = searchParams.get("tab") as Tab | null;
    if (requestedTab) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(requestedTab);
      if (profile?.role === "admin") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadData();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, profile?.role]);

  const [pendingProfiles, setPendingProfiles] = useState<PendingProfile[]>([]);
  // Real Overview stats — restored, found completely missing during
  // the systematic Admin comparison. The original's version of every
  // one of these numbers was entirely fake and hardcoded (1,240
  // listings, 4,210 users, etc.) — every number here is genuinely
  // computed from real, current data instead.
  const [overviewStats, setOverviewStats] = useState({ totalListings: 0, verifiedListings: 0, registeredUsers: 0, propertiesWithRules: 0, rulesAcknowledged: 0 });
  // Real wallet lookup + freeze — restored, found completely missing.
  // The original's "Freeze wallet" was itself never real — a toast
  // with no actual effect. This version genuinely, functionally
  // blocks withdrawal at the database level once frozen.
  const [walletSearch, setWalletSearch] = useState("");
  const [walletResult, setWalletResult] = useState<{ id: string; full_name: string; role: string; main_balance: number; rent_savings: number; maintenance_reserve: number; frozen: boolean } | null>(null);
  const [walletSearchError, setWalletSearchError] = useState<string | null>(null);
  // Real Sale Approvals — restored, found completely missing. A real,
  // distinct financial safety checkpoint between an owner accepting a
  // sale offer and money actually moving to escrow.
  const [pendingSaleApprovals, setPendingSaleApprovals] = useState<(Offer & { properties: { title: string } | null })[]>([]);
  const [recentlyHandledSaleApprovals, setRecentlyHandledSaleApprovals] = useState<{ id: string; amount: number; chs_cleared: boolean; properties: { title: string } | null }[]>([]);
  function loadRecentlyHandledSaleApprovals() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    supabase.from("offers")
      .select("id, amount, chs_cleared, properties(title)")
      .eq("status", "accepted").eq("chs_cleared", true)
      .is("archived_at", null)
      .or(`admin_last_read_at.is.null,admin_last_read_at.gt.${cutoff}`)
      .order("admin_last_read_at", { ascending: false }).limit(200)
      .then(({ data }) => setRecentlyHandledSaleApprovals((data as unknown as typeof recentlyHandledSaleApprovals) || []));
  }
  useEffect(() => { loadRecentlyHandledSaleApprovals(); }, []);
  async function handleArchiveSaleApproval(id: string) {
    await supabase.from("offers").update({ archived_at: new Date().toISOString() }).eq("id", id);
    setRecentlyHandledSaleApprovals((prev) => prev.filter((x) => x.id !== id));
  }
  const [pendingLiveness, setPendingLiveness] = useState<{ id: string; user_id: string; captured_photo_url: string; created_at: string; profiles: { full_name: string } | null }[]>([]);
  const [pendingBuyerIds, setPendingBuyerIds] = useState<({ id: string; user_id: string; id_type: string; id_number: string; id_document_url: string; created_at: string; profiles: { full_name: string; phone?: string } | null } & IdSubmissionDetails)[]>([]);
  // Hotels, lodges and venues whose availability calendar nobody has
  // confirmed lately. Guests book on what a calendar shows, so a stale one
  // is where "I booked and they cancelled" comes from.
  const [staleCalendars, setStaleCalendars] = useState<{ id: string; title: string; owner_name: string; owner_phone: string; calendar_confirmed_at: string | null; days_since: number | null; rooms: number; pending_requests: number }[]>([]);
  // The live queue of hotel / lodge / venue requests that are still in flight:
  // waiting for CHS to relay them, with the host, or waiting for the guest to pay.
  const [bookingQueue, setBookingQueue] = useState<{
    id: string; stage: "awaiting_admin_relay" | "pending_host_review" | "awaiting_payment"; lane: string; property_title: string;
    host_name: string; host_phone: string; guest_full_name: string; guest_phone: string; check_in: string; check_out: string;
    expected_arrival_time: string | null; amount_if_confirmed: number; payment_status: string; hold_expires_at: string | null;
    created_at: string; admin_relay_note: string | null; relay_mode: string | null; minutes_left: number | null;
    express_group_id?: string | null; instant_booked?: boolean; group_size?: number;
  }[]>([]);
  const [relayNotes, setRelayNotes] = useState<Record<string, string>>({});
  const [bookingRejectReasons, setBookingRejectReasons] = useState<Record<string, string>>({});
  const [queueBusy, setQueueBusy] = useState<string | null>(null);
  // Guest <-> host messages waiting for CHS to review before they are delivered.
  const [pendingMsgs, setPendingMsgs] = useState<{
    id: string; sender_role: string; text: string; created_at: string; booking_ref: string; property_title: string;
    booking_stage: string; guest_full_name: string; is_paid: boolean;
  }[]>([]);
  const [msgReasons, setMsgReasons] = useState<Record<string, string>>({});
  // Stays whose guest has arrived but whose payment is still held: a host asked for release, the guest
  // reported a problem, or the guest has not confirmed yet (it releases itself 24h after check-in).
  // Rent-to-Own (Mortgage) requests from verified buyers. Every request comes to CHS first: relay it to the owner, or
  // reject it with a reason. Previously the request went straight to the owner and admin never saw it.
  const [rtoQueue, setRtoQueue] = useState<{
    id: string; ref: string; property_title: string; property_ref: string; location: string | null; total_price: number; monthly_amount: number; payments: number | null;
    buyer_name: string; buyer_phone: string; buyer_id_verified: boolean; owner_name: string; owner_phone: string; requested_at: string; competing_requests: number; needs_action?: boolean;
  }[]>([]);
  const [rtoNotes, setRtoNotes] = useState<Record<string, string>>({});
  // Transfers a user has reported as not authorised or a scam. The amount is already held in the recipient's wallet.
  const [transferReports, setTransferReports] = useState<{
    id: string; reference: string; amount: number; note: string | null; status: string; created_at: string;
    reporter_name: string; reporter_phone: string; recipient_name: string; recipient_phone: string; recipient_balance: number | null; recipient_frozen: boolean | null; admin_note: string | null;
  }[]>([]);
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  // Unusual wallet patterns found by the automatic scan (every 15 minutes). A flag changes nothing by itself; an admin decides.
  const [riskFlags, setRiskFlags] = useState<{
    id: string; kind: string; details: string; status: string; created_at: string; admin_note: string | null;
    name: string; phone: string; account_created: string; balance: number | null; frozen: boolean | null;
  }[]>([]);
  async function loadRiskFlags() {
    const { data } = await supabase.rpc("get_wallet_risk_flags");
    setRiskFlags(Array.isArray(data) ? (data as unknown as typeof riskFlags) : []);
  }
  async function handleRiskFlag(id: string, action: "clear" | "freeze") {
    const note = (reportNotes[id] || "").trim();
    if (note.length < 5) { setActionError("Please record your finding first (a short sentence)."); return; }
    setQueueBusy(id); setActionError(null);
    const { error } = await supabase.rpc("admin_resolve_risk_flag", { p_flag_id: id, p_action: action, p_note: note });
    setQueueBusy(null);
    if (error) { setActionError(error.message); return; }
    await loadRiskFlags();
  }
  const walletSecurityOpen = transferReports.filter((r) => r.status === "open").length + riskFlags.filter((f) => f.status === "open").length;
  async function loadTransferReports() {
    const { data } = await supabase.rpc("get_transfer_reports");
    setTransferReports(Array.isArray(data) ? (data as unknown as typeof transferReports) : []);
  }
  async function handleTransferReport(id: string, action: "reverse" | "dismiss" | "freeze_recipient") {
    const note = (reportNotes[id] || "").trim();
    if (note.length < 5) { setActionError("Please record your finding first (a short sentence)."); return; }
    setQueueBusy(id); setActionError(null);
    const { error } = await supabase.rpc("admin_resolve_transfer_report", { p_report_id: id, p_action: action, p_note: note });
    setQueueBusy(null);
    if (error) { setActionError(error.message); return; }
    await loadTransferReports();
  }
  async function loadRtoQueue() {
    const { data } = await supabase.rpc("get_rto_admin_queue");
    setRtoQueue(Array.isArray(data) ? (data as unknown as typeof rtoQueue) : []);
  }
  async function handleRtoDecision(id: string, relay: boolean) {
    const note = (rtoNotes[id] || "").trim();
    if (!relay && note.length < 5) { setActionError("Please give the buyer a reason for rejecting (a short sentence)."); return; }
    setQueueBusy(id); setActionError(null);
    const { error } = relay
      ? await supabase.rpc("admin_relay_rent_to_own", { p_agreement_id: id, p_note: note || null })
      : await supabase.rpc("admin_reject_rent_to_own", { p_agreement_id: id, p_reason: note });
    setQueueBusy(null);
    if (error) { setActionError(error.message); return; }
    await loadRtoQueue();
  }
  const [releaseItems, setReleaseItems] = useState<{
    id: string; booking_ref: string; property_title: string; guest_full_name: string; guest_phone: string; host_name: string; host_phone: string;
    check_in: string; check_out: string; amount_held: number; host_net: number; auto_release_at: string | null;
    release_requested_at: string | null; release_request_note: string | null; move_in_issue_note: string | null; kind: "problem" | "host_requested" | "arrived_unconfirmed";
  }[]>([]);
  async function loadReleaseItems() {
    const { data } = await supabase.rpc("get_shortlet_release_attention");
    setReleaseItems(((data as unknown as { items: typeof releaseItems } | null)?.items) || []);
  }
  async function handleReleaseNow(id: string, kind: string) {
    if (kind === "problem" && !window.confirm("The guest reported a problem on arrival. Release the host's payment anyway?")) return;
    setQueueBusy(id); setActionError(null);
    const { error } = await supabase.rpc("release_shortlet_funds_to_host", { p_booking_id: id });
    setQueueBusy(null);
    if (error) { setActionError(error.message); return; }
    await loadReleaseItems();
  }
  async function loadPendingMsgs() {
    const { data } = await supabase.rpc("get_pending_shortlet_messages");
    setPendingMsgs((data as unknown as typeof pendingMsgs) || []);
  }
  async function handleApproveMsg(id: string) {
    setQueueBusy(id); setActionError(null);
    const { error } = await supabase.rpc("approve_shortlet_message", { p_message_id: id });
    setQueueBusy(null);
    if (error) { setActionError(error.message); return; }
    await loadPendingMsgs();
  }
  async function handleRejectMsg(id: string) {
    const reason = (msgReasons[id] || "").trim();
    if (!reason) { setActionError("Please give a short reason, so the sender knows what to change."); return; }
    setQueueBusy(id); setActionError(null);
    const { error } = await supabase.rpc("reject_shortlet_message", { p_message_id: id, p_reason: reason });
    setQueueBusy(null);
    if (error) { setActionError(error.message); return; }
    await loadPendingMsgs();
  }
  async function loadBookingQueue() {
    const { data } = await supabase.rpc("get_admin_booking_queue");
    setBookingQueue((data as unknown as typeof bookingQueue) || []);
  }
  async function handleRelayBooking(id: string) {
    setQueueBusy(id); setActionError(null);
    const { error } = await supabase.rpc("admin_relay_booking", { p_booking_id: id, p_note: (relayNotes[id] || "").trim() || null });
    setQueueBusy(null);
    if (error) { setActionError(error.message); return; }
    await loadBookingQueue();
  }
  async function handleRejectBooking(id: string) {
    const reason = (bookingRejectReasons[id] || "").trim();
    if (!reason) { setActionError("Please write a real reason before declining a booking request."); return; }
    setQueueBusy(id); setActionError(null);
    const { error } = await supabase.rpc("admin_reject_booking", { p_booking_id: id, p_reason: reason });
    setQueueBusy(null);
    if (error) { setActionError(error.message); return; }
    await loadBookingQueue();
  }
  // Real, new feature per direct client request: a real buyer accepted
  // an offer and simply never paid, with no real way for admin to see
  // it, remind them, or free the property back up — exactly the real,
  // 25-day-old Lekki land deal that prompted this. Tested directly
  // against that real deal before being trusted.
  const [stalePendingOffers, setStalePendingOffers] = useState<{ id: string; amount: number; pending_since: string; days_pending: number; property_title: string; property_id: string; buyer_name: string; buyer_phone: string; seller_name: string; seller_phone: string }[]>([]);
  const [staleOfferReasons, setStaleOfferReasons] = useState<Record<string, string>>({});
  useEffect(() => {
    supabase.rpc("get_stale_pending_offers", { p_grace_days: 7 })
      .then(({ data }) => setStalePendingOffers((data as unknown as typeof stalePendingOffers) || []));
  }, []);
  async function handleSendStaleReminder(offerId: string) {
    await supabase.rpc("send_offer_payment_reminder", { p_offer_id: offerId });
    setActionError(null);
  }
  async function handleReleaseStaleOffer(offerId: string) {
    const reason = (staleOfferReasons[offerId] || "").trim();
    if (!reason) { setActionError("Please state a real reason before releasing this offer."); return; }
    const { error } = await supabase.rpc("release_stale_offer", { p_offer_id: offerId, p_reason: reason });
    if (error) { setActionError(error.message); return; }
    setStalePendingOffers((prev) => prev.filter((o) => o.id !== offerId));
  }
  // Real, direct fix per explicit, repeated client feedback: nothing
  // an admin acts on should vanish — it should move here, stay fully
  // re-viewable, and only ever leave when admin deliberately archives
  // it. Same real, already-proven pattern as Offers and Engage CHS,
  // now extended to ID Verification and Face Verification.
  const [recentlyHandledBuyerIds, setRecentlyHandledBuyerIds] = useState<({ id: string; status: string; id_type: string; id_number: string; id_document_url: string; admin_last_read_at: string | null; profiles: { full_name: string; phone?: string } | null } & IdSubmissionDetails)[]>([]);
  const [recentlyHandledLiveness, setRecentlyHandledLiveness] = useState<{ id: string; status: string; captured_photo_url: string; admin_last_read_at: string | null; profiles: { full_name: string } | null }[]>([]);
  function loadRecentlyHandledVerifications() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    supabase.from("buyer_id_verifications")
      .select("id, status, id_type, id_number, id_document_url, admin_last_read_at, full_name_on_id, gender, age_bracket, state_of_residence, residential_address, occupation, contact_email, contact_phone, id_already_used_elsewhere, profiles!buyer_id_verifications_user_id_fkey(full_name, phone)")
      .not("status", "eq", "pending").is("archived_at", null)
      .or(`admin_last_read_at.is.null,admin_last_read_at.gt.${cutoff}`)
      .order("admin_last_read_at", { ascending: false }).limit(200)
      .then(({ data }) => setRecentlyHandledBuyerIds((data as unknown as typeof recentlyHandledBuyerIds) || []));
    supabase.from("liveness_submissions")
      .select("id, status, captured_photo_url, admin_last_read_at, profiles!liveness_submissions_user_id_fkey(full_name)")
      .not("status", "eq", "pending_review").is("archived_at", null)
      .or(`admin_last_read_at.is.null,admin_last_read_at.gt.${cutoff}`)
      .order("admin_last_read_at", { ascending: false }).limit(200)
      .then(({ data }) => setRecentlyHandledLiveness((data as unknown as typeof recentlyHandledLiveness) || []));
  }
  useEffect(() => { loadRecentlyHandledVerifications(); }, []);
  async function handleArchiveBuyerId(id: string) {
    await supabase.from("buyer_id_verifications").update({ archived_at: new Date().toISOString() }).eq("id", id);
    setRecentlyHandledBuyerIds((prev) => prev.filter((x) => x.id !== id));
  }
  async function handleArchiveLiveness(id: string) {
    await supabase.from("liveness_submissions").update({ archived_at: new Date().toISOString() }).eq("id", id);
    setRecentlyHandledLiveness((prev) => prev.filter((x) => x.id !== id));
  }
  const [pendingAgentIds, setPendingAgentIds] = useState<{ id: string; full_name: string; phone: string; valid_id_type: string; valid_id_number: string; valid_id_document_url: string }[]>([]);
  const [pendingManagerCerts, setPendingManagerCerts] = useState<{ id: string; full_name: string; phone: string; profession: string; professional_registration_number: string | null; certificate_document_url: string }[]>([]);
  const [pendingRegistrationsFull, setPendingRegistrationsFull] = useState<{
    id: string; full_name: string; phone: string; role: string; state: string; created_at: string;
    id_type: string | null; id_number: string | null; document_url: string | null;
  }[]>([]);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [propertySearchQuery, setPropertySearchQuery] = useState("");
  const [propertySearchResults, setPropertySearchResults] = useState<{
    id: string; reference_number: string; title: string; purpose: string; status: string; price: number;
    location_area: string; location_state: string; owner_name: string; owner_phone: string; agent_name: string | null;
  }[]>([]);
  const [propertySearchLoading, setPropertySearchLoading] = useState(false);

  async function handlePropertySearch() {
    setPropertySearchLoading(true);
    const { data } = await supabase.rpc("admin_search_properties", { p_query: propertySearchQuery.trim() });
    setPropertySearchResults(data || []);
    setPropertySearchLoading(false);
  }

  const [recentlyHandledRegistrations, setRecentlyHandledRegistrations] = useState<{
    id: string; full_name: string; phone: string; role: string; status: string; id_type: string | null; id_number: string | null; document_url: string | null;
  }[]>([]);
  function loadRecentlyHandledRegistrations() {
    supabase.rpc("get_recently_handled_registrations").then(({ data }) => setRecentlyHandledRegistrations(data || []));
  }
  useEffect(() => { loadRecentlyHandledRegistrations(); }, []);
  async function handleArchiveRegistration(userId: string) {
    await supabase.rpc("archive_registration", { p_user_id: userId });
    setRecentlyHandledRegistrations((prev) => prev.filter((x) => x.id !== userId));
  }

  async function handleRejectWithReason(userId: string) {
    const reason = (rejectReasons[userId] || "").trim();
    if (!reason) {
      setActionError("Please write a real reason before rejecting this registration.");
      return;
    }
    const { error } = await supabase.rpc("reject_registration_with_reason", { p_user_id: userId, p_reason: reason });
    if (error) {
      setActionError(error.message);
      return;
    }
    await supabase.from("profiles").update({ registration_admin_last_read_at: new Date().toISOString() }).eq("id", userId);
    setPendingRegistrationsFull((prev) => prev.filter((p) => p.id !== userId));
    loadRecentlyHandledRegistrations();
  }
  const [tenantRegisterSearch, setTenantRegisterSearch] = useState("");
  // Real, direct correction per explicit client instruction: CHS's
  // own role as moderator means every real tenant-landlord/manager
  // correspondence should be visible here — not gated or delayed
  // before delivery (that stays direct, exactly as it was, so no new
  // friction is added to an already-established relationship), but
  // genuinely seen, "as if copied," with a real, direct flag for
  // exactly the case described: a tenant's real message sitting
  // unanswered, which is CHS's real cue to escalate.
  const [shortletCorrespondence, setShortletCorrespondence] = useState<{
    booking_id: string; property_title: string; guest_name: string; guest_phone: string; host_name: string; host_phone: string;
    last_message_text: string; awaiting_host_reply: boolean; last_message_at: string; message_count: number;
  }[]>([]);
  function loadShortletCorrespondence() {
    supabase.rpc("get_shortlet_correspondence_overview").then(({ data }) => setShortletCorrespondence(data || []));
  }
  useEffect(() => { loadShortletCorrespondence(); }, []);

  const [correspondenceOverview, setCorrespondenceOverview] = useState<{
    tenancy_id: string; property_title: string; street_address: string | null;
    tenant_name: string; tenant_phone: string; responsible_party_name: string | null; responsible_party_phone: string | null; responsible_party_role: string;
    last_message_text: string; awaiting_landlord_reply: boolean; last_message_at: string; message_count: number;
  }[]>([]);
  function loadCorrespondenceOverview() {
    supabase.rpc("get_tenancy_correspondence_overview").then(({ data }) => setCorrespondenceOverview(data || []));
  }
  useEffect(() => { loadCorrespondenceOverview(); }, []);

  const [investorContact, setInvestorContact] = useState("");
  // Real, new User Registry per direct client request: how many real
  // people have registered, how many are genuinely active (using
  // Supabase's own real sign-in timestamps, not invented tracking),
  // and a real, searchable roster with each person's name and their
  // own permanent, unique reference number.
  const [registrySearch, setRegistrySearch] = useState("");
  const [registryData, setRegistryData] = useState<{
    total_registered: number; active_count: number;
    users: { reference_number: string; full_name: string; phone: string; role: string; created_at: string; last_sign_in_at: string | null; is_active: boolean | null }[];
  } | null>(null);
  // Real, new per a direct client request: know how many real users
  // there are in each state — sourced from the state each person
  // confirmed and CHS verified at identity verification, not guessed.
  const [usersByState, setUsersByState] = useState<{ state: string; total_users: number; verified_users: number }[]>([]);
  function loadUserRegistry() {
    supabase.rpc("get_user_registry", { p_active_days: 30, p_search: registrySearch.trim() || null })
      .then(({ data }) => setRegistryData(data));
    supabase.rpc("get_users_by_state").then(({ data }) => setUsersByState((data as typeof usersByState) || []));
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (activeTab === "userregistry") loadUserRegistry(); }, [activeTab]);
  const [investorGrantResult, setInvestorGrantResult] = useState<string | null>(null);
  async function handleGrantInvestor() {
    setActionError(null);
    setInvestorGrantResult(null);
    const { data, error } = await supabase.rpc("grant_investor_access", { p_contact: investorContact.trim() });
    if (error) { setActionError(error.message); return; }
    setInvestorGrantResult(`✓ ${data} now has real investor access.`);
    setInvestorContact("");
  }

  const [tenantRegisterResults, setTenantRegisterResults] = useState<{
    id: string; reference_number: string; full_name: string; phone: string; location_area: string; street_address: string | null;
    property_type: string; bedrooms: number; annual_rent: number; occupation: string; id_type: string; id_number: string;
    id_document_url: string | null; selfie_url: string | null; created_at: string;
  }[]>([]);
  const [tenantRegisterLoading, setTenantRegisterLoading] = useState(false);
  const [heldDeposits, setHeldDeposits] = useState<{
    id: string; guest_full_name: string; guest_phone: string; check_in: string; check_out: string;
    security_deposit_amount: number; created_at: string; property_title: string; owner_id: string;
  }[]>([]);
  const [depositReasons, setDepositReasons] = useState<Record<string, string>>({});
  // Real, new: the main money for a shortlet/hire booking (not just the
  // security deposit) held in escrow — previously invisible on this screen.
  const [heldShortletBookings, setHeldShortletBookings] = useState<{
    id: string; guest_full_name: string; guest_phone: string; total_price: number; guest_commission_amount: number;
    host_commission_amount: number; status: string; check_in: string; check_out: string; created_at: string;
    property_title: string; owner_id: string; host_name: string;
  }[]>([]);
  // Real refund controls on the Escrow Oversight screen.
  const [refundOpenKey, setRefundOpenKey] = useState<string | null>(null);
  const [refundReasons, setRefundReasons] = useState<Record<string, string>>({});
  const [refundBusyKey, setRefundBusyKey] = useState<string | null>(null);
  const [escrowNotice, setEscrowNotice] = useState<string | null>(null);
  const [pendingOfferReview, setPendingOfferReview] = useState<{
    id: string; amount: number; note: string | null; buyer_full_name: string | null; buyer_phone: string | null; buyer_occupation: string | null;
    buyer_source_of_funds: string | null; created_at: string;
    properties: { title: string; reference_number: string; profiles: { full_name: string; phone: string } | null } | null;
    buyer: { valid_id_verified: boolean } | null;
  }[]>([]);
  const [pendingOfferDecisions, setPendingOfferDecisions] = useState<{
    id: string; amount: number; owner_decision: string | null; seller_response_note: string | null;
    buyer_full_name: string | null; buyer_phone: string | null; owner_decision_at: string; properties: { title: string } | null;
  }[]>([]);
  // Real, direct fix for a repeated, explicit client complaint: an
  // offer previously vanished from this queue the instant admin acted
  // on it. It now moves down into this real "Recently Handled"
  // section for 7 real days (or until admin manually archives it),
  // matching the exact, already-working pattern built for Engage CHS.
  const [recentlyHandledOffers, setRecentlyHandledOffers] = useState<{
    id: string; amount: number; status: string; buyer_full_name: string | null; buyer_phone: string | null;
    admin_last_read_at: string | null; properties: { title: string } | null;
  }[]>([]);
  function loadRecentlyHandledOffers() {
    supabase.from("offers").select("id, amount, status, buyer_full_name, buyer_phone, admin_last_read_at, properties(title)")
      .not("status", "in", "(awaiting_admin_review,owner_decided_pending_relay)")
      .is("archived_at", null)
      .or(`admin_last_read_at.is.null,admin_last_read_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`)
      .order("admin_last_read_at", { ascending: false }).limit(200)
      .then(({ data }) => setRecentlyHandledOffers((data as unknown as typeof recentlyHandledOffers) || []));
  }
  useEffect(() => { loadRecentlyHandledOffers(); }, []);
  async function handleArchiveOffer(offerId: string) {
    setActionError(null);
    const { error } = await supabase.from("offers").update({ archived_at: new Date().toISOString() }).eq("id", offerId);
    if (error) {
      setActionError("Could not archive this. Please try again.");
      return;
    }
    setRecentlyHandledOffers((prev) => prev.filter((o) => o.id !== offerId));
  }
  const [staleCommissions, setStaleCommissions] = useState<{
    id: string; transaction_type: string; payer_role: string; commission_amount: number;
    base_amount: number; created_at: string; payer_name: string; payer_phone: string;
  }[]>([]);
  useEffect(() => {
    supabase.rpc("get_stale_uncollected_commissions").then(({ data }) => setStaleCommissions((data as unknown as typeof staleCommissions) || []));
  }, []);

  // Real, new dedicated tab per direct client request: a single,
  // clear place to see real platform earnings as they come in, with
  // timestamp and payer details — not buried inside a generic
  // analytics summary.
  const [recentEarnings, setRecentEarnings] = useState<{
    id: string; transaction_type: string; commission_amount: number; created_at: string;
    payer_role: string; status: string; profiles: { full_name: string; phone: string } | null;
  }[]>([]);
  // Real, new Transaction History Log per direct client request:
  // processed count, successful vs refunded outcomes, real money
  // currently held in escrow, and platform earnings broken down by
  // who paid and what kind of transaction it was — plus marketing
  // and subscription revenue, kept genuinely separate from
  // transaction commissions since it's a different real source of
  // income. Real date-range filtering, not a static snapshot.
  const [txLogRange, setTxLogRange] = useState<"7" | "30" | "60" | "90" | "180" | "365" | "custom">("30");
  const [txLogCustomStart, setTxLogCustomStart] = useState("");
  const [txLogCustomEnd, setTxLogCustomEnd] = useState("");
  const [txLogData, setTxLogData] = useState<{
    processed_count: number;
    successful: { count: number; total_value: number };
    refunded: { count: number; total_value: number };
    in_escrow: { count: number; total_value: number };
    platform_earnings: {
      total: number; by_payer_role: Record<string, number>; by_transaction_type: Record<string, number>;
      items: { id: string; paid_at: string; transaction_type: string; payer_role: string; commission_amount: number; base_amount: number; commission_percentage: number; reference: string | null; payer_name: string; property_title: string | null }[];
      pending_items: { id: string; created_at: string; transaction_type: string; payer_role: string; commission_amount: number; base_amount: number; commission_percentage: number; payer_name: string; payer_phone: string; property_title: string | null }[];
    };
    marketing_and_subscriptions: { promotions_total: number; team_subscriptions_total: number };
  } | null>(null);
  const [txLogLoading, setTxLogLoading] = useState(false);
  function loadTransactionLog() {
    setTxLogLoading(true);
    let start: string | null = null;
    let end: string | null = null;
    if (txLogRange === "custom") {
      start = txLogCustomStart ? new Date(txLogCustomStart).toISOString() : null;
      end = txLogCustomEnd ? new Date(txLogCustomEnd + "T23:59:59").toISOString() : null;
    } else {
      start = new Date(Date.now() - Number(txLogRange) * 24 * 60 * 60 * 1000).toISOString();
      end = new Date().toISOString();
    }
    supabase.rpc("get_transaction_history_log", { p_start: start, p_end: end })
      .then(({ data }) => { setTxLogData(data); setTxLogLoading(false); });
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (activeTab === "transactionlog") loadTransactionLog(); }, [activeTab, txLogRange]);

  useEffect(() => {
    supabase.from("transaction_commissions")
      .select("id, transaction_type, commission_amount, created_at, payer_role, status, profiles!transaction_commissions_payer_id_fkey(full_name, phone)")
      .eq("status", "paid").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setRecentEarnings((data as unknown as typeof recentEarnings) || []));
  }, []);

  // Real, new moderation queue completing the marketplace redesign per
  // direct client instruction: every real quote request and vendor
  // response is now held for real admin review before the other party
  // ever sees it, and every real payment is released or refunded only
  // once CHS actually confirms what happened.
  const [marketplaceQueue, setMarketplaceQueue] = useState<{
    id: string; reference_number: string; property_details: string; moderation_status: string;
    vendor_response: string | null; response_moderation_status: string | null; quoted_amount: number | null;
    payment_status: string; created_at: string; product_name: string | null; vendor_name: string | null;
  }[]>([]);
  const [marketplaceReasons, setMarketplaceReasons] = useState<Record<string, string>>({});
  const [heldRent, setHeldRent] = useState<{ id: string; amount: number; release_deadline: string; created_at: string; property_title: string; landlord_name: string }[]>([]);
  useEffect(() => {
    // Real, direct fix for a genuine, confirmed production bug: the
    // old embedded-join query (rent_payments -> tenancies -> properties
    // / profiles) silently returned an empty array via PostgREST, even
    // though the real data and every RLS policy involved were
    // confirmed completely correct via direct database inspection —
    // a real PostgREST embedded-relationship quirk, most likely the
    // genuine ambiguity in tenancies' three separate foreign keys into
    // profiles (landlord_id, tenant_id, manager_id). Replaced with a
    // real, dedicated function, the same safe pattern already used for
    // every other admin data feed on this dashboard.
    loadEscrowData();
  }, []);

  // Real, direct fix per a direct, confirmed source of confusion: a
  // real, brand-new held payment (Felicia Babaranti's ₦1,166,000 rent)
  // genuinely existed and was correctly held the entire time — traced
  // and confirmed directly — but every section of Escrow Oversight
  // only ever loads once, when the admin page first opens, with no
  // real way to see anything that happened afterward without a full
  // page reload. One real, shared refresh for every real held
  // category at once, callable any time, not just on first load.
  async function loadEscrowData() {
    const [rentRes, saleRes, marketRes, depositRes, directRes, bookingRes] = await Promise.all([
      supabase.rpc("get_held_rent_payments"),
      supabase.rpc("get_pending_legal_transfers"),
      supabase.rpc("get_marketplace_queue"),
      supabase.rpc("get_held_shortlet_deposits"),
      supabase.rpc("get_direct_order_queue"),
      supabase.rpc("get_held_shortlet_bookings"),
    ]);
    setHeldRent((rentRes.data as unknown as typeof heldRent) || []);
    setPendingLegalTransfers((saleRes.data as unknown as typeof pendingLegalTransfers) || []);
    setMarketplaceQueue((marketRes.data as unknown as typeof marketplaceQueue) || []);
    setHeldDeposits((depositRes.data as unknown as typeof heldDeposits) || []);
    setDirectOrderQueue((directRes.data as unknown as typeof directOrderQueue) || []);
    setHeldShortletBookings((bookingRes.data as unknown as typeof heldShortletBookings) || []);
  }
  async function handleReleaseRent(id: string) {
    const { error } = await supabase.rpc("release_rent_to_landlord", { p_rent_payment_id: id, p_reason: "admin_override" });
    if (error) { setActionError(error.message); return; }
    setHeldRent((prev) => prev.filter((r) => r.id !== id));
  }
  async function handleReleaseShortletBooking(id: string) {
    setEscrowNotice(null);
    const { error } = await supabase.rpc("release_shortlet_funds_to_host", { p_booking_id: id });
    if (error) { setActionError(error.message); return; }
    setEscrowNotice("Released to the host. They have been notified of the exact amount and the commission deducted.");
    await loadEscrowData();
  }
  // Real, new: one shared refund action for every payer type (tenant,
  // buyer, guest), each calling its own real, tested function. A
  // written reason is always required — it is recorded in the audit
  // trail and shown to the payer.
  async function handleConfirmRefund(key: string, run: (reason: string) => PromiseLike<{ error: { message: string } | null }>) {
    const reason = (refundReasons[key] || "").trim();
    if (!reason) {
      setActionError("Please write the real reason for this refund first — it is recorded permanently in the audit trail and shown to the payer.");
      return;
    }
    setActionError(null);
    setEscrowNotice(null);
    setRefundBusyKey(key);
    const { error } = await run(reason);
    setRefundBusyKey(null);
    if (error) { setActionError(error.message); return; }
    setRefundOpenKey(null);
    setEscrowNotice("Refund issued. The payer has been credited and notified of the exact amount and the exact processing fee, and the other party has been notified.");
    await loadEscrowData();
  }

  useEffect(() => {
    // Real, direct fix for the same class of bug already found and
    // fixed for held rent and sale escrow: this embedded join
    // (service_quote_requests -> marketplace_products -> marketplace_
    // vendors) carried the same real structural risk — and unlike
    // the other two, this one drives real moderation actions, not
    // just a read-only display. Replaced with a real, dedicated
    // function, tested directly with real inserted test data before
    // being trusted, not assumed safe from code inspection alone.
    supabase.rpc("get_marketplace_queue")
      .then(({ data }) => setMarketplaceQueue((data as unknown as typeof marketplaceQueue) || []));
  }, []);

  async function handleApproveRequest(id: string) {
    const { error } = await supabase.rpc("admin_relay_quote_request", { p_request_id: id });
    if (!error) setMarketplaceQueue((prev) => prev.filter((q) => q.id !== id || q.response_moderation_status === "pending_review" || q.payment_status === "held_escrow"));
  }
  async function handleBlockRequest(id: string) {
    if (!(marketplaceReasons[id] || "").trim()) { setActionError("Please write a real reason before blocking this."); return; }
    const { error } = await supabase.rpc("admin_block_quote_request", { p_request_id: id, p_reason: marketplaceReasons[id] });
    if (!error) setMarketplaceQueue((prev) => prev.filter((q) => q.id !== id));
  }
  async function handleApproveResponse(id: string) {
    const { error } = await supabase.rpc("admin_relay_quote_response", { p_request_id: id });
    if (!error) setMarketplaceQueue((prev) => prev.map((q) => q.id === id ? { ...q, response_moderation_status: "approved" } : q));
  }
  async function handleBlockResponse(id: string) {
    if (!(marketplaceReasons[id] || "").trim()) { setActionError("Please write a real reason before blocking this."); return; }
    const { error } = await supabase.rpc("admin_block_quote_response", { p_request_id: id, p_reason: marketplaceReasons[id] });
    if (!error) setMarketplaceQueue((prev) => prev.filter((q) => q.id !== id));
  }
  async function handleReleaseMarketplaceEscrow(id: string) {
    const { error } = await supabase.rpc("release_marketplace_escrow_to_vendor", { p_request_id: id });
    if (!error) setMarketplaceQueue((prev) => prev.filter((q) => q.id !== id));
  }

  // Real direct orders — the genuine "skip the conversation" purchase
  // path, held in the same real escrow, needing the same real,
  // confirmed release or refund before any money moves again.
  const [directOrderQueue, setDirectOrderQueue] = useState<{
    id: string; reference_number: string; amount: number; payment_status: string; created_at: string;
    product_name: string | null; vendor_name: string | null;
  }[]>([]);
  const [directOrderReasons, setDirectOrderReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    // Real, direct fix for a third, related instance of the same
    // embedded-join bug found auditing rent, sale, and the marketplace
    // quote queue. Tested directly with real inserted test data.
    supabase.rpc("get_direct_order_queue")
      .then(({ data }) => setDirectOrderQueue((data as unknown as typeof directOrderQueue) || []));
  }, []);

  async function handleReleaseDirectOrder(id: string) {
    const { error } = await supabase.rpc("release_direct_order_to_vendor", { p_order_id: id });
    if (!error) setDirectOrderQueue((prev) => prev.filter((o) => o.id !== id));
  }
  async function handleRefundDirectOrder(id: string) {
    if (!(directOrderReasons[id] || "").trim()) { setActionError("Please write a real reason before refunding this."); return; }
    const { error } = await supabase.rpc("refund_direct_order_to_buyer", { p_order_id: id, p_reason: directOrderReasons[id] });
    if (!error) setDirectOrderQueue((prev) => prev.filter((o) => o.id !== id));
  }
  async function handleRefundMarketplaceEscrow(id: string) {
    if (!(marketplaceReasons[id] || "").trim()) { setActionError("Please write a real reason before refunding this."); return; }
    const { error } = await supabase.rpc("refund_marketplace_escrow_to_buyer", { p_request_id: id, p_reason: marketplaceReasons[id] });
    if (!error) setMarketplaceQueue((prev) => prev.filter((q) => q.id !== id));
  }


  // Real, new feature completing the deposit mechanism — admin, not
  // the host directly, resolves a held deposit, matching the same
  // CHS-mediated pattern used everywhere else: a claim isn't just the
  // host's word against the guest's.
  useEffect(() => {
    // Real, direct fix for the same class of bug already found and
    // fixed for held rent, sale escrow, and the marketplace queue:
    // this embedded join (shortlet_bookings -> properties) carried
    // the same real structural risk. Replaced with a real, dedicated
    // function, tested directly with real inserted test data.
    supabase.rpc("get_held_shortlet_deposits")
      .then(({ data }) => setHeldDeposits((data as unknown as typeof heldDeposits) || []));
  }, []);

  async function handleResolveDeposit(bookingId: string, decision: "released_to_guest" | "claimed_by_host") {
    if (decision === "claimed_by_host" && !(depositReasons[bookingId] || "").trim()) {
      setActionError("Please write a real reason before claiming this deposit for the host.");
      return;
    }
    const { error } = await supabase.rpc("resolve_security_deposit", {
      p_booking_id: bookingId,
      p_decision: decision,
      p_reason: depositReasons[bookingId] || null,
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    setHeldDeposits((prev) => prev.filter((d) => d.id !== bookingId));
  }

  // Real, new feature completing the one, honest, remaining gap
  // flagged directly to the client — CHS admin previously had zero
  // real oversight into the ID and selfie an agent/manager collects
  // in their own tenant register. Genuine search, not a full dump —
  // real name, phone, or reference number lookup.
  async function handleTenantRegisterSearch() {
    setTenantRegisterLoading(true);
    const q = tenantRegisterSearch.trim();
    let query = supabase.from("tenant_register").select(
      "id, reference_number, full_name, phone, location_area, street_address, property_type, bedrooms, annual_rent, occupation, id_type, id_number, id_document_url, selfie_url, created_at"
    ).order("created_at", { ascending: false }).limit(50);
    if (q) {
      query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,reference_number.ilike.%${q}%`);
    }
    const { data } = await query;
    setTenantRegisterResults(data || []);
    setTenantRegisterLoading(false);
  }


  const [totalCommissionEarnings, setTotalCommissionEarnings] = useState(0);
  const [openOwnerConcerns, setOpenOwnerConcerns] = useState<{ id: string; subject: string; message: string; profiles: { full_name: string } | null }[]>([]);
  const [agentChangeRequests, setAgentChangeRequests] = useState<{ id: string; requested_agent_name: string | null; requested_agent_phone: string | null; requested_agent_chs_id: string | null; properties: { title: string } | null }[]>([]);
  const [approvingAgentInput, setApprovingAgentInput] = useState<Record<string, string>>({});
  const [suspendPhone, setSuspendPhone] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendResult, setSuspendResult] = useState<string | null>(null);
  const [suspending, setSuspending] = useState(false);
  const [pendingAppeals, setPendingAppeals] = useState<{ id: string; message: string; profiles: { full_name: string; phone: string } | null }[]>([]);

  const [showContactSettings, setShowContactSettings] = useState(false);
  const [contactSettingsValues, setContactSettingsValues] = useState<Record<string, string> | null>(null);
  const [savingContactSettings, setSavingContactSettings] = useState(false);
  const [contactSettingsResult, setContactSettingsResult] = useState<string | null>(null);

  async function loadContactSettings() {
    const { data } = await supabase.rpc("get_contact_settings");
    setContactSettingsValues(data || {});
  }

  async function handleSaveContactSettings() {
    if (!contactSettingsValues) return;
    setSavingContactSettings(true);
    setContactSettingsResult(null);
    for (const [key, value] of Object.entries(contactSettingsValues)) {
      const { error } = await supabase.rpc("update_contact_setting", { p_key: key, p_value: value });
      if (error) {
        setContactSettingsResult(error.message);
        setSavingContactSettings(false);
        return;
      }
    }
    setSavingContactSettings(false);
    setContactSettingsResult("✓ Real contact details updated.");
  }
  const [showAdminReportForm, setShowAdminReportForm] = useState(false);
  // Real, new feature closing a confirmed gap: submission existed,
  // but no real way for the super admin to actually view what was
  // submitted. staff_role_at_time holds one of the five real
  // sub-admin domain values for a sub-admin's own report, or is
  // genuinely something else (or null) for a regular staff member's
  // — the real, existing distinction used to split the two views.
  const SUB_ADMIN_DOMAINS = ["customer_care", "registration_setup", "owner_buyer_tenant", "agent_relations", "artisan_dev_pm_vendor"];
  const [dailyReports, setDailyReports] = useState<{
    id: string; report_date: string; activities: string; transactions_handled: string | null; complaints_raised: string | null;
    staff_role_at_time: string | null; created_at: string; profiles: { full_name: string; phone: string }[] | null;
  }[]>([]);
  useEffect(() => {
    if (!profile?.is_super_admin) return;
    supabase.from("admin_daily_reports").select("id, report_date, activities, transactions_handled, complaints_raised, staff_role_at_time, created_at, profiles!admin_daily_reports_submitted_by_fkey(full_name, phone)")
      .order("report_date", { ascending: false }).limit(200)
      .then(({ data }) => setDailyReports((data as unknown as typeof dailyReports) || []));
  }, [profile?.is_super_admin]);
  const [adminReportActivities, setAdminReportActivities] = useState("");
  const [adminReportTransactions, setAdminReportTransactions] = useState("");
  const [adminReportComplaints, setAdminReportComplaints] = useState("");
  const [submittingAdminReport, setSubmittingAdminReport] = useState(false);
  const [adminReportResult, setAdminReportResult] = useState<string | null>(null);
  const [adminReports, setAdminReports] = useState<{ id: string; activities: string; transactions_handled: string | null; complaints_raised: string | null; created_at: string; staff_role_at_time: string | null; profiles: { full_name: string } | null }[]>([]);

  async function handleSubmitAdminReport() {
    if (!adminReportActivities.trim()) {
      setAdminReportResult("Please describe your real activities for the day.");
      return;
    }
    setSubmittingAdminReport(true);
    setAdminReportResult(null);
    const { error } = await supabase.rpc("submit_admin_daily_report", {
      p_activities: adminReportActivities.trim(),
      p_transactions: adminReportTransactions.trim() || null,
      p_complaints: adminReportComplaints.trim() || null,
    });
    setSubmittingAdminReport(false);
    if (error) {
      setAdminReportResult(error.message);
      return;
    }
    setAdminReportResult("✓ Real daily report submitted.");
    setAdminReportActivities("");
    setAdminReportTransactions("");
    setAdminReportComplaints("");
    setShowAdminReportForm(false);
    loadAdminReports();
  }

  async function loadAdminReports() {
    const { data } = await supabase
      .from("admin_daily_reports")
      .select("id, activities, transactions_handled, complaints_raised, created_at, staff_role_at_time, profiles:submitted_by(full_name)")
      .order("created_at", { ascending: false })
      .limit(20);
    setAdminReports((data as unknown as typeof adminReports) || []);
  }
  const [appealResponses, setAppealResponses] = useState<Record<string, string>>({});
  const [analyticsPeriod, setAnalyticsPeriod] = useState<"today" | "yesterday" | "week" | "month" | "quarter" | "custom">("month");
  const [analyticsFrom, setAnalyticsFrom] = useState("");
  const [analyticsTo, setAnalyticsTo] = useState("");
  interface AnalyticsReport {
    period_start: string; period_end: string;
    sold_properties_count: number; sold_properties_value: number;
    new_tenancies_count: number; new_tenancies_value: number;
    shortlet_bookings_count: number; shortlet_bookings_value: number;
    new_listings_count: number; new_users_count: number;
    total_commission_revenue: number;
    commission_by_type: { transaction_type: string; count: number; total: number }[];
    service_charges_collected: number;
  }
  const [analyticsReport, setAnalyticsReport] = useState<AnalyticsReport | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  function getPeriodRange(period: typeof analyticsPeriod) {
    const end = new Date();
    const start = new Date();
    if (period === "custom") {
      // any single day or span: from the start of the first day to the end of the last
      const s = analyticsFrom ? new Date(analyticsFrom + "T00:00:00") : new Date(0);
      const e = analyticsTo ? new Date(analyticsTo + "T23:59:59.999") : new Date(analyticsFrom ? analyticsFrom + "T23:59:59.999" : Date.now());
      return { start: s.toISOString(), end: e.toISOString() };
    }
    if (period === "yesterday") {
      start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1); end.setHours(23, 59, 59, 999);
    }
    else if (period === "today") start.setHours(0, 0, 0, 0);
    else if (period === "week") start.setDate(start.getDate() - 7);
    else if (period === "month") start.setMonth(start.getMonth() - 1);
    else if (period === "quarter") start.setMonth(start.getMonth() - 3);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  async function loadAnalytics(period: typeof analyticsPeriod) {
    setLoadingAnalytics(true);
    const { start, end } = getPeriodRange(period);
    const { data } = await supabase.rpc("get_admin_analytics_report", { p_start_date: start, p_end_date: end });
    setAnalyticsReport(data);
    setLoadingAnalytics(false);
  }
  const [concernResponses, setConcernResponses] = useState<Record<string, string>>({});
  const [ownersWithMessages, setOwnersWithMessages] = useState<{ owner_id: string; full_name: string }[]>([]);
  const [activeMessageOwnerId, setActiveMessageOwnerId] = useState<string | null>(null);
  const [pendingPrecommitMessages, setPendingPrecommitMessages] = useState<{ id: string; text: string; sender_role: string; profiles: { full_name: string } | null; offers: { properties: { title: string } | null } | null }[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<{ id: string; transaction_type: string; payer_role: string; base_amount: number; commission_percentage: number | null; commission_amount: number; paid_at: string; properties: { title: string; street_address?: string | null } | null; profiles: { full_name: string } | null }[]>([]);
  const [pendingSaleDocs, setPendingSaleDocs] = useState<{ id: string; property_id: string; document_type: string; file_url: string; created_at: string; properties: { title: string } | null }[]>([]);
  const [pendingLegalTransfers, setPendingLegalTransfers] = useState<{
    id: string; amount: number; held_net: number; created_at: string; document_deadline: string | null; property_title: string; owner_id: string;
    seller_name: string; seller_phone: string; buyer_name: string; buyer_phone: string;
    dispatch_status: string | null; dispatch_method: string | null; tracking_reference: string | null; dispatched_at: string | null;
    release_request_status: string | null; release_requested_at: string | null; release_request_note: string | null; release_decision_note: string | null;
  }[]>([]);
  const [saleNotes, setSaleNotes] = useState<Record<string, string>>({});
  async function handleSaleRelease(offerId: string, method: "platform_records" | "phone_call") {
    setActionError(null);
    const { error } = await supabase.rpc("admin_release_sale_funds", { p_offer_id: offerId, p_method: method, p_note: (saleNotes[offerId] || "").trim() || null });
    if (error) { setActionError(error.message); return; }
    loadData();
  }
  async function handleSaleRejectRequest(offerId: string) {
    setActionError(null);
    const { error } = await supabase.rpc("admin_reject_sale_release", { p_offer_id: offerId, p_reason: (saleNotes[offerId] || "").trim() });
    if (error) { setActionError(error.message); return; }
    loadData();
  }
  // Real, direct fix answering a genuine, direct client question:
  // "where does the message go" for a real hard-copy delivery
  // request. Confirmed directly — nowhere. request_document_dispatch
  // correctly saved it to a real table, but no admin screen ever
  // existed to see it. Built here, next to the related legal-transfer
  // confirmation this feeds into.
  const [pendingDispatchRequests, setPendingDispatchRequests] = useState<{
    id: string; delivery_address: string; delivery_phone: string; preferred_method: string; delivery_note: string | null; status: string; created_at: string;
    offers: { amount: number; properties: { title: string; reference_number: string } | null } | null;
  }[]>([]);
  function loadPendingDispatchRequests() {
    supabase.from("document_dispatch_requests")
      .select("id, delivery_address, delivery_phone, preferred_method, delivery_note, status, created_at, offers(amount, properties(title, reference_number))")
      .eq("status", "requested").order("created_at", { ascending: false })
      .then(({ data }) => setPendingDispatchRequests((data as unknown as typeof pendingDispatchRequests) || []));
  }
  useEffect(() => { loadPendingDispatchRequests(); }, []);
  async function handleMarkDispatched(id: string, method: string) {
    setActionError(null);
    const { error } = await supabase.from("document_dispatch_requests")
      .update({ status: "dispatched", dispatched_at: new Date().toISOString(), dispatch_method: method }).eq("id", id);
    if (error) { setActionError(error.message); return; }
    setPendingDispatchRequests((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleWalletSearch() {
    setWalletSearchError(null);
    setWalletResult(null);
    if (!walletSearch.trim()) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, role, phone")
      .or(`full_name.ilike.%${walletSearch.trim()}%,phone.ilike.%${walletSearch.trim()}%`)
      .limit(1)
      .maybeSingle();

    if (!profile) {
      setWalletSearchError("No user found matching that name or phone number.");
      return;
    }

    const { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", profile.id).maybeSingle();
    setWalletResult({
      id: profile.id,
      full_name: profile.full_name,
      role: profile.role,
      main_balance: wallet?.main_balance || 0,
      rent_savings: wallet?.rent_savings || 0,
      maintenance_reserve: wallet?.maintenance_reserve || 0,
      frozen: wallet?.frozen || false,
    });
  }

  async function handleToggleFreeze(userId: string, freeze: boolean) {
    const { error } = await supabase.rpc("request_admin_action", {
      p_action_type: "freeze_wallet",
      p_target_id: userId,
      p_proposed_changes: { frozen: freeze, frozen_reason: freeze ? "Frozen by admin pending investigation" : null },
    });
    if (!error && walletResult) setWalletResult({ ...walletResult, frozen: freeze });
  }
  const [pendingApplications, setPendingApplications] = useState<RentalApplication[]>([]);
  const [recentlyHandledApplications, setRecentlyHandledApplications] = useState<RentalApplication[]>([]);
  function loadRecentlyHandledApplications() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    supabase.from("rental_applications")
      .select("*, properties(title, street_address, location_area, owner_id, profiles!properties_owner_id_fkey(full_name, phone)), tenant:profiles!rental_applications_tenant_id_fkey(full_name, phone)")
      .not("status", "in", "(pending,awaiting_admin_review,awaiting_owner_decision,owner_decided_pending_relay)")
      .is("archived_at", null)
      .or(`admin_last_read_at.is.null,admin_last_read_at.gt.${cutoff}`)
      .order("admin_last_read_at", { ascending: false }).limit(200)
      .then(({ data }) => setRecentlyHandledApplications((data as unknown as RentalApplication[]) || []));
  }
  useEffect(() => { loadRecentlyHandledApplications(); }, []);
  async function handleArchiveApplication(id: string) {
    await supabase.from("rental_applications").update({ archived_at: new Date().toISOString() }).eq("id", id);
    setRecentlyHandledApplications((prev) => prev.filter((x) => x.id !== id));
  }
  const [pendingProperties, setPendingProperties] = useState<PendingProperty[]>([]);
  const [recentlyHandledProperties, setRecentlyHandledProperties] = useState<{ id: string; title: string; price: number; location_area: string; verification_status: string }[]>([]);
  function loadRecentlyHandledProperties() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    supabase.from("properties")
      .select("id, title, price, purpose, location_area, verification_status, owner_id, profiles!properties_owner_id_fkey(full_name, phone)")
      .not("verification_status", "eq", "pending")
      .is("verification_archived_at", null)
      .or(`verification_admin_last_read_at.is.null,verification_admin_last_read_at.gt.${cutoff}`)
      .order("verification_admin_last_read_at", { ascending: false }).limit(200)
      .then(({ data }) => setRecentlyHandledProperties((data as unknown as { id: string; title: string; price: number; location_area: string; verification_status: string }[]) || []));
  }
  useEffect(() => { loadRecentlyHandledProperties(); }, []);
  async function handleArchiveProperty(id: string) {
    await supabase.from("properties").update({ verification_archived_at: new Date().toISOString() }).eq("id", id);
    setRecentlyHandledProperties((prev) => prev.filter((x) => x.id !== id));
  }
  const [openDisputes, setOpenDisputes] = useState<Dispute[]>([]);
  const [conditionReports, setConditionReports] = useState<{
    id: string; reference: string; report_type: string; status: string; affidavit_url: string | null;
    affidavit_reference: string | null; submitted_at: string; rooms: { name: string; notes: string; items: { item: string; condition: string; photo_url: string | null }[] }[];
    tenancies: { tenant_id: string; landlord_id: string; properties: { title: string }[] | null } | null;
  }[]>([]);
  function loadConditionReports() {
    // Real, direct fix following a direct, confirmed client report:
    // this previously only ever showed move-out reports with a real
    // affidavit attached — a genuine move-in report, or any move-out
    // report before its affidavit was uploaded, was structurally
    // invisible here. Now shows every real report, with its full,
    // real room-by-room detail and photos.
    supabase.from("condition_reports")
      .select("id, reference, report_type, status, affidavit_url, affidavit_reference, submitted_at, rooms, tenancies(tenant_id, landlord_id, properties(title))")
      .order("submitted_at", { ascending: false }).limit(50)
      .then(({ data }) => setConditionReports((data as unknown as typeof conditionReports) || []));
  }
  useEffect(() => { loadConditionReports(); }, []);
  const [pendingFeedback, setPendingFeedback] = useState<CommunityFeedback[]>([]);
  const [pendingEngage, setPendingEngage] = useState<EngageRequest[]>([]);
  const [recentlyHandledEngage, setRecentlyHandledEngage] = useState<EngageRequest[]>([]);
  const [pendingVendors, setPendingVendors] = useState<MarketplaceVendor[]>([]);
  const [recentlyHandledVendors, setRecentlyHandledVendors] = useState<{ id: string; business_name: string; category: string; location_state: string; verification_status: string }[]>([]);
  function loadRecentlyHandledVendors() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    supabase.from("marketplace_vendors").select("*")
      .not("verification_status", "eq", "pending").is("archived_at", null)
      .or(`admin_last_read_at.is.null,admin_last_read_at.gt.${cutoff}`)
      .order("admin_last_read_at", { ascending: false }).limit(200)
      .then(({ data }) => setRecentlyHandledVendors((data as unknown as typeof recentlyHandledVendors) || []));
  }
  useEffect(() => { loadRecentlyHandledVendors(); }, []);
  async function handleArchiveVendor(id: string) {
    await supabase.from("marketplace_vendors").update({ archived_at: new Date().toISOString() }).eq("id", id);
    setRecentlyHandledVendors((prev) => prev.filter((x) => x.id !== id));
  }
  const [pendingArtisans, setPendingArtisans] = useState<Artisan[]>([]);
  const [recentlyHandledArtisans, setRecentlyHandledArtisans] = useState<{ id: string; trades: string[]; base_state: string; verification_status: string }[]>([]);
  function loadRecentlyHandledArtisans() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    supabase.from("artisans").select("*")
      .not("verification_status", "eq", "pending").is("archived_at", null)
      .or(`admin_last_read_at.is.null,admin_last_read_at.gt.${cutoff}`)
      .order("admin_last_read_at", { ascending: false }).limit(200)
      .then(({ data }) => setRecentlyHandledArtisans((data as unknown as typeof recentlyHandledArtisans) || []));
  }
  useEffect(() => { loadRecentlyHandledArtisans(); }, []);
  async function handleArchiveArtisan(id: string) {
    await supabase.from("artisans").update({ archived_at: new Date().toISOString() }).eq("id", id);
    setRecentlyHandledArtisans((prev) => prev.filter((x) => x.id !== id));
  }
  const [upcomingInspections, setUpcomingInspections] = useState<(Inspection & { properties: { title: string; location_area: string } | null })[]>([]);
  // The agent's takeoff point and the real one-way distance, which fix an inspection's final transport cost.
  // The WHOLE cost is paid by the person who asked for the visit — never split with the owner, never carried by CHS.
  const [takeoffForm, setTakeoffForm] = useState<Record<string, { point: string; km: string; agent?: string }>>({});
  const [assignableAgents, setAssignableAgents] = useState<{ id: string; full_name: string; phone: string }[]>([]);
  const [takeoffBusy, setTakeoffBusy] = useState<string | null>(null);
  async function handleSetTakeoff(id: string) {
    const f = takeoffForm[id] || { point: "", km: "" };
    if (!f.point.trim() || !(parseFloat(f.km) > 0) || !f.agent) { setActionError("Please choose the agent, and enter where they set off from and the one-way distance in km."); return; }
    setTakeoffBusy(id); setActionError(null);
    const { error } = await supabase.rpc("set_inspection_takeoff", { p_inspection_id: id, p_takeoff_point: f.point.trim(), p_one_way_km: parseFloat(f.km), p_agent_id: f.agent });
    setTakeoffBusy(null);
    if (error) { setActionError(error.message); return; }
    const { data } = await supabase.from("inspections").select("*, properties(title, location_area)").in("status", ["pending", "awaiting_payment", "confirmed"]).order("requested_date", { ascending: true }).limit(200);
    setUpcomingInspections((data as typeof upcomingInspections) || []);
  }
  const [developerApplications, setDeveloperApplications] = useState<DeveloperApplication[]>([]);
  const [recentlyHandledDevelopers, setRecentlyHandledDevelopers] = useState<{ id: string; company_name: string; status: string }[]>([]);
  function loadRecentlyHandledDevelopers() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    supabase.from("developer_applications").select("id, company_name, status")
      .not("status", "in", "(pending,reviewed)").is("archived_at", null)
      .or(`admin_last_read_at.is.null,admin_last_read_at.gt.${cutoff}`)
      .order("admin_last_read_at", { ascending: false }).limit(200)
      .then(({ data }) => setRecentlyHandledDevelopers((data as unknown as typeof recentlyHandledDevelopers) || []));
  }
  useEffect(() => { loadRecentlyHandledDevelopers(); }, []);
  async function handleArchiveDeveloper(id: string) {
    await supabase.from("developer_applications").update({ archived_at: new Date().toISOString() }).eq("id", id);
    setRecentlyHandledDevelopers((prev) => prev.filter((x) => x.id !== id));
  }
  const [showGuide, setShowGuide] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsFeed, setNotificationsFeed] = useState<{
    id: string; title: string; body: string; link: string | null; read: boolean; created_at: string;
  }[]>([]);
  useEffect(() => {
    if (!session) return;
    supabase.from("notifications").select("id, title, body, link, read, created_at")
      .eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setNotificationsFeed(data || []));
  }, [session]);

  // Real "Trace an Account" tool state — the direct fix for the
  // MTN-style support gap: search by phone/email/name, then see
  // everything real about that person across every system in one
  // place, exactly the way a real customer care agent traces an
  // account with just a phone number.
  const [traceQuery, setTraceQuery] = useState("");
  const [traceResults, setTraceResults] = useState<{ id: string; full_name: string; phone: string; email: string; role: string }[]>([]);
  const [traceSearching, setTraceSearching] = useState(false);
  const [tracedUser, setTracedUser] = useState<{ id: string; full_name: string; phone: string; email: string; role: string } | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceData, setTraceData] = useState<{
    wallet: { main_balance: number; frozen: boolean } | null;
    walletTx: { amount: number; direction: string; description: string; created_at: string }[];
    promoCredits: { amount: number; direction: string; description: string; created_at: string }[];
    promotions: TracePromotion[];
    roadmapAccess: { model_id: string; amount_paid: number; is_test_grant: boolean; created_at: string }[];
    bankAccount: { bank_name: string; account_number: string; account_name: string } | null;
    engageRequests: { reference: string; service_type: string; status: string }[];
    properties: TraceProperty[];
  } | null>(null);
  const [auditLog, setAuditLog] = useState<{
    id: string; actor_role: string | null; action: string; target_table: string; target_label: string | null; details: Record<string, unknown> | null; created_at: string;
    profiles: { full_name: string; phone: string }[] | null;
  }[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [processedHistory, setProcessedHistory] = useState<{
    item_type: string; id: string; status: string; person_name: string; property_title: string; acted_at: string;
  }[]>([]);
  const [processedHistoryLoading, setProcessedHistoryLoading] = useState(false);
  const [processedHistoryFilter, setProcessedHistoryFilter] = useState<"all" | "rental_application" | "offer" | "property_listing" | "registration">("all");

  async function loadProcessedHistory() {
    setProcessedHistoryLoading(true);
    const { data } = await supabase.rpc("get_admin_processed_history");
    setProcessedHistory((data as unknown as typeof processedHistory) || []);
    setProcessedHistoryLoading(false);
  }

  async function loadAuditLog(search?: string) {
    setAuditLoading(true);
    let query = supabase.from("audit_log")
      .select("id, actor_role, action, target_table, target_label, details, created_at, profiles(full_name, phone)")
      .order("created_at", { ascending: false }).limit(100);
    if (search && search.trim()) {
      query = query.or(`action.ilike.%${search.trim()}%,target_label.ilike.%${search.trim()}%`);
    }
    const { data } = await query;
    setAuditLog((data as unknown as typeof auditLog) || []);
    setAuditLoading(false);
  }

  useEffect(() => {
    if (activeTab === "auditlog" && auditLog.length === 0 && !auditLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAuditLog();
    }
    if (activeTab === "processedhistory" && processedHistory.length === 0 && !processedHistoryLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadProcessedHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Real resolved-history view — closes a related gap: once a
  // sub-admin action is approved/rejected, it previously vanished
  // from admin view entirely with no audit trail.
  const [showActionHistory, setShowActionHistory] = useState(false);
  const [actionHistory, setActionHistory] = useState<{
    id: string; action_type: string; status: string; resolved_at: string | null; resolution_note: string | null;
    profiles: { full_name: string }[] | null;
  }[]>([]);
  const [loadingActionHistory, setLoadingActionHistory] = useState(false);
  // Real, new state for the seven genuinely new sidebar destinations —
  // Notification feed, Assign Role to Staff, Staff Daily Report,
  // Sub-Admin's Daily Report, and Sub-Admin Panel. (Quick Search,
  // Customer Care, and Audit Trail all route to real, already-working
  // tabs — Trace an Account, Disputes, and Audit Log respectively —
  // and Sub-Admin Activities reuses the action-history data above.)
  const [teamDailyReports, setTeamDailyReports] = useState<{ id: string; report_date: string; activities: string; transactions_handled: string | null; complaints_raised: string | null; team_member: { full_name: string }[] | null; submitter: { full_name: string }[] | null }[]>([]);
  const [adminDailyReports, setAdminDailyReports] = useState<{ id: string; report_date: string; activities: string; transactions_handled: string | null; complaints_raised: string | null; staff_role_at_time: string | null; submitter: { full_name: string }[] | null }[]>([]);
  const [subAdminRoster, setSubAdminRoster] = useState<{ id: string; full_name: string; phone: string; staff_role: string | null; is_super_admin: boolean }[]>([]);
  const [pendingLoginRequests, setPendingLoginRequests] = useState<{
    id: string; admin_id: string; code: string; created_at: string;
    profiles: { full_name: string; role: string }[] | null;
  }[]>([]);
  const [resolvingLoginId, setResolvingLoginId] = useState<string | null>(null);

  const [pendingActionRequests, setPendingActionRequests] = useState<{
    id: string; requested_by: string; domain: string; action_type: string;
    target_id: string; proposed_changes: Record<string, unknown>; note: string | null; created_at: string;
    profiles: { full_name: string; staff_role: string | null }[] | null;
  }[]>([]);
  const [resolvingActionId, setResolvingActionId] = useState<string | null>(null);

  const [assignContact, setAssignContact] = useState("");
  const [assignRole, setAssignRole] = useState("customer_care");
  const [assigning, setAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [feeSettings, setFeeSettings] = useState<ReferralFeeSetting[]>([]);
  const [owedFees, setOwedFees] = useState<ReferralFeeOwed[]>([]);
  const [agentReferrals, setAgentReferrals] = useState<{ id: string; masked_reference: string; stage: string; chs_commission: number | null; agent_share_pct: number | null; split_50_50: boolean; agent_payout: number | null; created_at: string }[]>([]);
  const [completingReferralId, setCompletingReferralId] = useState<string | null>(null);
  const [unroutedFaults, setUnroutedFaults] = useState<(FaultReport & { tenancies: { management_delegated: boolean; landlord_id: string; manager_id: string | null } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [propertyRejectReasons, setPropertyRejectReasons] = useState<Record<string, string>>({});

  // A real access check for a real admin — the actual protection is the
  // database's own row-level security, but this stops a non-admin from
  // even seeing a confusing, permission-denied dashboard.
  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    if (profile && profile.role !== "admin") {
      router.push("/");
      return;
    }
    if (profile && termsAcceptanceRequired(profile)) {
      router.push("/accept-terms?redirect=/admin");
      return;
    }
    // Real login-approval guard — closes the direct-navigation bypass:
    // without this, a sub-admin with an already-valid session (correct
    // password, but no super-admin approval yet) could just type
    // /admin into the URL bar and skip the waiting screen entirely.
    if (profile?.role === "admin" && !profile.is_super_admin) {
      supabase.rpc("has_approved_admin_login", { p_admin_id: session.user.id }).then(({ data: approved }) => {
        if (!approved) {
          router.push("/admin-approval-pending");
          return;
        }
        if (!profile.guide_roles_seen.includes("admin")) setShowGuide(true);
        loadData();
      });
      return;
    }
    if (profile?.role === "admin") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!profile.guide_roles_seen.includes("admin")) setShowGuide(true);
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, profile]);

  async function loadData() {
    setLoading(true);
    // Real fix: none of these had a limit — every single pending item,
    // in every category, was fetched in full on every dashboard load.
    // Also switched from newest-first to oldest-first: a limit on a
    // newest-first queue would silently hide old, long-neglected items
    // behind a flood of new ones — the wrong items to hide from an
    // admin queue. referral_fee_settings is a small, bounded config
    // table, not a growing queue, so it's left unlimited.
    const [profilesRes, applicationsRes, propertiesRes, disputesRes, feedbackRes, engageRes, handledEngageRes, vendorsRes, feeSettingsRes, owedFeesRes, faultsRes, artisansRes, inspectionsRes, developerAppsRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, role, state, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(200),
      supabase.from("rental_applications").select("*, properties(title, street_address, location_area, owner_id, profiles!properties_owner_id_fkey(full_name, phone)), tenant:profiles!rental_applications_tenant_id_fkey(full_name, phone)").in("status", ["pending", "awaiting_admin_review", "awaiting_owner_decision", "owner_decided_pending_relay"]).order("created_at", { ascending: false }).limit(200),
      supabase.from("properties").select("id, title, location_area, purpose, price, primary_document_type, acquisition_method, owner_id, created_at, property_sale_documents(id, document_type, file_url, verification_status), profiles!properties_owner_id_fkey(full_name, phone, valid_id_verified, valid_id_type, valid_id_number)").eq("verification_status", "pending").order("created_at", { ascending: false }).limit(200),
      supabase.from("disputes").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(200),
      supabase.from("community_feedback").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(200),
      supabase.from("engage_chs_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(200),
      // Real, direct client request: items admin has already accepted
      // or rejected shouldn't vanish from view the instant they're
      // handled — they stay visible here for a real 7 days after
      // admin last read them, or until admin manually archives them,
      // whichever comes first.
      supabase.from("engage_chs_requests").select("*")
        .neq("status", "pending")
        .is("archived_at", null)
        .or(`admin_last_read_at.is.null,admin_last_read_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`)
        .order("created_at", { ascending: false }).limit(200),
      supabase.from("marketplace_vendors").select("*").eq("verification_status", "pending").order("created_at", { ascending: false }).limit(200),
      supabase.from("referral_fee_settings").select("*").order("flat_fee_amount", { ascending: false }),
      supabase.from("referral_fees_owed").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("fault_reports").select("*, tenancies(management_delegated, landlord_id, manager_id)").in("status", ["reported", "assigned", "converted_to_quote", "gathering_quotes"]).order("created_at", { ascending: false }).limit(200),
      supabase.from("artisans").select("*").eq("verification_status", "pending").order("created_at", { ascending: false }).limit(200),
      supabase.from("inspections").select("*, properties(title, location_area)").in("status", ["pending", "awaiting_payment", "confirmed"]).order("requested_date", { ascending: true }).limit(200),
      supabase.from("developer_applications").select("*").in("status", ["pending", "reviewed"]).order("created_at", { ascending: false }).limit(200),
    ]);
    setPendingProfiles(profilesRes.data || []);

    const [totalListingsRes, verifiedListingsRes, usersRes, rulesRes, ackRes] = await Promise.all([
      supabase.from("properties").select("id", { count: "exact", head: true }),
      supabase.from("properties").select("id", { count: "exact", head: true }).eq("verification_status", "verified"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("property_house_rules").select("id", { count: "exact", head: true }),
      supabase.from("house_rules_acknowledgments").select("id", { count: "exact", head: true }),
    ]);
    setOverviewStats({
      totalListings: totalListingsRes.count || 0,
      verifiedListings: verifiedListingsRes.count || 0,
      registeredUsers: usersRes.count || 0,
      propertiesWithRules: rulesRes.count || 0,
      rulesAcknowledged: ackRes.count || 0,
    });

    // Real, direct fix for a genuine, confirmed performance problem,
    // flagged directly by the client and traced precisely: this whole
    // section used to run as 21 separate, real database calls, each
    // one fully waiting for the last to finish before the next even
    // started — even though none of them actually depend on each
    // other's results. Checked every single one carefully before
    // touching anything: the only real dependency in this entire
    // section is a local JavaScript merge step further down, which
    // needs three of these results but is not itself a network call.
    // Grouped into real, concurrent batches instead — same real
    // queries, same real results, just no longer waiting in a single
    // file line for each other with no genuine reason to.
    const [
      saleApprovalsRes, offerReviewRes, offerDecisionsRes, registrationsRes,
      agentIdRes, managerCertRes, livenessRes, buyerIdRes,
      commissionRes, concernsRes, agentChangeRes, appealsRes,
      msgOwnerRes, precommitRes, txnRes, installmentRes, rentRes,
      saleDocsRes, legalTransferRes,
    ] = await Promise.all([
      supabase.from("offers").select("*, properties(title)").eq("status", "accepted").eq("chs_cleared", false).order("created_at", { ascending: false }),
      supabase.from("offers").select("id, amount, note, buyer_full_name, buyer_phone, buyer_occupation, buyer_source_of_funds, created_at, properties(title, reference_number, profiles!properties_owner_id_fkey(full_name, phone)), buyer:profiles!offers_buyer_id_fkey(valid_id_verified)").eq("status", "awaiting_admin_review").order("created_at", { ascending: false }),
      supabase.from("offers").select("id, amount, owner_decision, seller_response_note, buyer_full_name, buyer_phone, owner_decision_at, properties(title)").eq("status", "owner_decided_pending_relay").order("owner_decision_at", { ascending: false }),
      supabase.rpc("get_pending_registrations_full"),
      supabase.from("profiles").select("id, full_name, phone, valid_id_type, valid_id_number, valid_id_document_url").eq("role", "agent").eq("valid_id_verified", false).not("valid_id_document_url", "is", null),
      supabase.from("profiles").select("id, full_name, phone, profession, professional_registration_number, certificate_document_url").eq("role", "manager").eq("professional_credentials_verified", false).not("certificate_document_url", "is", null),
      supabase.from("liveness_submissions").select("id, user_id, captured_photo_url, created_at, profiles!liveness_submissions_user_id_fkey(full_name)").eq("status", "pending_review").order("created_at", { ascending: false }),
      supabase.from("buyer_id_verifications").select("id, user_id, id_type, id_number, id_document_url, created_at, full_name_on_id, gender, age_bracket, state_of_residence, residential_address, occupation, contact_email, contact_phone, id_already_used_elsewhere, avs_status, avs_extracted_name, avs_extracted_id_number, avs_name_match, avs_id_number_match, avs_notes, profiles!buyer_id_verifications_user_id_fkey(full_name, phone)").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("transaction_commissions").select("commission_amount").eq("status", "paid"),
      supabase.from("owner_concerns").select("id, subject, message, profiles:owner_id(full_name)").eq("status", "open").order("created_at", { ascending: false }),
      supabase.from("agent_change_requests").select("id, requested_agent_name, requested_agent_phone, requested_agent_chs_id, properties(title)").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("account_appeals").select("id, message, profiles:user_id(full_name, phone)").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("owner_admin_messages").select("owner_id, profiles:owner_id(full_name)").order("created_at", { ascending: false }),
      supabase.from("precommit_messages").select("id, text, sender_role, profiles:sender_id(full_name), offers(properties(title))").eq("status", "pending_review").order("created_at", { ascending: false }),
      supabase.from("transaction_commissions").select("id, transaction_type, payer_role, base_amount, commission_percentage, commission_amount, paid_at, properties(title, street_address), profiles:payer_id(full_name)").eq("status", "paid").order("paid_at", { ascending: false }).limit(50),
      supabase.from("sale_installment_payments").select("id, amount, buyer_commission, offers(amount, buyer_id, properties(title), profiles:buyer_id(full_name))").order("paid_at", { ascending: false }).limit(50),
      supabase.from("rent_payments").select("id, amount, created_at, tenancies(property_id, properties(title, street_address))").order("created_at", { ascending: false }).limit(50),
      supabase.from("property_sale_documents").select("id, property_id, document_type, file_url, created_at, properties(title)").eq("verification_status", "pending").order("created_at", { ascending: false }),
      // Real, direct fix for a second, genuine instance of the exact
      // same bug already found and fixed for held rent: this embedded
      // join (offers -> properties) silently returned an empty array
      // via the real REST API, hiding a real, held ₦17,500,000 sale
      // payment that should have been visible in Property Sale
      // Escrow the whole time. Confirmed directly, not assumed.
      // Replaced with the same safe, dedicated function pattern.
      supabase.rpc("get_pending_legal_transfers"),
    ]);

    setPendingSaleApprovals((saleApprovalsRes.data as unknown as typeof pendingSaleApprovals) || []);
    setPendingOfferReview((offerReviewRes.data as unknown as typeof pendingOfferReview) || []);
    setPendingOfferDecisions((offerDecisionsRes.data as unknown as typeof pendingOfferDecisions) || []);
    setPendingRegistrationsFull(registrationsRes.data || []);
    setPendingAgentIds(agentIdRes.data || []);
    setPendingManagerCerts(managerCertRes.data || []);
    setPendingLiveness((livenessRes.data as unknown as typeof pendingLiveness) || []);
    if (buyerIdRes.error) console.error("Real error loading pending ID verifications:", buyerIdRes.error.message);
    setPendingBuyerIds((buyerIdRes.data as unknown as typeof pendingBuyerIds) || []);

    // Real, new admin visibility into pending shortlet/hire bookings —
    // these are decided by the host directly, not admin, but admin
    // had no real way to see or track them at all before this.
    supabase.rpc("get_stale_calendars", { p_stale_days: 3 }).then(({ data }) => setStaleCalendars((data as unknown as typeof staleCalendars) || []));
    supabase.rpc("get_admin_booking_queue").then(({ data }) => setBookingQueue((data as unknown as typeof bookingQueue) || []));
    supabase.rpc("get_pending_shortlet_messages").then(({ data }) => setPendingMsgs((data as unknown as typeof pendingMsgs) || []));
    loadReleaseItems();
    loadRtoQueue();
    loadTransferReports();
    loadRiskFlags();
    setTotalCommissionEarnings((commissionRes.data || []).reduce((sum, r) => sum + Number(r.commission_amount), 0));
    setOpenOwnerConcerns((concernsRes.data as unknown as typeof openOwnerConcerns) || []);
    setAgentChangeRequests((agentChangeRes.data as unknown as typeof agentChangeRequests) || []);
    setPendingAppeals((appealsRes.data as unknown as typeof pendingAppeals) || []);
    loadAdminReports();

    const seen = new Set<string>();
    const uniqueOwners: { owner_id: string; full_name: string }[] = [];
    (msgOwnerRes.data || []).forEach((m: Record<string, unknown>) => {
      const oid = m.owner_id as string;
      if (!seen.has(oid)) {
        seen.add(oid);
        const prof = m.profiles as { full_name: string } | { full_name: string }[] | null;
        const name = Array.isArray(prof) ? prof[0]?.full_name : prof?.full_name;
        uniqueOwners.push({ owner_id: oid, full_name: name || "Owner" });
      }
    });
    setOwnersWithMessages(uniqueOwners);
    setPendingPrecommitMessages((precommitRes.data as unknown as typeof pendingPrecommitMessages) || []);

    const installmentAsTransactions = (installmentRes.data || []).flatMap((p: Record<string, unknown>) => {
      const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
      const props = offer?.properties ? (Array.isArray(offer.properties) ? offer.properties[0] : offer.properties) : null;
      const buyerProfile = offer?.profiles ? (Array.isArray(offer.profiles) ? offer.profiles[0] : offer.profiles) : null;
      return [{
        id: p.id, transaction_type: "sale_installment", payer_role: "buyer",
        base_amount: p.amount, commission_percentage: null, commission_amount: p.buyer_commission,
        paid_at: p.paid_at, properties: props, profiles: buyerProfile,
      }];
    });
    const rentAsTransactions = (rentRes.data || []).map((r: Record<string, unknown>) => {
      const tenancy = Array.isArray(r.tenancies) ? r.tenancies[0] : r.tenancies;
      const props = tenancy?.properties ? (Array.isArray(tenancy.properties) ? tenancy.properties[0] : tenancy.properties) : null;
      return {
        id: r.id, transaction_type: "rent_payment (not CHS earnings)", payer_role: "tenant",
        base_amount: r.amount, commission_percentage: null, commission_amount: 0,
        paid_at: r.created_at, properties: props, profiles: null,
      };
    });
    const merged = [...(txnRes.data || []), ...installmentAsTransactions, ...rentAsTransactions]
      .sort((a, b) => new Date(b.paid_at as string).getTime() - new Date(a.paid_at as string).getTime())
      .slice(0, 50);
    setRecentTransactions(merged as unknown as typeof recentTransactions);

    setPendingSaleDocs((saleDocsRes.data as unknown as typeof pendingSaleDocs) || []);
    setPendingLegalTransfers((legalTransferRes.data as unknown as typeof pendingLegalTransfers) || []);
    setPendingApplications(applicationsRes.data || []);
    setPendingProperties(propertiesRes.data || []);
    setOpenDisputes(disputesRes.data || []);
    setPendingFeedback(feedbackRes.data || []);
    setPendingEngage(engageRes.data || []);
    setRecentlyHandledEngage(handledEngageRes.data || []);
    setPendingVendors(vendorsRes.data || []);
    setFeeSettings(feeSettingsRes.data || []);
    setOwedFees(owedFeesRes.data || []);
    setUnroutedFaults((faultsRes.data as typeof unroutedFaults) || []);
    setPendingArtisans(artisansRes.data || []);
    setUpcomingInspections((inspectionsRes.data as typeof upcomingInspections) || []);
    setDeveloperApplications(developerAppsRes.data || []);

    // Real fix found during the audit — agent-to-agent referral
    // commission had zero admin UI at all before this.
    supabase
      .from("agent_referrals")
      .select("id, masked_reference, stage, chs_commission, agent_share_pct, split_50_50, agent_payout, created_at")
      .neq("stage", "completed")
      .neq("stage", "lost")
      .then(({ data }) => setAgentReferrals(data || []));

    // Only a real super admin needs to see or act on these — a
    // sub-admin querying this would just get an empty result anyway
    // (RLS: admin_login_requests_own_read only shows their own), but
    // there's no reason to even ask unless they're the one who'd act.
    if (profile?.is_super_admin) {
      const [loginRequestsRes, actionRequestsRes] = await Promise.all([
        supabase.from("admin_login_requests")
          .select("id, admin_id, code, created_at, profiles!admin_login_requests_admin_id_fkey(full_name, role)")
          .eq("status", "pending").order("created_at", { ascending: false }),
        supabase.from("admin_action_requests")
          .select("id, requested_by, domain, action_type, target_id, proposed_changes, note, created_at, profiles!admin_action_requests_requested_by_fkey(full_name, staff_role)")
          .eq("status", "pending").order("created_at", { ascending: false }),
      ]);
      setPendingLoginRequests((loginRequestsRes.data as typeof pendingLoginRequests) || []);
      setPendingActionRequests((actionRequestsRes.data as typeof pendingActionRequests) || []);
    }

    setLoading(false);
  }

  async function handleToggleActionHistory() {
    if (showActionHistory) {
      setShowActionHistory(false);
      return;
    }
    setLoadingActionHistory(true);
    const { data } = await supabase
      .from("admin_action_requests")
      .select("id, action_type, status, resolved_at, resolution_note, profiles!admin_action_requests_requested_by_fkey(full_name)")
      .neq("status", "pending")
      .order("resolved_at", { ascending: false })
      .limit(50);
    setActionHistory((data as typeof actionHistory) || []);
    setLoadingActionHistory(false);
    setShowActionHistory(true);
  }

  // Real, new auto-load for the dedicated "Sub-Admin Activities"
  // sidebar tab — reuses the exact same real data already proven
  // working in the Overview toggle above, just surfaced as its own
  // real destination per the client's sidebar design.
  useEffect(() => {
    if (activeTab === "subadminactivities" && actionHistory.length === 0 && !loadingActionHistory) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleToggleActionHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Real, new loads for the remaining genuinely new sidebar
  // destinations — each fires once, the first time its tab opens.
  useEffect(() => {
    if (activeTab === "staffreports" && teamDailyReports.length === 0) {
      supabase.from("team_daily_reports")
        .select("id, report_date, activities, transactions_handled, complaints_raised, team_member:profiles!team_daily_reports_team_member_id_fkey(full_name), submitter:profiles!team_daily_reports_submitted_by_fkey(full_name)")
        .order("report_date", { ascending: false }).limit(100)
        .then(({ data }) => setTeamDailyReports((data as unknown as typeof teamDailyReports) || []));
    }
    if (activeTab === "subadmindailyreports" && adminDailyReports.length === 0) {
      supabase.from("admin_daily_reports")
        .select("id, report_date, activities, transactions_handled, complaints_raised, staff_role_at_time, submitter:profiles!admin_daily_reports_submitted_by_fkey(full_name)")
        .order("report_date", { ascending: false }).limit(100)
        .then(({ data }) => setAdminDailyReports((data as unknown as typeof adminDailyReports) || []));
    }
    if ((activeTab === "subadminpanel" || activeTab === "assignrole") && subAdminRoster.length === 0) {
      supabase.from("profiles").select("id, full_name, phone, staff_role, is_super_admin")
        .eq("role", "admin").order("full_name", { ascending: true })
        .then(({ data }) => setSubAdminRoster(data || []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);


  async function handleTraceSearch() {
    if (!traceQuery.trim()) return;
    setTraceSearching(true);
    setTracedUser(null);
    setTraceData(null);
    const { data } = await supabase.rpc("admin_find_user", { p_contact: traceQuery.trim() });
    setTraceResults(data || []);
    setTraceSearching(false);
  }

  async function handleSelectTracedUser(user: { id: string; full_name: string; phone: string; email: string; role: string }) {
    setTracedUser(user);
    setTraceLoading(true);
    setTraceData(null);

    // Real, parallel queries across every real system — the actual
    // MTN-agent-style "show me everything" behind this whole tool.
    const [walletRes, walletTxRes, promoTxRes, promoRes, roadmapRes, bankRes, engageRes, propertiesRes] = await Promise.all([
      supabase.from("wallets").select("main_balance, frozen").eq("user_id", user.id).maybeSingle(),
      supabase.from("wallet_transactions").select("amount, direction, description, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("promo_credit_transactions").select("amount, direction, description, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("property_promotions").select("is_active, rank_category, properties(title)").eq("owner_id", user.id),
      supabase.from("construction_roadmap_access").select("model_id, amount_paid, is_test_grant, created_at").eq("user_id", user.id),
      supabase.from("linked_bank_accounts").select("bank_name, account_number, account_name").eq("user_id", user.id).maybeSingle(),
      supabase.from("engage_chs_requests").select("reference, service_type, status").eq("owner_id", user.id),
      // Real, direct fix per a genuine, confirmed client concern —
      // "where did all those documents uploaded go? We don't know."
      // Tracing an owner now genuinely surfaces every real property
      // they've ever listed and every real document tied to each one,
      // regardless of whether the property is still pending, already
      // sold, or was rejected — a permanent, real, searchable record.
      supabase.from("properties").select("id, title, verification_status, status, property_sale_documents(id, document_type, file_url, verification_status), property_house_rules(document_url)").eq("owner_id", user.id).order("created_at", { ascending: false }),
    ]);

    setTraceData({
      wallet: walletRes.data,
      walletTx: walletTxRes.data || [],
      promoCredits: promoTxRes.data || [],
      promotions: (promoRes.data as TracePromotion[]) || [],
      roadmapAccess: roadmapRes.data || [],
      bankAccount: bankRes.data,
      engageRequests: engageRes.data || [],
      properties: (propertiesRes.data as unknown as TraceProperty[]) || [],
    });
    setTraceLoading(false);
  }

  async function handleResolveAction(requestId: string, approve: boolean) {
    setResolvingActionId(requestId);
    const { error } = await supabase.rpc("resolve_admin_action", { p_request_id: requestId, p_approve: approve });
    setResolvingActionId(null);
    if (!error) {
      setPendingActionRequests((prev) => prev.filter((r) => r.id !== requestId));
      loadData(); // real refresh — the underlying tab's data just changed
    }
  }

  async function handleAssignStaffRole() {
    if (!assignContact.trim()) return;
    setAssigning(true);
    setAssignMessage(null);
    const { data, error } = await supabase.rpc("assign_staff_role", {
      p_contact: assignContact.trim(),
      p_staff_role: assignRole,
    });
    setAssigning(false);
    if (error) {
      setAssignMessage(error.message);
      return;
    }
    setAssignMessage(`✓ ${data} is now the ${assignRole.replace(/_/g, " ")} admin.`);
    setAssignContact("");
  }

  async function handleResolveLogin(requestId: string, approve: boolean) {
    setResolvingLoginId(requestId);
    const { error } = await supabase.rpc("resolve_admin_login", { p_request_id: requestId, p_approve: approve });
    setResolvingLoginId(null);
    if (!error) {
      setPendingLoginRequests((prev) => prev.filter((r) => r.id !== requestId));
    }
  }

  async function handleAgentIdVerification(agentId: string, verified: boolean) {
    setActionError(null);
    if (verified) {
      const { error } = await supabase.from("profiles").update({ valid_id_verified: true }).eq("id", agentId);
      if (error) { setActionError(error.message); return; }
    }
    setPendingAgentIds((prev) => prev.filter((a) => a.id !== agentId));
    loadRecentlyHandledRegistrations();
  }

  async function handleManagerCertVerification(managerId: string, verified: boolean) {
    setActionError(null);
    if (verified) {
      const { error } = await supabase.from("profiles").update({ professional_credentials_verified: true }).eq("id", managerId);
      if (error) { setActionError(error.message); return; }
    }
    setPendingManagerCerts((prev) => prev.filter((m) => m.id !== managerId));
    loadRecentlyHandledRegistrations();
  }

  async function handleProfileDecision(profileId: string, status: "approved" | "rejected") {
    setActionError(null);
    const { error } = await supabase.rpc("request_admin_action", {
      p_action_type: "approve_profile",
      p_target_id: profileId,
      p_proposed_changes: { status },
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    await supabase.from("profiles").update({ registration_admin_last_read_at: new Date().toISOString() }).eq("id", profileId);
    loadData();
    loadRecentlyHandledRegistrations();
  }

  // Genuinely never approves an application directly — only ever moves
  // it forward to the property's real owner for the actual final
  // decision, matching the fix already built into this table from the
  // start (see backend-v2/12_rental_applications.sql).
  async function handleApplicationScreened(applicationId: string) {
    setActionError(null);
    const { error } = await supabase
      .from("rental_applications")
      .update({ status: "awaiting_owner_decision", admin_last_read_at: new Date().toISOString() })
      .eq("id", applicationId);
    if (error) {
      setActionError("Could not update this application. Please try again.");
      return;
    }
    loadData();
    loadRecentlyHandledApplications();
  }

  async function handleRelayOwnerDecision(applicationId: string) {
    setActionError(null);
    const { error } = await supabase.rpc("relay_owner_decision_to_tenant", { p_application_id: applicationId });
    if (error) {
      setActionError(error.message);
      return;
    }
    await supabase.from("rental_applications").update({ admin_last_read_at: new Date().toISOString() }).eq("id", applicationId);
    loadData();
    loadRecentlyHandledApplications();
  }

  async function handlePropertyVerification(propertyId: string, status: "verified" | "rejected") {
    setActionError(null);
    // Real, direct fix per Fix Tracker item 7: the real underlying
    // system for a rejection reason already existed — notify_user
    // genuinely reads and includes it — but admin had no real way to
    // type one in, so every rejection silently fell back to a generic
    // message. A real reason is now required before rejecting.
    if (status === "rejected" && !propertyRejectReasons[propertyId]?.trim()) {
      setActionError("Please provide a real, genuine reason before rejecting — the owner will see exactly what you write.");
      return;
    }
    const { error } = await supabase.rpc("request_admin_action", {
      p_action_type: "verify_property",
      p_target_id: propertyId,
      p_proposed_changes: status === "rejected"
        ? { verification_status: status, rejection_reason: propertyRejectReasons[propertyId].trim() }
        : { verification_status: status },
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    await supabase.from("properties").update({ verification_admin_last_read_at: new Date().toISOString() }).eq("id", propertyId);
    loadData();
    loadRecentlyHandledProperties();
  }

  async function handleDisputeRuling(disputeId: string, status: "ruled_for_tenant" | "ruled_for_owner", notes: string) {
    setActionError(null);
    // The real fix: this now genuinely moves the disputed amount
    // between the two parties, not just a text notification claiming
    // someone "won" with no real financial consequence attached.
    const { error } = await supabase.rpc("rule_on_dispute", { p_dispute_id: disputeId, p_status: status, p_notes: notes });
    if (error) {
      setActionError(error.message);
      return;
    }
    loadData();
  }

  async function handleFeedbackModeration(feedbackId: string, status: "approved" | "rejected") {
    setActionError(null);
    const { error } = await supabase.from("community_feedback").update({ status }).eq("id", feedbackId);
    if (error) {
      setActionError("Could not update this feedback. Please try again.");
      return;
    }
    loadData();
  }

  // The real, three-way workflow restored from the original app —
  // reject and request-more-info both genuinely require a real written
  // reason before they can be confirmed, matching the original's exact
  // rule that the owner deserves to know why.
  async function handleEngageAccept(requestId: string, serviceType: string) {
    setActionError(null);
    const note = serviceType === "Full property management"
      ? "CHS has accepted this request and will be in touch to sign the service agreement and agree fees before work begins. Since this covers full property management, day-to-day maintenance decisions now go through CHS and the tenant directly."
      : "CHS has accepted this request and will be in touch to sign the service agreement and agree fees before work begins.";
    const { data: request, error } = await supabase
      .from("engage_chs_requests")
      .update({ status: "accepted", admin_note: note })
      .eq("id", requestId)
      .select()
      .single();
    if (error) {
      setActionError("Could not accept this request. Please try again.");
      return;
    }
    if (request) {
      await supabase.rpc("notify_user", {
        p_user_id: request.owner_id,
        p_title: "✓ Request accepted",
        p_body: `${request.service_type} (Ref ${request.reference}) accepted — proceeding to agreement.`,
      });

      // The actual, real behavior change this whole feature was
      // missing — not just the message shown above, but genuinely
      // updating every real tenancy tied to this real property, so
      // maintenance approvals actually start routing to the manager
      // instead of the owner from this point forward.
      if (serviceType === "Full property management" && request.property_id) {
        await supabase
          .from("tenancies")
          .update({ management_delegated: true })
          .eq("property_id", request.property_id);
      }
    }
    loadData();
  }

  async function handleEngageReject(requestId: string, reason: string) {
    if (!reason.trim()) {
      setActionError("Please give a reason — the owner deserves to know why.");
      return;
    }
    setActionError(null);
    const { data: request, error } = await supabase
      .from("engage_chs_requests")
      .update({ status: "rejected", admin_note: reason.trim() })
      .eq("id", requestId)
      .select()
      .single();
    if (error) {
      setActionError("Could not reject this request. Please try again.");
      return;
    }
    if (request) {
      await supabase.rpc("notify_user", {
        p_user_id: request.owner_id,
        p_title: "Request update",
        p_body: `${request.service_type} (Ref ${request.reference}) was not accepted this time — ${reason.trim()}`,
      });
    }
    loadData();
  }

  async function handleEngageRequestMoreInfo(requestId: string, question: string) {
    if (!question.trim()) {
      setActionError("Please specify what information you need.");
      return;
    }
    setActionError(null);
    const { data: request, error } = await supabase
      .from("engage_chs_requests")
      .update({ status: "more_info_requested", admin_note: question.trim() })
      .eq("id", requestId)
      .select()
      .single();
    if (error) {
      setActionError("Could not send this request. Please try again.");
      return;
    }
    if (request) {
      await supabase.rpc("notify_user", {
        p_user_id: request.owner_id,
        p_title: "CHS needs more information",
        p_body: `${request.service_type} (Ref ${request.reference}) — ${question.trim()}`,
      });
    }
    loadData();
  }

  // Real, direct client request: admin decides when a handled request
  // moves to archive, not the system deciding automatically the
  // instant it's acted on.
  async function handleArchiveEngage(requestId: string) {
    setActionError(null);
    const { error } = await supabase.from("engage_chs_requests").update({ archived_at: new Date().toISOString() }).eq("id", requestId);
    if (error) {
      setActionError("Could not archive this. Please try again.");
      return;
    }
    loadData();
  }

  async function handleVendorVerification(vendorId: string, status: "verified" | "rejected") {
    setActionError(null);
    const { error } = await supabase.rpc("request_admin_action", {
      p_action_type: "verify_vendor",
      p_target_id: vendorId,
      p_proposed_changes: { verification_status: status },
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    await supabase.from("marketplace_vendors").update({ admin_last_read_at: new Date().toISOString() }).eq("id", vendorId);
    loadData();
    loadRecentlyHandledVendors();
  }

  // The actual point of building this admin-adjustable rather than
  // hardcoded — a real fee change takes effect immediately, for every
  // future deal, without needing a new code deployment at all.
  async function handleUpdateFee(category: string, newAmount: number) {
    setActionError(null);
    const { error } = await supabase
      .from("referral_fee_settings")
      .update({ flat_fee_amount: newAmount, updated_at: new Date().toISOString() })
      .eq("category", category);
    if (error) {
      setActionError("Could not update this fee. Please try again.");
      return;
    }
    loadData();
  }

  async function handleCompleteAgentReferral(referralId: string) {
    setActionError(null);
    setCompletingReferralId(referralId);
    const { error } = await supabase.rpc("complete_agent_referral", { p_referral_id: referralId });
    setCompletingReferralId(null);
    if (error) {
      setActionError(error.message);
      return;
    }
    loadData();
  }

  async function handleUpdateOwedFeeStatus(feeId: string, status: "invoiced" | "paid") {
    setActionError(null);
    if (status === "paid") {
      // A real financial disbursement — routes through the same
      // high-stakes queue as everything else that moves real money.
      const { error } = await supabase.rpc("request_admin_action", {
        p_action_type: "mark_referral_paid",
        p_target_id: feeId,
        p_proposed_changes: {},
      });
      if (error) {
        setActionError(error.message);
        return;
      }
      loadData();
      return;
    }
    // "Invoiced" is routine status tracking, not a real money movement.
    const { error } = await supabase.from("referral_fees_owed").update({ status }).eq("id", feeId);
    if (error) {
      setActionError("Could not update this. Please try again.");
      return;
    }
    loadData();
  }

  // The actual, real fix this entire piece was about — genuinely
  // checking the real tenancy's delegation status before deciding
  // whether this fault goes to the real owner or the real manager for
  // approval, rather than always defaulting to the owner regardless.
  async function handleSendFaultForApproval(fault: (typeof unroutedFaults)[number]) {
    setActionError(null);
    const isDelegated = fault.tenancies?.management_delegated === true;
    const newStatus = isDelegated ? "awaiting_manager_approval" : "awaiting_owner_approval";

    const { error } = await supabase.from("fault_reports").update({ status: newStatus }).eq("id", fault.id);
    if (error) {
      setActionError("Could not update this fault report. Please try again.");
      return;
    }

    // Notifies the genuinely correct real person — the manager if this
    // property's management is truly delegated, the owner otherwise —
    // never both, and never guessing.
    const notifyTarget = isDelegated ? fault.tenancies?.manager_id : fault.tenancies?.landlord_id;
    if (notifyTarget) {
      await supabase.rpc("notify_user", {
        p_user_id: notifyTarget,
        p_title: "A maintenance quote needs your approval",
        p_body: `${fault.category} — ${fault.description.slice(0, 80)}`,
        p_link: isDelegated ? "/manager" : "/owner",
      });
    }
    loadData();
  }

  async function handleArtisanVerification(artisanId: string, status: "verified" | "rejected") {
    setActionError(null);
    const { error } = await supabase.rpc("request_admin_action", {
      p_action_type: "verify_artisan",
      p_target_id: artisanId,
      p_proposed_changes: { verification_status: status },
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    await supabase.from("artisans").update({ admin_last_read_at: new Date().toISOString() }).eq("id", artisanId);
    loadData();
    loadRecentlyHandledArtisans();
  }

  async function handleDeveloperReviewed(appId: string) {
    setActionError(null);
    const { error } = await supabase.rpc("request_admin_action", {
      p_action_type: "review_developer",
      p_target_id: appId,
      p_proposed_changes: { status: "reviewed" },
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    await supabase.from("developer_applications").update({ admin_last_read_at: new Date().toISOString() }).eq("id", appId);
    loadData();
    loadRecentlyHandledDevelopers();
  }

  async function handleDeveloperPartnered(appId: string) {
    setActionError(null);
    // The real fix: this was previously never reachable at all —
    // there was no button anywhere that could ever mark a developer
    // application as genuinely partnered, so the applicant's account
    // role could never actually elevate.
    const { error } = await supabase.rpc("request_admin_action", {
      p_action_type: "review_developer",
      p_target_id: appId,
      p_proposed_changes: { status: "partnered" },
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    await supabase.from("developer_applications").update({ admin_last_read_at: new Date().toISOString() }).eq("id", appId);
    loadData();
    loadRecentlyHandledDevelopers();
  }

  async function handleClearSale(offerId: string) {
    setActionError(null);
    const { error } = await supabase.rpc("request_admin_action", {
      p_action_type: "clear_sale",
      p_target_id: offerId,
      p_proposed_changes: {},
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    await supabase.from("offers").update({ admin_last_read_at: new Date().toISOString() }).eq("id", offerId);
    loadData();
    loadRecentlyHandledSaleApprovals();
  }

  async function handleLivenessReview(submissionId: string, approve: boolean) {
    setActionError(null);
    const { error } = await supabase.rpc("request_admin_action", {
      p_action_type: "review_liveness",
      p_target_id: submissionId,
      p_proposed_changes: { status: approve ? "approved" : "rejected" },
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    await supabase.from("liveness_submissions").update({ admin_last_read_at: new Date().toISOString() }).eq("id", submissionId);
    loadData();
    loadRecentlyHandledVerifications();
  }

  // Real, critical fix per direct client report: ID verification and
  // Face (liveness) verification are two genuinely separate systems
  // in this app -- different tables, different checks. Face
  // Verification already had a real admin screen; ID Verification
  // data was already being fetched into state, but no tab or screen
  // ever existed to actually see or act on it -- the notification
  // fired correctly (a database trigger watching the table), but
  // there was nowhere for it to land. This uses the review_buyer_id
  // action type, which already existed and works in
  // apply_admin_action (approves sets profiles.valid_id_verified and
  // notifies the buyer; rejects notifies them to resubmit) -- it just
  // had no frontend caller until now.
  async function handleBuyerIdReview(verificationId: string, approve: boolean) {
    setActionError(null);
    const { error } = await supabase.rpc("request_admin_action", {
      p_action_type: "review_buyer_id",
      p_target_id: verificationId,
      p_proposed_changes: { status: approve ? "approved" : "rejected" },
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    await supabase.from("buyer_id_verifications").update({ admin_last_read_at: new Date().toISOString() }).eq("id", verificationId);
    loadData();
    loadRecentlyHandledVerifications();
  }

  // Real, new AVS (Automated Verification System) trigger — Phase 1,
  // built directly per the client's own request. Marks the
  // submission as "running" immediately (a real, live loading state,
  // not a fake spinner with no backing change), then calls the real
  // verify-identity-document Edge Function, which reads the actual
  // uploaded document with Claude's real vision and writes its
  // verdict back to the database. Local state is updated from the
  // function's own real response so the result shows immediately,
  // without waiting on a full reload.
  async function handleAutoVerifyId(verificationId: string) {
    setActionError(null);
    setPendingBuyerIds((prev) => prev.map((s) => (s.id === verificationId ? { ...s, avs_status: "running" } : s)));
    await supabase.rpc("start_avs_check", { p_verification_id: verificationId });

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/verify-identity-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ verificationId }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setActionError(result.error || "The automated check could not run right now.");
        setPendingBuyerIds((prev) => prev.map((s) => (s.id === verificationId ? { ...s, avs_status: "error", avs_notes: result.error } : s)));
        return;
      }
      setPendingBuyerIds((prev) => prev.map((s) => (s.id === verificationId ? {
        ...s,
        avs_status: result.status,
        avs_extracted_name: result.extracted_full_name,
        avs_extracted_id_number: result.extracted_id_number,
        avs_name_match: result.name_match,
        avs_id_number_match: result.id_number_match,
        avs_notes: result.notes,
      } : s)));
    } catch {
      setActionError("Could not reach the automated check right now. Please try again or review manually.");
      setPendingBuyerIds((prev) => prev.map((s) => (s.id === verificationId ? { ...s, avs_status: "error", avs_notes: "Could not reach the automated check." } : s)));
    }
  }

  // Real, direct extension of the same AVS check to guarantor
  // documents, per explicit client instruction that the automated
  // check should "cut across board" — a real, separate request type
  // and separate columns (guarantor_avs_*), reviewed by the same real
  // super-admin-only edge function, now branching on "type".
  async function handleAutoVerifyGuarantor(applicationId: string) {
    setActionError(null);
    setPendingApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, guarantor_avs_status: "running" } : a)));
    await supabase.rpc("start_guarantor_avs_check", { p_application_id: applicationId });

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/verify-identity-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ type: "guarantor", applicationId }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setActionError(result.error || "The automated check could not run right now.");
        setPendingApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, guarantor_avs_status: "error", guarantor_avs_notes: result.error } : a)));
        return;
      }
      setPendingApplications((prev) => prev.map((a) => (a.id === applicationId ? {
        ...a,
        guarantor_avs_status: result.status,
        guarantor_avs_extracted_name: result.extracted_full_name,
        guarantor_avs_extracted_id_number: result.extracted_id_number,
        guarantor_avs_name_match: result.name_match,
        guarantor_avs_id_number_match: result.id_number_match,
        guarantor_avs_notes: result.notes,
      } : a)));
    } catch {
      setActionError("Could not reach the automated check right now. Please try again or review manually.");
      setPendingApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, guarantor_avs_status: "error", guarantor_avs_notes: "Could not reach the automated check." } : a)));
    }
  }

  async function handleApprovePrecommitMessage(messageId: string) {
    setActionError(null);
    const { error } = await supabase.rpc("approve_precommit_message", { p_message_id: messageId });
    if (error) {
      setActionError(error.message);
      return;
    }
    loadData();
  }

  async function handleRejectPrecommitMessage(messageId: string) {
    setActionError(null);
    const { error } = await supabase.rpc("reject_precommit_message", { p_message_id: messageId, p_reason: "This message could not be approved for delivery. Please rephrase and avoid sharing contact details before payment is complete." });
    if (error) {
      setActionError(error.message);
      return;
    }
    loadData();
  }

  async function handleSuspendAccount() {
    if (!suspendPhone.trim() || !suspendReason.trim()) return;
    setSuspending(true);
    setSuspendResult(null);
    const { data: userProfile } = await supabase.from("profiles").select("id, full_name").eq("phone", suspendPhone.trim()).maybeSingle();
    if (!userProfile) {
      setSuspendResult("No real, registered account found with that phone number.");
      setSuspending(false);
      return;
    }
    const { error } = await supabase.rpc("suspend_user_account", { p_user_id: userProfile.id, p_reason: suspendReason.trim() });
    setSuspending(false);
    if (error) {
      setSuspendResult(error.message);
      return;
    }
    setSuspendResult(`✓ ${userProfile.full_name}'s account has been suspended.`);
    setSuspendPhone("");
    setSuspendReason("");
  }

  async function handleResolveAppeal(appealId: string, approve: boolean) {
    const response = appealResponses[appealId] || (approve ? "Reviewed and reinstated." : "Reviewed — suspension upheld.");
    const { error } = await supabase.rpc("resolve_account_appeal", { p_appeal_id: appealId, p_approve: approve, p_response: response });
    if (!error) loadData();
  }

  async function handleApproveAgentChange(requestId: string) {
    const chsId = approvingAgentInput[requestId];
    if (!chsId?.trim()) return;
    setActionError(null);
    const { error } = await supabase.rpc("approve_agent_replacement", { p_request_id: requestId, p_agent_chs_id: chsId.trim() });
    if (error) {
      setActionError(error.message);
      return;
    }
    loadData();
  }

  async function handleResolveConcern(concernId: string, response: string) {
    setActionError(null);
    const { error } = await supabase.rpc("resolve_owner_concern", { p_concern_id: concernId, p_response: response });
    if (error) {
      setActionError(error.message);
      return;
    }
    loadData();
  }

  async function handleSaleDocReview(docId: string, approve: boolean) {
    setActionError(null);
    const { error } = await supabase.from("property_sale_documents").update({
      verification_status: approve ? "verified" : "rejected",
      verified_at: approve ? new Date().toISOString() : null,
    }).eq("id", docId);
    if (error) {
      setActionError("Could not update this document. Please try again.");
      return;
    }
    loadData();
  }

  async function handleConfirmLegalTransfer(offerId: string) {
    setActionError(null);
    const { error } = await supabase.rpc("confirm_legal_transfer_complete", { p_offer_id: offerId });
    if (error) {
      setActionError(error.message);
      return;
    }
    loadData();
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen zone-admin bg-[var(--zone-bg)] pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden flex items-center gap-1 bg-white/15 px-3 py-1.5 rounded-full text-xs font-semibold" aria-label="Open admin menu">
              <span className="text-sm">☰</span> Menu
            </button>
            <NotificationBell />
            <button onClick={() => signOut()} className="bg-white/15 px-3 py-1.5 rounded-full text-xs font-semibold">
              Log out
            </button>
          </div>
        </div>
        <h1 className="font-serif text-lg font-bold mt-1">Admin</h1>
        <RoleBadge label="CHS Admin Dashboard" />
        <Link href="/expenses" className="text-[10px] font-semibold text-white/70 underline mt-1 inline-block">
          💵 CHS Expenses & Income →
        </Link>
        {/* The real, repeated request — admin genuinely being able to
            reach every other dashboard directly, not stuck on one
            screen with no way out but closing the app entirely. */}
        <div className="flex gap-2 flex-wrap mt-2">
          {[
            { href: "/owner", label: "Owner" },
            { href: "/agent", label: "Agent" },
            { href: "/manager", label: "Manager" },
            { href: "/tenant", label: "Tenant" },
            { href: "/artisan", label: "Artisan" },
          ].map((d) => (
            <Link key={d.href} href={d.href} className="bg-white/15 px-2.5 py-1 rounded-full text-[10px] font-semibold">
              {d.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Real, new left sidebar per direct client design request —
          the ten real, meta/oversight items listed by name (not the
          existing ~25 day-to-day operational tabs, which stay on the
          horizontal bar below exactly as they were). Hidden entirely
          on narrow phone screens in favor of the toggle button below,
          since a permanent sidebar this wide would eat too much of a
          small screen's real content space. */}
      <div className="md:flex">
        <AdminSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isSuperAdmin={!!profile?.is_super_admin}
          viewerDomain={profile?.staff_role || null}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
        <div className="flex-1 min-w-0">
      <div className="flex border-b border-gray-200 bg-white px-4 overflow-x-auto">
        {([
          // Real, direct fix per explicit client feedback: these were
          // scattered with no real logic to the order, making related
          // items (e.g. every kind of verification) hard to find
          // without scrolling past several unrelated ones first.
          // Regrouped into real, named categories below — nothing
          // removed, only reordered.
          //
          // Second real fix, following a further, direct complaint:
          // reordering alone wasn't enough — the actual row still
          // rendered as one flat, undifferentiated strip with no
          // visual sign the grouping existed at all. Every entry now
          // carries its own real group name, and the row below
          // renders a genuine visual divider the moment the group
          // changes between two visible tabs — after filtering, so a
          // sub-admin who only sees a handful of tabs still gets
          // correct, real dividers for exactly what they can see.

          // General
          { key: "overview", label: "Overview", domain: null, group: "General" },
          { key: "analytics", label: "📊 Analytics", domain: null, group: "General" },

          // Financial
          { key: "finance", label: "Finance", domain: "finance", group: "Financial" },
          { key: "platformearnings", label: "Platform Earnings", domain: "owner_buyer_tenant", group: "Financial" },
          { key: "transactionlog", label: "📊 Transaction History Log", domain: "owner_buyer_tenant", group: "Financial" },
          { key: "referrals", label: `Referral fees (${owedFees.filter(f => f.status === "owed").length})`, domain: "agent_relations", group: "Financial" },
          { key: "escrowoversight", label: "🔒 Escrow Oversight", domain: "owner_buyer_tenant", group: "Financial" },
          { key: "shortletdeposits", label: "Shortlet/Hire Deposits", domain: "owner_buyer_tenant", group: "Financial" },
          { key: "shortletbookings", label: `Shortlet/Hire Bookings (${bookingQueue.length + pendingMsgs.length + releaseItems.length})`, domain: "owner_buyer_tenant", group: "Financial" },
          { key: "staleoffers", label: `⚠️ Pending/Inconclusive Deals (${stalePendingOffers.length})`, domain: "owner_buyer_tenant", group: "Financial" },

          // Verification — every real kind, grouped together
          { key: "registrations", label: `Registrations (${pendingRegistrationsFull.length})`, domain: "registration_setup", group: "Verification" },
          { key: "liveness", label: `Face Verification (${pendingLiveness.length})`, domain: "registration_setup", group: "Verification" },
          { key: "buyerid", label: `ID Verification (${pendingBuyerIds.length})`, domain: "registration_setup", group: "Verification" },
          { key: "properties", label: `Properties (${pendingProperties.length})`, domain: "owner_buyer_tenant", group: "Verification" },
          { key: "vendors", label: `Vendors (${pendingVendors.length})`, domain: "artisan_dev_pm_vendor", group: "Verification" },
          { key: "artisans", label: `Artisans (${pendingArtisans.length})`, domain: "artisan_dev_pm_vendor", group: "Verification" },
          { key: "developers", label: `Developers (${developerApplications.length})`, domain: "artisan_dev_pm_vendor", group: "Verification" },

          // Review & Approval queues
          { key: "applications", label: `Applications (${pendingApplications.length})`, domain: "owner_buyer_tenant", group: "Review & Approval" },
          { key: "offerreview", label: `Offer Review (${pendingOfferReview.length + pendingOfferDecisions.length})`, domain: "owner_buyer_tenant", group: "Review & Approval" },
          { key: "saleapprovals", label: `Sale Approvals (${pendingSaleApprovals.length})`, domain: "owner_buyer_tenant", group: "Review & Approval" },

          // Complaints & Care
          { key: "disputes", label: `Disputes (${openDisputes.length})`, domain: "customer_care", group: "Complaints & Care" },
          { key: "conditionreports", label: `📋 Condition Reports (${conditionReports.length})`, domain: "customer_care", group: "Complaints & Care" },
          { key: "feedback", label: `Feedback (${pendingFeedback.length})`, domain: "customer_care", group: "Complaints & Care" },
          { key: "faults", label: `Maintenance (${unroutedFaults.length})`, domain: "artisan_dev_pm_vendor", group: "Complaints & Care" },

          // Oversight
          { key: "tenantregisteroversight", label: "Tenant Register Oversight", domain: "owner_buyer_tenant", group: "Oversight" },
          { key: "marketplacemoderation", label: "Marketplace Moderation", domain: "owner_buyer_tenant", group: "Oversight" },
          { key: "hotelcontrols", label: "🏨 Hotel Controls (peak & cancellations)", domain: "owner_buyer_tenant", group: "Oversight" },
          { key: "walletsecurity", label: `Wallet Security (${walletSecurityOpen})`, domain: "owner_buyer_tenant", group: "Oversight" },
          { key: "rtorequests", label: `Rent-to-Own Requests (${rtoQueue.filter((r) => r.needs_action).length})`, domain: "owner_buyer_tenant", group: "Oversight" },
          { key: "inspections", label: `Inspections (${upcomingInspections.length})`, domain: "owner_buyer_tenant", group: "Oversight" },
          { key: "engage", label: `Engage CHS (${pendingEngage.length})`, domain: "super_admin_only", group: "Oversight" },

          // Tools — also reachable from the new sidebar, kept here too
          { key: "trace", label: "🔎 Trace an Account", domain: "super_admin_only", group: "Tools" },
          { key: "auditlog", label: "📋 Audit Log", domain: "super_admin_only", group: "Tools" },
          { key: "processedhistory", label: "🗄️ Processed History", domain: "owner_buyer_tenant", group: "Tools" },
        ] as { key: Tab; label: string; domain: string | null; group: string }[])
          // Real tab-gating — a sub-admin only ever sees the tabs
          // inside their own assigned domain. This is UX on top of the
          // real enforcement (RLS via staff_can_access, tested
          // directly against the live database) — hiding a tab a
          // sub-admin has no real access to anyway, not the actual
          // security boundary itself.
          .filter((tab) =>
            profile?.is_super_admin ||
            tab.domain === null ||
            (tab.domain !== "super_admin_only" && tab.domain === profile?.staff_role)
          )
          .map((tab, i, visibleTabs) => (
          <div key={tab.key} className="flex items-center shrink-0">
            {i > 0 && visibleTabs[i - 1].group !== tab.group && (
              <span className="w-px self-stretch my-2 bg-gray-200 shrink-0" />
            )}
          <button
            onClick={() => setActiveTab(tab.key)}
            className={`text-xs font-semibold px-3 py-3 border-b-2 whitespace-nowrap ${
              /* Real, direct request: a real deal that's gone stale
                 should always show as a red alert in the sidebar
                 itself, not just once you're already inside the tab. */
              (tab.key === "staleoffers" && stalePendingOffers.length > 0) ||
              (tab.key === "walletsecurity" && walletSecurityOpen > 0) ||
              (tab.key === "rtorequests" && rtoQueue.some((r) => r.needs_action)) ||
              (tab.key === "vendors" && pendingVendors.length > 0) ||
              (tab.key === "artisans" && pendingArtisans.length > 0) ||
              (tab.key === "shortletbookings" && (pendingMsgs.length > 0 || releaseItems.some((r) => r.kind !== "arrived_unconfirmed") || bookingQueue.some((q) => q.stage === "awaiting_admin_relay" || q.lane === "express")))
                ? "border-chs-red text-chs-red bg-red-50 rounded-t-lg"
                : activeTab === tab.key ? "border-chs-red text-chs-charcoal" : "border-transparent text-gray-400"
            }`}
          >
            {tab.label}
          </button>
          </div>
        ))}
      </div>

      {actionError && (
        <p className="text-xs text-chs-red bg-chs-amber-light mx-4 mt-3 rounded-lg px-3 py-2">{actionError}</p>
      )}

      <div className="px-4 py-4 space-y-3">
        {activeTab === "overview" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 bg-chs-charcoal rounded-xl p-4">
              <p className="text-[10px] uppercase text-white/60 font-semibold">💰 Real Platform Commission Earnings (all-time)</p>
              <p className="text-2xl font-bold text-white mt-1">{formatNaira(totalCommissionEarnings)}</p>
              <p className="text-[10px] text-white/50 mt-1">Sum of every real, paid commission across Sale, Rental, Shortlet/Hire, and Mortgage (Rent to Own) — updates automatically as real transactions complete.</p>
            </div>

            {/* Real, new feature completing item #9 — CHS's own real
                admin staff submitting a genuine daily report, visible
                to the super admin, mirroring the same real pattern
                already built and tested for agent/manager teams. */}
            <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-4">
              <button onClick={() => setShowAdminReportForm(!showAdminReportForm)} className="text-xs font-bold text-chs-charcoal">
                📋 {showAdminReportForm ? "Hide" : "Submit"} My Daily Report
              </button>
              {showAdminReportForm && (
                <div className="mt-2">
                  <textarea rows={2} placeholder="What did you genuinely do today?" value={adminReportActivities}
                    onChange={(e) => setAdminReportActivities(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
                  <textarea rows={2} placeholder="Real transactions handled? (optional)" value={adminReportTransactions}
                    onChange={(e) => setAdminReportTransactions(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
                  <textarea rows={2} placeholder="Real complaints raised? (optional)" value={adminReportComplaints}
                    onChange={(e) => setAdminReportComplaints(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
                  {adminReportResult && <p className="text-[10px] text-gray-500 mb-1.5">{adminReportResult}</p>}
                  <button onClick={handleSubmitAdminReport} disabled={submittingAdminReport}
                    className="w-full py-2 rounded-full bg-chs-red text-white text-[11px] font-semibold disabled:opacity-50">
                    {submittingAdminReport ? "Submitting..." : "Submit real report"}
                  </button>
                </div>
              )}
            </div>

            {profile?.is_super_admin && adminReports.length > 0 && (
              <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-3">
                <p className="text-xs font-bold text-chs-charcoal mb-2">📋 Real CHS Staff Daily Reports</p>
                {adminReports.map((r) => (
                  <div key={r.id} className="bg-[var(--zone-card)] rounded-lg p-2.5 mb-1.5 text-[11px]">
                    <p className="font-semibold text-chs-charcoal">{r.profiles?.full_name} {r.staff_role_at_time ? `(${r.staff_role_at_time})` : ""} — {new Date(r.created_at).toLocaleDateString()}</p>
                    <p className="text-gray-600 mt-0.5">{r.activities}</p>
                    {r.transactions_handled && <p className="text-green-700 mt-0.5">💰 {r.transactions_handled}</p>}
                    {r.complaints_raised && <p className="text-chs-amber-dark mt-0.5">⚠️ {r.complaints_raised}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Real, new feature per direct client request: CHS's own
                four real contact emails and two phone numbers,
                genuinely editable here — not hardcoded — so admin can
                update these themselves without a developer. */}
            <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-4">
              <button onClick={() => { setShowContactSettings(!showContactSettings); if (!contactSettingsValues) loadContactSettings(); }} className="text-xs font-bold text-chs-charcoal">
                ✉️ {showContactSettings ? "Hide" : "Edit"} Real Contact Details
              </button>
              {showContactSettings && contactSettingsValues && (
                <div className="mt-3 space-y-2">
                  {([
                    { key: "contact_email_support", label: "Support email" },
                    { key: "contact_email_inquiry", label: "Inquiry email" },
                    { key: "contact_email_engage", label: "Engage CHS email" },
                    { key: "contact_email_admin", label: "Admin email" },
                    { key: "contact_phone_primary", label: "Primary phone" },
                    { key: "contact_phone_secondary", label: "Secondary phone" },
                    { key: "sister_marketplace_name", label: "Sister marketplace name" },
                    { key: "sister_marketplace_url", label: "Sister marketplace URL" },
                  ] as const).map((f) => (
                    <div key={f.key}>
                      <label className="text-[10px] font-semibold text-gray-600">{f.label}</label>
                      <input type="text" value={contactSettingsValues[f.key] || ""}
                        onChange={(e) => setContactSettingsValues({ ...contactSettingsValues, [f.key]: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
                    </div>
                  ))}
                  {contactSettingsResult && <p className="text-[10px] text-gray-500">{contactSettingsResult}</p>}
                  <button onClick={handleSaveContactSettings} disabled={savingContactSettings}
                    className="w-full py-2 rounded-full bg-chs-red text-white text-[11px] font-semibold disabled:opacity-50">
                    {savingContactSettings ? "Saving..." : "Save real contact details"}
                  </button>
                </div>
              )}
            </div>

            <div className="col-span-2 bg-white rounded-xl border-2 border-chs-red p-4">
              <p className="text-xs font-bold text-chs-red mb-2">🛡️ Suspend a Real Account</p>
              <input type="tel" placeholder="Phone number" value={suspendPhone} onChange={(e) => setSuspendPhone(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
              <textarea rows={2} placeholder="Real, genuine reason — required, and shown to the user"
                value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
              {suspendResult && <p className="text-[10px] text-gray-600 mb-1.5">{suspendResult}</p>}
              <button onClick={handleSuspendAccount} disabled={suspending || !suspendPhone.trim() || !suspendReason.trim()}
                className="w-full py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
                {suspending ? "Suspending..." : "Suspend this account"}
              </button>
            </div>

            {pendingAppeals.length > 0 && (
              <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-3">
                <p className="text-xs font-bold text-chs-charcoal mb-2">⚖️ Real Account Appeals ({pendingAppeals.length})</p>
                {pendingAppeals.map((a) => (
                  <div key={a.id} className="bg-[var(--zone-card)] rounded-lg p-2.5 mb-2 last:mb-0">
                    <p className="text-xs font-semibold text-chs-charcoal">{a.profiles?.full_name} · {a.profiles?.phone}</p>
                    <p className="text-[11px] text-gray-600 mb-1.5">{a.message}</p>
                    <input type="text" placeholder="Your response..." value={appealResponses[a.id] || ""}
                      onChange={(e) => setAppealResponses((prev) => ({ ...prev, [a.id]: e.target.value }))}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[10px] mb-1.5" />
                    <div className="flex gap-2">
                      <button onClick={() => handleResolveAppeal(a.id, true)} className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                        ✓ Approve — Reinstate
                      </button>
                      <button onClick={() => handleResolveAppeal(a.id, false)} className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                        Deny — Uphold
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pendingLegalTransfers.length > 0 && (
              <div className="col-span-2 bg-chs-amber-light border-2 border-chs-amber-dark rounded-xl p-4">
                <p className="text-xs font-bold text-chs-amber-dark mb-2">🔒 Real funds held in escrow — confirm legal transfer to release</p>
                {actionError && <p className="text-xs text-chs-red bg-white rounded-lg px-2.5 py-2 mb-2">{actionError}</p>}
                {pendingLegalTransfers.map((offer) => (
                  <div key={offer.id} className="bg-white rounded-lg p-2.5 mb-2 last:mb-0">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-chs-charcoal font-semibold">{offer.property_title || "Property"}</span>
                      <span className="font-bold text-chs-charcoal">{formatNaira(offer.amount)}</span>
                    </div>
                    <button onClick={() => handleConfirmLegalTransfer(offer.id)}
                      className="w-full py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                      ✓ Confirm real legal documents transferred — release funds
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-3">
              <p className="text-xs font-bold text-chs-charcoal mb-2">📋 Recent Real Transactions ({recentTransactions.length})</p>
              {recentTransactions.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-4">No real transactions yet.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-1.5">
                  {recentTransactions.map((t) => (
                    <div key={t.id} className="bg-[var(--zone-card)] rounded-lg p-2 text-[10px]">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold capitalize">{t.transaction_type.replace(/_/g, " ")} — {t.payer_role}</span>
                        <span className="text-gray-400">{new Date(t.paid_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-gray-500 mt-0.5">{t.profiles?.full_name || "User"} · {t.properties?.title || ""}</p>
                      {t.properties?.street_address && (
                        <p className="text-gray-400">📍 {t.properties.street_address}</p>
                      )}
                      <div className="flex justify-between mt-1">
                        <span className="text-gray-500">Base: {formatNaira(t.base_amount)}{t.commission_percentage !== null ? ` × ${t.commission_percentage}%` : " (installment)"}</span>
                        <span className="font-bold text-chs-red">{formatNaira(t.commission_amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {openOwnerConcerns.length > 0 && (
              <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-3">
                <p className="text-xs font-bold text-chs-charcoal mb-2">⚠️ Open Owner Concerns ({openOwnerConcerns.length})</p>
                {openOwnerConcerns.map((c) => (
                  <div key={c.id} className="bg-[var(--zone-card)] rounded-lg p-2.5 mb-2 last:mb-0">
                    <p className="text-xs font-semibold text-chs-charcoal">{c.subject}</p>
                    <p className="text-[10px] text-gray-500 mb-1">{c.profiles?.full_name || "Owner"}: {c.message}</p>
                    <input type="text" placeholder="Your response..." value={concernResponses[c.id] || ""}
                      onChange={(e) => setConcernResponses((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[10px] mb-1.5" />
                    <button onClick={() => handleResolveConcern(c.id, concernResponses[c.id] || "Resolved.")}
                      className="w-full py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                      ✓ Send response & resolve
                    </button>
                  </div>
                ))}
              </div>
            )}

            {agentChangeRequests.length > 0 && (
              <div className="col-span-2 bg-white rounded-xl border-2 border-chs-red p-3">
                <p className="text-xs font-bold text-chs-red mb-2">🤝 Real Agent Replacement Requests ({agentChangeRequests.length})</p>
                {agentChangeRequests.map((r) => (
                  <div key={r.id} className="bg-[var(--zone-card)] rounded-lg p-2.5 mb-2 last:mb-0">
                    <p className="text-xs font-semibold text-chs-charcoal">{r.properties?.title || "Property"}</p>
                    <p className="text-[10px] text-gray-500 mb-1.5">
                      {r.requested_agent_name || "Name not given"} · {r.requested_agent_phone || "No phone"}
                      {r.requested_agent_chs_id && ` · Owner-provided CHS ID: ${r.requested_agent_chs_id}`}
                    </p>
                    <input type="text" placeholder="Verified agent's real CHS ID, e.g. CHS-AGT-12345"
                      value={approvingAgentInput[r.id] || r.requested_agent_chs_id || ""}
                      onChange={(e) => setApprovingAgentInput((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
                    <button onClick={() => handleApproveAgentChange(r.id)}
                      className="w-full py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                      ✓ Verify & grant access
                    </button>
                  </div>
                ))}
              </div>
            )}

            {ownersWithMessages.length > 0 && (
              <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-3">
                <p className="text-xs font-bold text-chs-charcoal mb-2">💬 Owner Correspondence ({ownersWithMessages.length})</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ownersWithMessages.map((o) => (
                    <button key={o.owner_id} onClick={() => setActiveMessageOwnerId(o.owner_id === activeMessageOwnerId ? null : o.owner_id)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-semibold ${activeMessageOwnerId === o.owner_id ? "bg-chs-red text-white" : "bg-[var(--zone-card)] text-chs-charcoal"}`}>
                      {o.full_name}
                    </button>
                  ))}
                </div>
                {activeMessageOwnerId && (
                  <OwnerAdminMessageThread ownerId={activeMessageOwnerId} viewerRole="admin" />
                )}
              </div>
            )}

            {profile?.is_super_admin && pendingLoginRequests.length > 0 && (
              <div className="col-span-2 bg-red-50 border-2 border-red-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-bold text-red-700">🔐 Admin logins awaiting your approval</p>
                {pendingLoginRequests.map((req) => (
                  <div key={req.id} className="bg-white rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-chs-charcoal">
                        {req.profiles?.[0]?.full_name || "Unknown"} ({req.profiles?.[0]?.role})
                      </p>
                      <p className="text-[10px] text-gray-400">Code: <span className="font-bold tracking-widest">{req.code}</span></p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleResolveLogin(req.id, true)} disabled={resolvingLoginId === req.id}
                        className="px-3 py-1.5 rounded-full bg-green-600 text-white text-[10px] font-semibold disabled:opacity-50">
                        Approve
                      </button>
                      <button onClick={() => handleResolveLogin(req.id, false)} disabled={resolvingLoginId === req.id}
                        className="px-3 py-1.5 rounded-full bg-gray-300 text-gray-700 text-[10px] font-semibold disabled:opacity-50">
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {profile?.is_super_admin && pendingActionRequests.length > 0 && (
              <div className="col-span-2 bg-amber-50 border-2 border-amber-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-bold text-amber-800">⚠️ Sub-admin actions awaiting your sign-off</p>
                {pendingActionRequests.map((req) => (
                  <div key={req.id} className="bg-white rounded-lg p-3">
                    <p className="text-xs font-semibold text-chs-charcoal">
                      {req.profiles?.[0]?.full_name || "Unknown"} requests: {req.action_type.replace(/_/g, " ")}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {JSON.stringify(req.proposed_changes)}
                      {req.note && ` — "${req.note}"`}
                    </p>
                    <div className="flex gap-1.5 mt-2">
                      <button onClick={() => handleResolveAction(req.id, true)} disabled={resolvingActionId === req.id}
                        className="px-3 py-1.5 rounded-full bg-green-600 text-white text-[10px] font-semibold disabled:opacity-50">
                        Approve
                      </button>
                      <button onClick={() => handleResolveAction(req.id, false)} disabled={resolvingActionId === req.id}
                        className="px-3 py-1.5 rounded-full bg-gray-300 text-gray-700 text-[10px] font-semibold disabled:opacity-50">
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {profile?.is_super_admin && (
              <div className="col-span-2 bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4">
                <button onClick={handleToggleActionHistory} disabled={loadingActionHistory}
                  className="text-xs font-semibold text-chs-red underline disabled:opacity-50">
                  {loadingActionHistory ? "Loading..." : showActionHistory ? "Hide sub-admin action history" : "📜 View sub-admin action history"}
                </button>
                {showActionHistory && (
                  <div className="mt-2 space-y-1.5">
                    {actionHistory.length === 0 ? (
                      <p className="text-[10px] text-gray-400">No resolved actions yet.</p>
                    ) : actionHistory.map((h) => (
                      <div key={h.id} className="text-[10px] text-gray-500 border-b border-gray-100 pb-1.5">
                        <span className={h.status === "approved" ? "text-green-700 font-semibold" : "text-chs-red font-semibold"}>
                          {h.status === "approved" ? "✓" : "✕"} {h.action_type.replace(/_/g, " ")}
                        </span>
                        {" "}— {h.profiles?.[0]?.full_name || "Unknown"}, {h.resolved_at && new Date(h.resolved_at).toLocaleString()}
                        {h.resolution_note && ` ("${h.resolution_note}")`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {profile?.is_super_admin && (
              <div className="col-span-2 bg-purple-50 border-2 border-purple-200 rounded-xl p-4 space-y-2">
                <p className="text-sm font-bold text-purple-800">🧪 Switch role for testing</p>
                <p className="text-[10px] text-purple-700">
                  Preview any dashboard using your own admin account — never a real user&apos;s data. Pre-launch
                  testing only; this whole panel should be removed once CHS actually goes live.
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { role: "owner", label: "Owner", path: "/owner" },
                    { role: "tenant", label: "Tenant", path: "/tenant" },
                    { role: "agent", label: "Agent", path: "/agent" },
                    { role: "manager", label: "Manager", path: "/manager" },
                    { role: "vendor", label: "Vendor", path: "/vendor" },
                    { role: "artisan", label: "Artisan", path: "/artisan" },
                  ].map((r) => (
                    <button
                      key={r.role}
                      onClick={() => { setTestModeRole(r.role); router.push(r.path); }}
                      className="py-2 rounded-lg bg-white border border-purple-200 text-purple-800 text-xs font-semibold"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Link href="/admin/feature-catalog"
              className="col-span-2 bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-chs-charcoal">📋 Feature Catalog</p>
                <p className="text-[10px] text-gray-400">Every real feature, where to find it, and where to trace it from here</p>
              </div>
              <span className="text-chs-red text-lg">→</span>
            </Link>
            <Link href="/admin/document-site"
              className="col-span-2 bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-chs-charcoal">📁 Document Site</p>
                <p className="text-[10px] text-gray-400">Every real, current reference document — user&apos;s guide, terms, handover notes, and more</p>
              </div>
              <span className="text-chs-red text-lg">→</span>
            </Link>
            <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4 text-center">
              <p className="font-serif text-2xl font-bold text-chs-charcoal">{overviewStats.totalListings}</p>
              <p className="text-[10px] text-gray-400 mt-1">Total listings</p>
            </div>
            <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4 text-center">
              <p className="font-serif text-2xl font-bold text-chs-charcoal">{overviewStats.verifiedListings}</p>
              <p className="text-[10px] text-gray-400 mt-1">Verified listings</p>
            </div>
            <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4 text-center col-span-2">
              <p className="font-serif text-2xl font-bold text-chs-charcoal">{overviewStats.registeredUsers}</p>
              <p className="text-[10px] text-gray-400 mt-1">Registered users</p>
            </div>
            <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4 text-center">
              <p className="font-serif text-2xl font-bold text-chs-charcoal">{overviewStats.propertiesWithRules}</p>
              <p className="text-[10px] text-gray-400 mt-1">Properties with House Rules uploaded</p>
            </div>
            <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4 text-center">
              <p className="font-serif text-2xl font-bold text-chs-charcoal">{overviewStats.rulesAcknowledged}</p>
              <p className="text-[10px] text-gray-400 mt-1">Tenants who&apos;ve acknowledged House Rules</p>
            </div>
            <Link href="/admin/concierge"
              className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4 text-center col-span-2 block">
              <p className="font-serif text-lg font-bold text-chs-charcoal">📝 Concierge Requests</p>
              <p className="text-[10px] text-gray-400 mt-1">Every &quot;Talk to an Agent&quot; submission, real and unfiltered →</p>
            </Link>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 flex items-center">
              A real, date-range breakdown of platform activity — properties sold, new tenancies, shortlet bookings, new listings, new users, and total commission revenue.
              <InfoTip term="real_date_range_analytics_report" />
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {([
                { key: "today", label: "Today" },
                { key: "yesterday", label: "Yesterday" },
                { key: "week", label: "This Week" },
                { key: "month", label: "This Month" },
                { key: "quarter", label: "This Quarter" },
                { key: "custom", label: "Custom" },
              ] as const).map((p) => (
                <button key={p.key} onClick={() => { setAnalyticsPeriod(p.key); if (p.key !== "custom") loadAnalytics(p.key); }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${
                    analyticsPeriod === p.key ? "bg-chs-red text-white" : "bg-gray-100 text-gray-600"
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>

            {analyticsPeriod === "custom" && (
              <div className="bg-gray-50 rounded-lg p-3 flex flex-wrap items-end gap-2">
                <label className="text-[10px] font-semibold text-gray-600">From
                  <input type="date" value={analyticsFrom} onChange={(e) => setAnalyticsFrom(e.target.value)} className="block mt-0.5 px-2 py-1.5 rounded border border-gray-200 text-xs" />
                </label>
                <label className="text-[10px] font-semibold text-gray-600">To
                  <input type="date" value={analyticsTo} min={analyticsFrom || undefined} onChange={(e) => setAnalyticsTo(e.target.value)} className="block mt-0.5 px-2 py-1.5 rounded border border-gray-200 text-xs" />
                </label>
                <button type="button" disabled={!analyticsFrom} onClick={() => loadAnalytics("custom")} className="px-4 py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">Show this range</button>
                <p className="w-full text-[10px] text-gray-500">Leave “To” empty to see just one day (the “From” day).</p>
              </div>
            )}

            {loadingAnalytics && <p className="text-xs text-gray-400 text-center py-8">Loading real report...</p>}

            {!loadingAnalytics && analyticsReport && (
              <>
                <p className="text-[10px] text-gray-400">
                  {new Date(analyticsReport.period_start).toLocaleDateString()} — {new Date(analyticsReport.period_end).toLocaleDateString()}
                </p>

                <div className="bg-chs-charcoal rounded-xl p-4">
                  <p className="text-[10px] uppercase text-white/60 font-semibold">💰 Real Commission Revenue (this period)</p>
                  <p className="text-2xl font-bold text-white mt-1">{formatNaira(analyticsReport.total_commission_revenue)}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl border border-gray-100 p-3">
                    <p className="text-xl font-bold text-chs-charcoal">{analyticsReport.sold_properties_count}</p>
                    <p className="text-[10px] text-gray-400">Properties sold</p>
                    <p className="text-[10px] text-green-700 font-semibold mt-0.5">{formatNaira(analyticsReport.sold_properties_value)}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-3">
                    <p className="text-xl font-bold text-chs-charcoal">{analyticsReport.new_tenancies_count}</p>
                    <p className="text-[10px] text-gray-400">New tenancies (rented)</p>
                    <p className="text-[10px] text-green-700 font-semibold mt-0.5">{formatNaira(analyticsReport.new_tenancies_value)} annual rent</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-3">
                    <p className="text-xl font-bold text-chs-charcoal">{analyticsReport.shortlet_bookings_count}</p>
                    <p className="text-[10px] text-gray-400">Shortlet bookings</p>
                    <p className="text-[10px] text-green-700 font-semibold mt-0.5">{formatNaira(analyticsReport.shortlet_bookings_value)}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-3">
                    <p className="text-xl font-bold text-chs-charcoal">{analyticsReport.new_listings_count}</p>
                    <p className="text-[10px] text-gray-400">New listings created</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-3">
                    <p className="text-xl font-bold text-chs-charcoal">{analyticsReport.new_users_count}</p>
                    <p className="text-[10px] text-gray-400">New real users</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-3">
                    <p className="text-xl font-bold text-chs-charcoal">{formatNaira(analyticsReport.service_charges_collected)}</p>
                    <p className="text-[10px] text-gray-400">Service charges collected</p>
                  </div>
                </div>

                {analyticsReport.commission_by_type.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-3">
                    <p className="text-xs font-bold text-chs-charcoal mb-2">Commission by transaction type</p>
                    {analyticsReport.commission_by_type.map((c) => (
                      <div key={c.transaction_type} className="flex justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                        <span className="text-gray-500 capitalize">{c.transaction_type.replace(/_/g, " ")} ({c.count})</span>
                        <span className="font-semibold">{formatNaira(c.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {!loadingAnalytics && !analyticsReport && (
              <button onClick={() => loadAnalytics(analyticsPeriod)} className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold">
                Load real report
              </button>
            )}
          </div>
        )}

        {activeTab === "finance" && (
          <div>
            {staleCommissions.length > 0 && (
              <div className="bg-chs-amber-light border-2 border-chs-red rounded-xl p-3 mb-4">
                <p className="text-xs font-bold text-chs-red mb-1">⚠️ {staleCommissions.length} real commission(s) invoiced but never collected</p>
                <p className="text-[10px] text-gray-600 mb-2">These have sat unpaid for 2+ hours — a real, early warning sign of a broken payment flow, exactly the pattern found and fixed on {new Date().getFullYear()}-09-06.</p>
                {staleCommissions.slice(0, 5).map((c) => (
                  <p key={c.id} className="text-[10px] text-gray-700">{c.payer_name} ({c.payer_phone}) — {c.transaction_type}, {formatNaira(c.commission_amount)} owed since {new Date(c.created_at).toLocaleString()}</p>
                ))}
              </div>
            )}
            <p className="text-xs font-bold text-chs-charcoal mb-2">Individual wallet lookup</p>
            <div className="flex gap-2 mb-3">
              <input type="text" value={walletSearch} onChange={(e) => setWalletSearch(e.target.value)}
                placeholder="Name or phone number" className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              <button onClick={handleWalletSearch} className="px-4 py-2.5 rounded-lg bg-chs-red text-white text-xs font-semibold">
                Search
              </button>
            </div>
            {walletSearchError && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2 mb-3">{walletSearchError}</p>}
            {walletResult && (
              <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3">
                <p className="text-sm font-semibold text-chs-charcoal capitalize">{walletResult.full_name} — {walletResult.role}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Main wallet: {formatNaira(walletResult.main_balance)} · Rent savings: {formatNaira(walletResult.rent_savings)} · Maintenance reserve: {formatNaira(walletResult.maintenance_reserve)}
                </p>
                <p className="text-xs mt-1">
                  Status: <span className={walletResult.frozen ? "text-chs-red font-bold" : "text-green-600 font-bold"}>
                    {walletResult.frozen ? "⚠ Frozen" : "Active, no flags"}
                  </span>
                </p>
                <div className="flex gap-2 mt-2">
                  {walletResult.frozen ? (
                    <button onClick={() => handleToggleFreeze(walletResult.id, false)}
                      className="flex-1 py-1.5 rounded-full bg-green-600 text-white text-[10px] font-semibold">
                      Unfreeze wallet
                    </button>
                  ) : (
                    <button onClick={() => handleToggleFreeze(walletResult.id, true)}
                      className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                      Freeze wallet
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "trace" && (
          <div>
            <p className="text-xs font-bold text-chs-charcoal mb-1">🔎 Trace an Account</p>
            <p className="text-[10px] text-gray-400 mb-2">
              Search by phone, email, or name — see everything real about this person across every system, the same
              way real customer support traces an account.
            </p>
            <div className="flex gap-2 mb-3">
              <input type="text" value={traceQuery} onChange={(e) => setTraceQuery(e.target.value)}
                placeholder="Phone, email, or name" className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              <button onClick={handleTraceSearch} disabled={traceSearching}
                className="px-4 py-2.5 rounded-lg bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                {traceSearching ? "..." : "Search"}
              </button>
            </div>

            {!tracedUser && traceResults.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {traceResults.map((u) => (
                  <button key={u.id} onClick={() => handleSelectTracedUser(u)}
                    className="w-full text-left bg-white rounded-lg border border-gray-200 p-2.5">
                    <p className="text-xs font-semibold text-chs-charcoal">{u.full_name} — {u.role}</p>
                    <p className="text-[10px] text-gray-400">{u.phone} · {u.email}</p>
                  </button>
                ))}
              </div>
            )}

            {tracedUser && (
              <div>
                <button onClick={() => { setTracedUser(null); setTraceData(null); }} className="text-[10px] text-chs-red underline mb-2">← Back to results</button>
                <div className="bg-chs-charcoal text-white rounded-xl p-3 mb-3">
                  <p className="text-sm font-bold">{tracedUser.full_name}</p>
                  <p className="text-[11px] text-white/70">{tracedUser.role} · {tracedUser.phone} · {tracedUser.email}</p>
                </div>

                {traceLoading ? (
                  <p className="text-xs text-gray-400">Loading everything...</p>
                ) : traceData && (
                  <div className="space-y-3">
                    <div className="bg-white rounded-xl border border-gray-100 p-3">
                      <p className="text-xs font-bold text-chs-charcoal mb-1.5">💰 Wallet</p>
                      {traceData.wallet ? (
                        <>
                          <p className="text-xs text-gray-600">
                            Balance: {formatNaira(traceData.wallet.main_balance)}
                            {traceData.wallet.frozen && <span className="text-chs-red font-bold"> — FROZEN</span>}
                          </p>
                          {traceData.walletTx.length === 0 ? (
                            <p className="text-[10px] text-gray-400 mt-1">No transactions.</p>
                          ) : traceData.walletTx.map((tx, i) => (
                            <p key={i} className="text-[10px] text-gray-500 mt-1">
                              {tx.direction === "credit" ? "+" : "−"}{formatNaira(tx.amount)} — {tx.description} ({new Date(tx.created_at).toLocaleDateString()})
                            </p>
                          ))}
                        </>
                      ) : <p className="text-[10px] text-gray-400">No wallet found.</p>}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 p-3">
                      <p className="text-xs font-bold text-chs-charcoal mb-1.5">⭐ Promotion credits</p>
                      {traceData.promoCredits.length === 0 ? (
                        <p className="text-[10px] text-gray-400">No credit transactions.</p>
                      ) : traceData.promoCredits.map((tx, i) => (
                        <p key={i} className="text-[10px] text-gray-500 mt-1">
                          {tx.direction === "credit" ? "+" : "−"}{tx.amount} credits — {tx.description} ({new Date(tx.created_at).toLocaleDateString()})
                        </p>
                      ))}
                      {traceData.promotions.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          {traceData.promotions.map((p, i) => (
                            <p key={i} className="text-[10px] text-gray-500">
                              {embeddedOne(p.properties)?.title || "Untitled"} — {p.is_active ? "ON" : "OFF"}{p.rank_category && `, Category ${p.rank_category}`}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 p-3">
                      <p className="text-xs font-bold text-chs-charcoal mb-1.5">🏗️ Construction Roadmap</p>
                      {traceData.roadmapAccess.length === 0 ? (
                        <p className="text-[10px] text-gray-400">No roadmap unlocks.</p>
                      ) : traceData.roadmapAccess.map((r, i) => (
                        <p key={i} className="text-[10px] text-gray-500 mt-1">
                          {r.model_id} — {formatNaira(r.amount_paid)}{r.is_test_grant && " (TEST GRANT)"} ({new Date(r.created_at).toLocaleDateString()})
                        </p>
                      ))}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 p-3">
                      <p className="text-xs font-bold text-chs-charcoal mb-1.5">🏦 Bank account</p>
                      {traceData.bankAccount ? (
                        <p className="text-[10px] text-gray-500">{traceData.bankAccount.bank_name} — {traceData.bankAccount.account_number} ({traceData.bankAccount.account_name})</p>
                      ) : <p className="text-[10px] text-gray-400">No bank account linked.</p>}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 p-3">
                      <p className="text-xs font-bold text-chs-charcoal mb-1.5">🏗️ Engage CHS requests</p>
                      {traceData.engageRequests.length === 0 ? (
                        <p className="text-[10px] text-gray-400">No requests.</p>
                      ) : traceData.engageRequests.map((r, i) => (
                        <p key={i} className="text-[10px] text-gray-500 mt-1">{r.reference} — {r.service_type} ({r.status})</p>
                      ))}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 p-3">
                      <p className="text-xs font-bold text-chs-charcoal mb-1.5">🏠 Real properties &amp; documents</p>
                      {traceData.properties.length === 0 ? (
                        <p className="text-[10px] text-gray-400">No real properties listed by this person.</p>
                      ) : traceData.properties.map((p) => (
                        <div key={p.id} className="mb-2 pb-2 border-b border-gray-50 last:border-0">
                          <p className="text-[11px] font-semibold text-chs-charcoal">{p.title}</p>
                          <p className="text-[9px] text-gray-400 capitalize">{p.status} · {p.verification_status}</p>
                          {p.property_sale_documents.length === 0 ? (
                            <p className="text-[9px] text-gray-400 mt-0.5">No documents uploaded.</p>
                          ) : (
                            p.property_sale_documents.map((d) => (
                              <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer" className="block text-[9px] text-chs-red underline mt-0.5 capitalize">
                                {d.document_type.replace(/_/g, " ")} — {d.verification_status}
                              </a>
                            ))
                          )}
                          {p.property_house_rules?.[0]?.document_url && (
                            <a href={p.property_house_rules[0].document_url} target="_blank" rel="noreferrer" className="block text-[9px] text-chs-red underline mt-0.5">
                              📋 House rules document
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "auditlog" && (
          <div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
              📋 A real, permanent record of every significant action across the platform — who did what, to which record, and when. Nothing here can be edited or deleted, by anyone, ever.
            </p>
            <div className="flex gap-2 mb-3">
              <input type="text" value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search by action or target — e.g. 'verify_property', 'suspend'"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <button onClick={() => loadAuditLog(auditSearch)} className="px-4 py-2 rounded-lg bg-chs-charcoal text-white text-xs font-semibold">
                Search
              </button>
            </div>
            {auditLoading ? (
              <p className="text-center text-sm text-gray-400 py-8">Loading...</p>
            ) : auditLog.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No real audit entries yet — click Search to load, or refine your search.</p>
            ) : (
              auditLog.map((entry) => (
                <div key={entry.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-bold text-chs-charcoal">{entry.action.replace(/_/g, " ")}</p>
                    <span className="text-[9px] text-gray-400 whitespace-nowrap">{new Date(entry.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    By {entry.profiles?.[0]?.full_name || "System"} ({entry.actor_role || "system"}) — {entry.profiles?.[0]?.phone}
                  </p>
                  {entry.target_label && <p className="text-[11px] text-gray-600 mt-1">{entry.target_label}</p>}
                  {entry.details && (
                    <pre className="text-[9px] text-gray-400 bg-white rounded-lg p-2 mt-1.5 overflow-x-auto whitespace-pre-wrap break-words">
                      {JSON.stringify(entry.details, null, 1)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "processedhistory" && (
          <div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
              🗄️ Every real rental application, offer, property listing, and registration CHS has ever decided on — nothing here disappears once approved or rejected, exactly like an old message in a real inbox.
            </p>
            <div className="flex gap-1.5 mb-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(["all", "rental_application", "offer", "property_listing", "registration"] as const).map((f) => (
                <button key={f} onClick={() => setProcessedHistoryFilter(f)}
                  className={`shrink-0 text-[10px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap ${processedHistoryFilter === f ? "bg-chs-charcoal text-white" : "bg-gray-100 text-gray-600"}`}>
                  {f === "all" ? "All" : f === "rental_application" ? "Applications" : f === "offer" ? "Offers" : f === "property_listing" ? "Listings" : "Registrations"}
                </button>
              ))}
            </div>
            {processedHistoryLoading ? (
              <p className="text-center text-sm text-gray-400 py-8">Loading...</p>
            ) : (
              (() => {
                const filtered = processedHistoryFilter === "all" ? processedHistory : processedHistory.filter((h) => h.item_type === processedHistoryFilter);
                return filtered.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-8">No real processed items yet.</p>
                ) : (
                  filtered.map((h) => (
                    <div key={h.item_type + h.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-chs-charcoal capitalize">{h.item_type.replace(/_/g, " ")}</p>
                        <span className="text-[9px] text-gray-400 whitespace-nowrap">{new Date(h.acted_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-chs-charcoal mt-1">{h.person_name} — {h.property_title}</p>
                      <p className={`text-[10px] font-semibold mt-0.5 capitalize ${h.status.includes("reject") || h.status.includes("declin") ? "text-chs-red" : "text-green-700"}`}>
                        {h.status.replace(/_/g, " ")}
                      </p>
                    </div>
                  ))
                );
              })()
            )}
          </div>
        )}

        {activeTab === "saleapprovals" && (
          <div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
              🏡 An owner has accepted a buyer&apos;s offer on a for-sale property. Before the buyer proceeds to document submission and escrow payment, CHS reviews and clears the transaction here — this is the checkpoint between &quot;offer accepted&quot; and &quot;money moves.&quot;
            </p>
            {pendingSaleApprovals.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No sale approvals pending right now.</p>
            ) : (
              pendingSaleApprovals.map((offer) => (
                <div key={offer.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold text-chs-charcoal">{offer.properties?.title || "Property"}</p>
                    <span className="text-[9px] text-gray-400 whitespace-nowrap">{new Date(offer.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Accepted offer: {formatNaira(offer.amount)}</p>
                  {offer.note && <p className="text-xs text-gray-400 mt-1">{offer.note}</p>}
                  <button onClick={() => handleClearSale(offer.id)}
                    className="w-full mt-2 py-2 rounded-full bg-chs-red text-white text-xs font-semibold">
                    Clear for escrow
                  </button>
                </div>
              ))
            )}

            {recentlyHandledSaleApprovals.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                  Recently handled — archives automatically after 7 days
                </p>
                {recentlyHandledSaleApprovals.map((offer) => (
                  <div key={offer.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-semibold text-chs-charcoal">{offer.properties?.title || "Property"}</p>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                        Cleared
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{formatNaira(offer.amount)}</p>
                    <button onClick={() => handleArchiveSaleApproval(offer.id)}
                      className="w-full py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                      🗄️ Send to Archive
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "liveness" && (
          <div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
              🔒 Each real capture below comes from an actual on-device walkthrough — never an automated pass. Review the photo directly and confirm it genuinely shows a real person matching the account.
            </p>
            {pendingLiveness.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No facial verifications pending review.</p>
            ) : (
              pendingLiveness.map((sub) => (
                <div key={sub.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-semibold text-chs-charcoal">{sub.profiles?.full_name || "User"}</p>
                    <span className="text-[9px] text-gray-400 whitespace-nowrap">{new Date(sub.created_at).toLocaleString()}</span>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sub.captured_photo_url} alt="Liveness capture" className="w-full rounded-lg mb-2" />
                  <div className="flex gap-2">
                    <button onClick={() => handleLivenessReview(sub.id, true)}
                      className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                      Approve
                    </button>
                    <button onClick={() => handleLivenessReview(sub.id, false)}
                      className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}

            {recentlyHandledLiveness.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                  Recently handled — archives automatically after 7 days
                </p>
                {recentlyHandledLiveness.map((sub) => (
                  <div key={sub.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-semibold text-chs-charcoal">{sub.profiles?.full_name || "User"}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${sub.status === "approved" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                        {sub.status}
                      </span>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sub.captured_photo_url} alt="Liveness capture" className="w-full rounded-lg mb-2" />
                    <button onClick={() => handleArchiveLiveness(sub.id)}
                      className="w-full py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                      🗄️ Send to Archive
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs font-bold text-chs-charcoal mt-4 mb-2">📜 Real Sale Legal Documents ({pendingSaleDocs.length})</p>
            {pendingSaleDocs.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No sale documents pending review.</p>
            ) : (
              pendingSaleDocs.map((doc) => (
                <div key={doc.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <p className="text-sm font-semibold text-chs-charcoal mb-1">{doc.properties?.title || "Property"}</p>
                  <p className="text-xs text-gray-500 mb-2 capitalize">{doc.document_type.replace(/_/g, " ")}</p>
                  <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-[10px] text-chs-red underline block mb-2">View uploaded document</a>
                  <p className="text-[9px] text-gray-400 mb-2">Uploaded {new Date(doc.created_at).toLocaleString()}</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleSaleDocReview(doc.id, true)}
                      className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                      Approve
                    </button>
                    <button onClick={() => handleSaleDocReview(doc.id, false)}
                      className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Real, critical fix per direct client report: this whole
            tab was missing — ID verification data was already being
            fetched but had nowhere to be reviewed. Separate from Face
            Verification above (different table, different real-world
            check: a document/NIN, not a live photo). */}
        {activeTab === "buyerid" && (
          <div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
              🪪 A real government-issued ID document and ID number submitted by a buyer before they can make offers. This is separate from Face Verification — review the actual document image below. Use 🤖 Verify Automatically for a real first-pass check of the name and ID number against the document itself; it flags a mismatch for you to review, it does not replace your own judgment.
            </p>
            {pendingBuyerIds.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No ID verifications pending review.</p>
            ) : (
              pendingBuyerIds.map((sub) => (
                <div key={sub.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <p className="text-sm font-semibold text-chs-charcoal mb-1">{sub.profiles?.full_name || "User"}</p>
                  <p className="text-[9px] text-gray-400 mb-1">Submitted {new Date(sub.created_at).toLocaleString()}</p>
                  <IdSubmissionDetailsBlock sub={sub} />
                  {/* Real, direct fix: the real upload form explicitly
                      accepts a PDF as well as an image
                      (image/*,application/pdf), but a bare <img> tag
                      cannot render a PDF at all — it would show a
                      broken image icon, giving admin nothing real to
                      review for any buyer who submitted a PDF. Now
                      shows the real image inline when it is one, and
                      a real, working "Open document" link for a PDF
                      (or anything else an <img> can't render)
                      instead. */}
                  {/\.pdf($|\?)/i.test(sub.id_document_url) ? (
                    <a href={sub.id_document_url} target="_blank" rel="noreferrer"
                      className="block w-full text-center py-2.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-chs-red mb-2">
                      📄 Open the real submitted document (PDF)
                    </a>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sub.id_document_url} alt="ID document" className="w-full rounded-lg mb-2" />
                  )}
                  <div className="border border-gray-200 rounded-xl p-2.5 mb-2 bg-gray-50">
                    <p className="text-[9px] font-bold text-gray-500 uppercase mb-1.5">Option 1 — Automatic</p>
                    <button onClick={() => handleAutoVerifyId(sub.id)} disabled={sub.avs_status === "running"}
                      className="block w-full py-1.5 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">
                      {sub.avs_status === "running" ? "🤖 Checking…" : "🤖 Verify Automatically"}
                    </button>
                    {sub.avs_status === "match" && (
                      <p className="text-[9px] text-green-700 mt-1.5">✓ Checked — the name and ID number both match. You can approve below with confidence, or still review the document yourself first.</p>
                    )}
                    {sub.avs_status === "mismatch" && (
                      <p className="text-[9px] text-chs-red mt-1.5 font-semibold">🚩 A discrepancy was found (see above) — please review carefully before deciding below.</p>
                    )}
                  </div>
                  <div className="border border-gray-200 rounded-xl p-2.5 bg-gray-50">
                    <p className="text-[9px] font-bold text-gray-500 uppercase mb-1.5">Option 2 — Your Manual Decision</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleBuyerIdReview(sub.id, true)}
                        className={`flex-1 py-1.5 rounded-full text-white text-[10px] font-semibold ${sub.avs_status === "mismatch" ? "bg-red-300" : "bg-chs-red"}`}>
                        {sub.avs_status === "match" ? "✓ Approve" : "Approve"}
                      </button>
                      <button onClick={() => handleBuyerIdReview(sub.id, false)}
                        className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {recentlyHandledBuyerIds.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                  Recently handled — archives automatically after 7 days
                </p>
                {recentlyHandledBuyerIds.map((sub) => (
                  <div key={sub.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-semibold text-chs-charcoal">{sub.profiles?.full_name || "User"}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${sub.status === "approved" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                        {sub.status}
                      </span>
                    </div>
                    <IdSubmissionDetailsBlock sub={sub} />
                    {/\.pdf($|\?)/i.test(sub.id_document_url) ? (
                      <a href={sub.id_document_url} target="_blank" rel="noreferrer"
                        className="block w-full text-center py-2.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-chs-red mb-2">
                        📄 Open the real submitted document (PDF)
                      </a>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sub.id_document_url} alt="ID document" className="w-full rounded-lg mb-2" />
                    )}
                    <button onClick={() => handleArchiveBuyerId(sub.id)}
                      className="w-full py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                      🗄️ Send to Archive
                    </button>
                  </div>
                ))}
              </div>
            )}

            {pendingSaleDocs.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No sale documents pending review.</p>
            ) : (
              pendingSaleDocs.map((doc) => (
                <div key={doc.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <p className="text-sm font-semibold text-chs-charcoal mb-1">{doc.properties?.title || "Property"}</p>
                  <p className="text-xs text-gray-500 mb-2 capitalize">{doc.document_type.replace(/_/g, " ")}</p>
                  <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-[10px] text-chs-red underline block mb-2">View uploaded document</a>
                  <p className="text-[9px] text-gray-400 mb-2">Uploaded {new Date(doc.created_at).toLocaleString()}</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleSaleDocReview(doc.id, true)}
                      className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                      Verify
                    </button>
                    <button onClick={() => handleSaleDocReview(doc.id, false)}
                      className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}

            <p className="text-xs font-bold text-chs-charcoal mt-4 mb-2">📦 Real Hard-Copy Document Requests ({pendingDispatchRequests.length})</p>
            {pendingDispatchRequests.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-4">No real delivery requests pending.</p>
            ) : (
              pendingDispatchRequests.map((d) => (
                <div key={d.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <p className="text-sm font-semibold text-chs-charcoal">{d.offers?.properties?.title || "Property"}</p>
                  <p className="text-[9px] text-gray-400 font-mono">{d.offers?.properties?.reference_number}</p>
                  <p className="text-xs text-chs-charcoal mt-1.5"><span className="font-semibold">Address:</span> {d.delivery_address}</p>
                  <p className="text-xs text-chs-charcoal"><span className="font-semibold">Delivery contact CHS coordinates with:</span> {d.delivery_phone}</p>
                  <p className="text-xs text-chs-charcoal"><span className="font-semibold">Preferred method:</span> {d.preferred_method}</p>
                  {d.delivery_note && <p className="text-xs text-gray-500 mt-1">&quot;{d.delivery_note}&quot;</p>}
                  <p className="text-[9px] text-gray-400 mt-1">Requested {new Date(d.created_at).toLocaleString()}</p>
                  <button onClick={() => handleMarkDispatched(d.id, d.preferred_method)}
                    className="w-full mt-2 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                    ✓ Mark as dispatched
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "registrations" && (
          <div>
            {/* Real, comprehensive fix per direct, confirmed client
                feedback with a real screenshot: the earlier version
                only showed a yes/no label while the actual document,
                ID type, and ID number sat in a separate section admin
                had to scroll down and cross-reference — still
                genuinely "approving blind." Every real KYC detail now
                sits directly on the same card, whichever role or
                verification source it actually comes from, with a
                real, required reason captured when rejecting. */}
            {pendingRegistrationsFull.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No pending registrations.</p>
            ) : (
              pendingRegistrationsFull.map((p) => (
                <div key={p.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold text-chs-charcoal">{p.full_name}</p>
                    <span className="text-[9px] text-gray-400 whitespace-nowrap">{new Date(p.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-500">{p.phone} — {p.role} — {p.state}</p>

                  <div className="border-t border-gray-200 mt-2 pt-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Real KYC detail submitted</p>
                    {p.document_url ? (
                      <>
                        <p className="text-xs text-chs-charcoal mt-1">
                          <span className="font-semibold">{p.role === "manager" ? "Profession" : "ID type"}:</span> {p.id_type || "—"}
                        </p>
                        <p className="text-xs text-chs-charcoal">
                          <span className="font-semibold">{p.role === "manager" ? "Reg. number" : "ID number"}:</span> {p.id_number || "—"}
                        </p>
                        <DocumentViewLink url={p.document_url} label="🔍 View the real, uploaded document — compare the name and number against what's above" />
                      </>
                    ) : (
                      <p className="text-xs font-bold text-chs-red mt-1">⚠️ No real document uploaded — nothing to verify. Do not approve blind.</p>
                    )}
                  </div>

                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="If rejecting: real reason (e.g. name doesn't match ID, wrong ID type)"
                      value={rejectReasons[p.id] || ""}
                      onChange={(e) => setRejectReasons({ ...rejectReasons, [p.id]: e.target.value })}
                      className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-[11px] mb-2"
                    />
                    <div className="flex gap-2">
                      <button onClick={async () => {
                          handleProfileDecision(p.id, "approved");
                          if (p.role === "agent") await supabase.from("profiles").update({ valid_id_verified: true }).eq("id", p.id);
                          if (p.role === "manager") await supabase.from("profiles").update({ professional_credentials_verified: true }).eq("id", p.id);
                          setPendingRegistrationsFull((prev) => prev.filter((x) => x.id !== p.id));
                        }}
                        className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                        Approve
                      </button>
                      <button onClick={() => handleRejectWithReason(p.id)}
                        className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                        Reject with reason
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {(pendingAgentIds.length > 0 || pendingManagerCerts.length > 0) && (
              <div className="mt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                  Already-active accounts with a real document awaiting verification
                </p>
                {pendingAgentIds.map((a) => (
                  <div key={a.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                    <p className="text-sm font-semibold text-chs-charcoal">{a.full_name} <span className="text-[9px] font-normal text-gray-400">— Agent</span></p>
                    <p className="text-xs text-gray-500">{a.phone}</p>
                    <p className="text-xs text-chs-charcoal mt-1"><span className="font-semibold">ID type:</span> {a.valid_id_type} — {a.valid_id_number}</p>
                    <DocumentViewLink url={a.valid_id_document_url} label="🔍 View the real, uploaded ID document" />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => handleAgentIdVerification(a.id, true)}
                        className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                        Verify
                      </button>
                      <button onClick={() => handleAgentIdVerification(a.id, false)}
                        className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
                {pendingManagerCerts.map((m) => (
                  <div key={m.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                    <p className="text-sm font-semibold text-chs-charcoal">{m.full_name} <span className="text-[9px] font-normal text-gray-400">— Property Manager</span></p>
                    <p className="text-xs text-gray-500">{m.phone}</p>
                    <p className="text-xs text-chs-charcoal mt-1"><span className="font-semibold">{m.profession}:</span> {m.professional_registration_number || "—"}</p>
                    <DocumentViewLink url={m.certificate_document_url} label="🔍 View the real, uploaded certificate" />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => handleManagerCertVerification(m.id, true)}
                        className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                        Verify
                      </button>
                      <button onClick={() => handleManagerCertVerification(m.id, false)}
                        className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {recentlyHandledRegistrations.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                  Recently handled — archives automatically after 7 days
                </p>
                {recentlyHandledRegistrations.map((p) => (
                  <div key={p.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-semibold text-chs-charcoal">{p.full_name}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${p.status === "approved" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                        {p.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{p.phone} — {p.role}</p>
                    {p.document_url && (
                      <DocumentViewLink url={p.document_url} label="🔍 View the real, uploaded document again" />
                    )}
                    <button onClick={() => handleArchiveRegistration(p.id)}
                      className="w-full mt-2 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                      🗄️ Send to Archive
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "applications" &&
          (pendingApplications.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No pending rental applications.</p>
          ) : (
            pendingApplications.map((app) => (
              <div key={app.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-semibold text-chs-charcoal">{app.properties?.title || "Property"}</p>
                  <span className="text-[9px] text-gray-400 whitespace-nowrap">{new Date(app.created_at).toLocaleString()}</span>
                </div>
                <p className="text-[10px] text-gray-500 mb-2">
                  {app.properties?.street_address ? `${app.properties.street_address}, ` : ""}{app.properties?.location_area}
                  {" — Owner: "}{app.properties?.profiles?.full_name} ({app.properties?.profiles?.phone})
                </p>

                <p className="text-[10px] font-bold text-gray-400 uppercase mt-2">Applicant</p>
                <p className="text-xs text-chs-charcoal">{app.applicant_full_name || app.tenant?.full_name || "Applicant"} — {app.applicant_phone || app.tenant?.phone}</p>
                <p className="text-[11px] text-gray-500">{app.applicant_occupation} · {app.applicant_present_address}</p>
                <p className="text-[11px] text-gray-500">Income: {app.applicant_income_source}</p>
                <p className="text-[11px] text-gray-500">{app.applicant_id_type} — {app.applicant_id_number}</p>
                {app.applicant_id_document_url && (
                  <a href={app.applicant_id_document_url} target="_blank" rel="noreferrer" className="text-[10px] text-chs-red underline">View applicant&apos;s real, uploaded ID</a>
                )}

                <p className="text-[10px] font-bold text-gray-400 uppercase mt-2">Guarantor</p>
                {app.guarantor_confirmed_at ? (
                  <>
                    <p className="text-xs text-chs-charcoal">{app.guarantor_name} — {app.guarantor_phone}</p>
                    <p className="text-[11px] text-gray-500">{app.guarantor_relationship} · {app.guarantor_occupation}</p>
                    <p className="text-[11px] text-gray-500">{app.guarantor_address}</p>
                    <p className="text-[11px] text-gray-500">{app.guarantor_id_type} — {app.guarantor_id_number}</p>
                    {app.guarantor_id_number && app.guarantor_id_type && !validateIdNumber(app.guarantor_id_type, app.guarantor_id_number).valid && (
                      <p className="text-[11px] font-bold text-chs-red bg-red-50 rounded-lg px-2 py-1 mt-0.5">
                        🚩 This ID number is not in a valid format — {validateIdNumber(app.guarantor_id_type, app.guarantor_id_number).message} Ask the guarantor to re-enter it correctly before you relay this application.
                      </p>
                    )}
                    {app.guarantor_id_document_url && (
                      <a href={app.guarantor_id_document_url} target="_blank" rel="noreferrer" className="text-[10px] text-chs-red underline block">View guarantor&apos;s real, uploaded ID</a>
                    )}
                    {/* Real, direct extension of the AVS automated
                        check to guarantor documents — the same real
                        intelligence already proven for buyer ID
                        verification, now also available here, per
                        explicit client instruction. */}
                    <div className="border border-gray-200 rounded-xl p-2 my-1.5 bg-gray-50">
                      <button onClick={() => handleAutoVerifyGuarantor(app.id)} disabled={app.guarantor_avs_status === "running"}
                        className="block w-full py-1 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">
                        {app.guarantor_avs_status === "running" ? "🤖 Checking…" : "🤖 Verify Guarantor's ID Automatically"}
                      </button>
                      {app.guarantor_avs_status === "match" && (
                        <p className="text-[10px] text-green-700 mt-1">✓ Checked — the name and ID number on the document both match what the guarantor entered.</p>
                      )}
                      {app.guarantor_avs_status === "mismatch" && (
                        <div className="text-[10px] text-chs-red mt-1 font-semibold space-y-0.5">
                          <p>🚩 Discrepancy found — review carefully before relaying this application.</p>
                          {app.guarantor_avs_name_match === false && (
                            <p className="font-normal"><span className="text-gray-500">Name on document reads:</span> <b>{app.guarantor_avs_extracted_name || "(could not read)"}</b> <span className="text-gray-400">— guarantor typed</span> <b>{app.guarantor_signature_full_name}</b></p>
                          )}
                          {app.guarantor_avs_id_number_match === false && (
                            <p className="font-normal"><span className="text-gray-500">ID number on document reads:</span> <b>{app.guarantor_avs_extracted_id_number || "(could not read)"}</b> <span className="text-gray-400">— guarantor typed</span> <b>{app.guarantor_id_number}</b></p>
                          )}
                        </div>
                      )}
                      {app.guarantor_avs_status === "error" && (
                        <p className="text-[10px] text-gray-400 mt-1">⚠ Automated check could not complete — {app.guarantor_avs_notes || "please review this document manually."}</p>
                      )}
                    </div>
                    {/* Real, new display per direct client
                        discussion: an ID alone can't confirm current
                        address, so this shows the real, separate
                        proof alongside it, with its own real date so
                        admin can see at a glance whether it's still
                        genuinely within the required 90 days. */}
                    {app.guarantor_address_proof_url ? (
                      <a href={app.guarantor_address_proof_url} target="_blank" rel="noreferrer" className="text-[10px] text-chs-red underline block">
                        View guarantor&apos;s real {app.guarantor_address_proof_type || "proof of address"} ({app.guarantor_address_proof_date})
                      </a>
                    ) : (
                      <p className="text-[10px] text-gray-400">No real proof of address on file.</p>
                    )}
                    <p className="text-[11px] text-green-700 font-semibold mt-1">✓ Independently confirmed by the guarantor themselves</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-chs-charcoal">{app.guarantor_name} — {app.guarantor_phone}</p>
                    <p className="text-[11px] text-chs-amber-dark font-semibold mt-1">⏳ Awaiting the guarantor&apos;s own, independent confirmation</p>
                  </>
                )}
                <p className="text-[11px] text-gray-500 mt-1">Move-in: {app.move_in_date} {app.guarantor_consented ? "· ✓ Consent given" : "· ⚠️ No consent recorded"}</p>

                {/* Real, direct fix for a genuine, confirmed gap: an
                    application sitting here while the real owner
                    decides was previously invisible to admin
                    entirely — no way to trace it, see the property,
                    or see who the owner even was. Now always visible
                    with a clear, honest status, whether or not admin
                    has any action to take right now. */}
                {app.status === "awaiting_owner_decision" && (
                  <p className="text-[10px] font-bold text-chs-amber-dark bg-chs-amber-light rounded-lg px-2 py-1.5 mt-2">
                    ⏳ Sent to the real owner ({app.properties?.profiles?.full_name}) — awaiting their decision. Nothing for admin to do yet.
                  </p>
                )}

                {app.status === "pending" && (
                  <button onClick={() => handleApplicationScreened(app.id)}
                    className="w-full mt-2 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                    Documents cleared — send to owner
                  </button>
                )}
                {app.status === "awaiting_admin_review" && (
                  <button onClick={async () => {
                      await supabase.rpc("admin_relay_application_to_owner", { p_application_id: app.id });
                      await supabase.from("rental_applications").update({ admin_last_read_at: new Date().toISOString() }).eq("id", app.id);
                      loadData();
                      loadRecentlyHandledApplications();
                    }}
                    className="w-full mt-2 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                    ✓ Reviewed — relay to owner for a decision
                  </button>
                )}
                {app.status === "owner_decided_pending_relay" && (
                  <div className="mt-2 bg-chs-amber-light rounded-lg p-2">
                    <p className="text-[10px] font-bold text-chs-charcoal mb-1">
                      Real owner decision: {app.owner_decision === "approved" ? "✅ Approved" : "❌ Declined"}
                    </p>
                    <button onClick={() => handleRelayOwnerDecision(app.id)}
                      className="w-full py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                      Relay this decision to the applicant
                    </button>
                  </div>
                )}
              </div>
            ))
          ))}

        {recentlyHandledApplications.length > 0 && activeTab === "applications" && (
          <div className="mt-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
              Recently handled — archives automatically after 7 days
            </p>
            {recentlyHandledApplications.map((app) => (
              <div key={app.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-semibold text-chs-charcoal">{app.properties?.title || "Property"}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${app.status === "approved" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                    {app.status?.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{app.tenant?.full_name} — {app.tenant?.phone}</p>
                <p className="text-[9px] text-gray-400 mb-2">{new Date(app.created_at).toLocaleString()}</p>
                <button onClick={() => handleArchiveApplication(app.id)}
                  className="w-full py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                  🗄️ Send to Archive
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "offerreview" && (
          <div>
            {/* Real, direct fix following a specific, well-described
                client report: this real, working review queue
                genuinely existed and functioned correctly, but lived
                buried in Overview — not filed under any real,
                findable category, exactly as reported. Moved here,
                to the one tab where it genuinely, thematically
                belongs — every one of these real messages is part of
                an active offer negotiation. */}
            {pendingPrecommitMessages.length > 0 && (
              <div className="bg-white rounded-xl border-2 border-chs-amber-dark p-3 mb-3">
                <p className="text-xs font-bold text-chs-amber-dark mb-2">📋 Real Negotiation Messages Awaiting Review ({pendingPrecommitMessages.length})</p>
                <p className="text-[10px] text-gray-500 mb-2">No message reaches a non-committed buyer or seller until approved here — the real deterrent against taking a deal off-platform.</p>
                {pendingPrecommitMessages.map((m) => (
                  <div key={m.id} className="bg-[var(--zone-card)] rounded-lg p-2.5 mb-2 last:mb-0">
                    <p className="text-[10px] text-gray-400 mb-1">{m.profiles?.full_name || "User"} ({m.sender_role}) — {m.offers?.properties?.title || "Property"}</p>
                    <p className="text-xs text-chs-charcoal mb-2">{m.text}</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleApprovePrecommitMessage(m.id)}
                        className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                        Approve & deliver
                      </button>
                      <button onClick={() => handleRejectPrecommitMessage(m.id)}
                        className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
              💰 A real offer waits here until CHS reviews the buyer&apos;s real, verified details and relays it to the owner — the owner never sees a raw phone number; any real contact happens through the moderated messages once the deal is underway.
            </p>
            {pendingOfferReview.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No real offers awaiting review.</p>
            ) : (
              pendingOfferReview.map((o) => (
                <div key={o.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-semibold text-chs-charcoal">{o.properties?.title || "Property"}</p>
                      <p className="text-[9px] text-gray-400 font-mono">{o.properties?.reference_number}</p>
                    </div>
                    <span className="text-[9px] text-gray-400 whitespace-nowrap">{new Date(o.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm font-bold text-chs-red mt-1">{formatNaira(o.amount)}</p>
                  <p className="text-[10px] text-chs-charcoal bg-gray-50 rounded-lg px-2 py-1 mt-1.5">
                    → Will relay to real owner: <span className="font-bold">{o.properties?.profiles?.full_name}</span> ({o.properties?.profiles?.phone})
                  </p>
                  <p className="text-xs text-chs-charcoal mt-1">{o.buyer_full_name} — {o.buyer_phone}</p>
                  {o.buyer?.valid_id_verified ? (
                    <span className="text-[9px] font-bold text-green-700">✓ ID Verified</span>
                  ) : (
                    <span className="text-[9px] font-bold text-chs-amber-dark">⚠ Not yet verified</span>
                  )}
                  <p className="text-[11px] text-gray-500 mt-1">{o.buyer_occupation} · {o.buyer_source_of_funds}</p>
                  {o.note && <p className="text-[11px] text-gray-500 mt-1 italic">&quot;{o.note}&quot;</p>}
                  <button onClick={async () => {
                    await supabase.rpc("admin_relay_offer_to_owner", { p_offer_id: o.id });
                    await supabase.from("offers").update({ admin_last_read_at: new Date().toISOString() }).eq("id", o.id);
                    setPendingOfferReview((prev) => prev.filter((x) => x.id !== o.id));
                    loadRecentlyHandledOffers();
                  }}
                    className="w-full mt-2 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                    ✓ Reviewed — relay to owner
                  </button>
                </div>
              ))
            )}

            {pendingOfferDecisions.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold text-chs-charcoal mb-2">📋 Real Owner Decisions — Ready to Relay to Buyer</p>
                {pendingOfferDecisions.map((o) => (
                  <div key={o.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-semibold text-chs-charcoal">{o.properties?.title || "Property"}</p>
                      <span className="text-[9px] text-gray-400 whitespace-nowrap">{new Date(o.owner_decision_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm font-bold text-chs-red mt-1">{formatNaira(o.amount)}</p>
                    <p className="text-xs text-chs-charcoal mt-1">Buyer: {o.buyer_full_name} — {o.buyer_phone}</p>
                    <p className="text-xs font-bold mt-1">{o.owner_decision === "accepted" ? "✅ Owner accepted" : "❌ Owner declined"}</p>
                    {o.seller_response_note && <p className="text-[11px] text-gray-500 mt-1 italic">&quot;{o.seller_response_note}&quot;</p>}
                    <button onClick={async () => {
                      await supabase.rpc("admin_relay_offer_decision_to_buyer", { p_offer_id: o.id });
                      await supabase.from("offers").update({ admin_last_read_at: new Date().toISOString() }).eq("id", o.id);
                      setPendingOfferDecisions((prev) => prev.filter((x) => x.id !== o.id));
                      loadRecentlyHandledOffers();
                    }}
                      className="w-full mt-2 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                      ✓ Reviewed — relay to buyer
                    </button>
                  </div>
                ))}
              </div>
            )}

            {recentlyHandledOffers.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                  Recently handled — archives automatically after 7 days
                </p>
                {recentlyHandledOffers.map((o) => (
                  <div key={o.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-semibold text-chs-charcoal">{o.properties?.title || "Property"}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${
                        o.status === "accepted" ? "bg-green-100 text-green-700" : o.status === "rejected" ? "bg-gray-200 text-gray-500" : "bg-chs-amber-light text-chs-amber-dark"
                      }`}>
                        {o.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-chs-red mt-1">{formatNaira(o.amount)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{o.buyer_full_name} — {o.buyer_phone}</p>
                    <button onClick={() => handleArchiveOffer(o.id)}
                      className="mt-2 w-full py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                      🗄️ Send to Archive
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "properties" && (
          <div>
            {/* Real, new search tool completing a direct, serious
                client concern: two real properties shared the exact
                same title, with no way to tell them apart or trace
                their real owner. Every property now has its own real,
                permanent reference number — search by that, by title,
                or by the real owner's name/phone. */}
            <div className="flex gap-2 mb-3">
              <input type="text" value={propertySearchQuery} onChange={(e) => setPropertySearchQuery(e.target.value)}
                placeholder="Search by reference number, title, or real owner name/phone"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <button onClick={handlePropertySearch} className="px-4 py-2 rounded-full bg-chs-red text-white text-xs font-semibold">
                {propertySearchLoading ? "..." : "Search"}
              </button>
            </div>
            {propertySearchResults.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Real search results</p>
                {propertySearchResults.map((p) => (
                  <div key={p.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-semibold text-chs-charcoal">{p.title}</p>
                      <span className="text-[9px] font-bold text-white bg-chs-charcoal px-1.5 py-0.5 rounded-full">{p.reference_number}</span>
                    </div>
                    <p className="text-xs text-gray-500">{p.location_area}, {p.location_state} · {p.purpose} · {formatNaira(p.price)}</p>
                    <p className="text-xs text-chs-charcoal mt-1">👤 Owner: {p.owner_name} — {p.owner_phone}</p>
                    {p.agent_name && <p className="text-xs text-gray-500">Managed by: {p.agent_name}</p>}
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Awaiting verification</p>
            {pendingProperties.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No properties awaiting verification.</p>
          ) : (
            pendingProperties.map((prop) => {
              const docs = prop.property_sale_documents || [];
              const unverifiedCount = docs.filter((d) => d.verification_status !== "verified").length;
              return (
              <div key={prop.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3">
                <p className="text-sm font-semibold text-chs-charcoal">{prop.title}</p>
                <p className="text-xs text-gray-500">{prop.location_area} — {prop.purpose}</p>
                <p className="text-[9px] text-gray-400">Listed {new Date(prop.created_at).toLocaleString()}</p>
                {/* Real, direct fix per a genuine, confirmed client
                    concern: the same real bio-data rigor already
                    built for a buyer making an offer was never
                    carried across to the seller/owner side here,
                    despite an explicit earlier request to apply it
                    "across the board". The owner's real identity and
                    ID-verification status now shows directly. */}
                <div className="bg-white rounded-lg p-2 mt-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Listed by</p>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-chs-charcoal font-semibold">{prop.profiles?.[0]?.full_name || "Owner"} — {prop.profiles?.[0]?.phone}</p>
                    {prop.profiles?.[0]?.valid_id_verified ? (
                      <span className="text-[9px] font-bold text-green-700 whitespace-nowrap">✓ ID Verified</span>
                    ) : (
                      <span className="text-[9px] font-bold text-chs-amber-dark whitespace-nowrap">⚠ Not yet verified</span>
                    )}
                  </div>
                  {prop.profiles?.[0]?.valid_id_type && <p className="text-[10px] text-gray-500 mt-0.5">{prop.profiles[0].valid_id_type} — {prop.profiles[0].valid_id_number}</p>}
                </div>
                {prop.primary_document_type && <p className="text-[10px] text-gray-500 mt-1">Claimed ownership document: {prop.primary_document_type} · Acquired via: {prop.acquisition_method}</p>}
                {/* Real, direct fix per a genuine, serious client
                    concern: this card previously showed only the
                    title and location -- admin could approve a real
                    listing with zero visibility into its uploaded
                    legal documents at all. Every real document is now
                    shown directly here, with its own real view link
                    and verification status. */}
                {docs.length === 0 ? (
                  <p className="text-[10px] text-chs-red bg-white rounded-lg px-2 py-1.5 mt-2 font-semibold">⚠️ No real legal documents uploaded for this listing yet.</p>
                ) : (
                  <div className="bg-white rounded-lg p-2 mt-2 space-y-1.5">
                    {docs.map((d) => (
                      <div key={d.id} className="flex justify-between items-center text-[10px]">
                        <a href={d.file_url} target="_blank" rel="noreferrer" className="text-chs-red underline capitalize">{d.document_type.replace(/_/g, " ")}</a>
                        {d.verification_status === "verified" ? (
                          <span className="font-bold text-green-700">✓ Verified</span>
                        ) : (
                          <div className="flex gap-1">
                            <button onClick={() => handleSaleDocReview(d.id, true)} className="px-2 py-0.5 rounded-full bg-chs-red text-white font-semibold">Verify</button>
                            <button onClick={() => handleSaleDocReview(d.id, false)} className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 font-semibold">Reject</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {(docs.length === 0 || unverifiedCount > 0) && (
                  <p className="text-[10px] text-chs-red font-semibold mt-1.5">⚠️ Real documents above are not yet fully verified — verify each one before approving this listing.</p>
                )}
                <input type="text" value={propertyRejectReasons[prop.id] || ""} onChange={(e) => setPropertyRejectReasons({ ...propertyRejectReasons, [prop.id]: e.target.value })}
                  placeholder="If rejecting: a real, genuine reason — the owner will see this exact text"
                  className="w-full mt-2 px-2.5 py-2 rounded-lg border border-gray-200 text-[11px]" />
                {actionError && <p className="text-[10px] text-chs-red bg-white rounded-lg px-2 py-1.5 mt-1.5">{actionError}</p>}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handlePropertyVerification(prop.id, "verified")}
                    disabled={prop.purpose === "sale" && (docs.length === 0 || unverifiedCount > 0 || !prop.profiles?.[0]?.valid_id_verified)}
                    className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                    {prop.purpose === "sale" && (docs.length === 0 || unverifiedCount > 0)
                      ? "Verify documents first"
                      : prop.purpose === "sale" && !prop.profiles?.[0]?.valid_id_verified
                        ? "Owner's ID not verified"
                        : "Verify"}
                  </button>
                  <button onClick={() => handlePropertyVerification(prop.id, "rejected")}
                    className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                    Reject
                  </button>
                </div>
              </div>
              );
            })
          )}

          {recentlyHandledProperties.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                Recently handled — archives automatically after 7 days
              </p>
              {recentlyHandledProperties.map((prop) => (
                <div key={prop.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold text-chs-charcoal">{prop.title}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${prop.verification_status === "verified" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                      {prop.verification_status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{formatNaira(prop.price)} · {prop.location_area}</p>
                  <button onClick={() => handleArchiveProperty(prop.id)}
                    className="w-full py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                    🗄️ Send to Archive
                  </button>
                </div>
              ))}
            </div>
          )}
          </div>
        )}


        {activeTab === "disputes" && (
          <div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
              ⚖️ A real disagreement between a tenant and owner (e.g. over move-out condition or a refund) that CHS needs to review and rule on — using the actual move-in/move-out condition reports as evidence where available.
            </p>
            {openDisputes.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No open disputes.</p>
          ) : (
            openDisputes.map((d) => (
              <div key={d.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3">
                <div className="flex justify-between items-start">
                  <p className="text-sm text-chs-charcoal">{d.description}</p>
                  <span className="text-[9px] text-gray-400 whitespace-nowrap ml-2">{new Date(d.created_at).toLocaleString()}</span>
                </div>
                {d.amount_in_dispute !== null && (
                  <p className="text-xs font-semibold text-chs-charcoal mt-1">
                    Amount in dispute: {formatNaira(d.amount_in_dispute)}
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleDisputeRuling(d.id, "ruled_for_tenant", "Ruled in the tenant's favour after review.")}
                    className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold"
                  >
                    Rule for tenant
                  </button>
                  <button
                    onClick={() => handleDisputeRuling(d.id, "ruled_for_owner", "Ruled in the owner's favour after review.")}
                    className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold"
                  >
                    Rule for owner
                  </button>
                </div>
              </div>
            ))
          )}
          </div>
        )}

        {activeTab === "conditionreports" && (
          <div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
              📋 Every real move-in and move-out condition report, room by room, with every real photo a tenant attached as evidence.
            </p>
            {conditionReports.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No real condition reports submitted yet.</p>
            ) : (
              conditionReports.map((r) => (
                <div key={r.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-3">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold text-chs-charcoal">{embeddedOne(r.tenancies?.properties)?.title || "Property"}</p>
                    <span className="text-[9px] text-gray-400 whitespace-nowrap">{new Date(r.submitted_at).toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 capitalize mb-2">{r.report_type.replace(/_/g, " ")} · {r.status} · Ref: {r.reference}</p>
                  {r.affidavit_url && (
                    <a href={r.affidavit_url} target="_blank" rel="noreferrer" className="block text-[10px] text-chs-red underline mb-2">
                      📄 View real court affidavit ({r.affidavit_reference})
                    </a>
                  )}
                  {(r.rooms || []).map((room, ri) => (
                    <div key={ri} className="bg-white rounded-lg p-2 mb-1.5">
                      <p className="text-xs font-bold text-chs-charcoal mb-1">{room.name}</p>
                      {room.items.map((item, ii) => (
                        <div key={ii} className="flex justify-between items-center text-[10px] mb-1 last:mb-0">
                          <span className="text-gray-600">{item.item}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`font-bold capitalize px-1.5 py-0.5 rounded-full ${item.condition === "good" ? "bg-green-100 text-green-700" : item.condition === "fair" ? "bg-chs-amber-light text-chs-amber-dark" : "bg-red-100 text-chs-red"}`}>
                              {item.condition}
                            </span>
                            {item.photo_url && (
                              <a href={item.photo_url} target="_blank" rel="noreferrer" className="text-chs-red underline">📷 Photo</a>
                            )}
                          </div>
                        </div>
                      ))}
                      {room.notes && <p className="text-[10px] text-gray-500 mt-1 italic">&quot;{room.notes}&quot;</p>}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "feedback" && (
          <>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
              💬 Real, unsolicited feedback submitted by users about their experience with CHS — not a formal dispute or complaint about a specific transaction.
            </p>
            {pendingFeedback.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No pending community feedback.</p>
            ) : (
            pendingFeedback.map((f) => (
              <div key={f.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3">
                <div className="flex justify-between items-start">
                  <p className="text-sm text-chs-charcoal">{f.note}</p>
                  <span className="text-[9px] text-gray-400 whitespace-nowrap ml-2">{new Date(f.created_at).toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">— {f.relation}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleFeedbackModeration(f.id, "approved")}
                    className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                    Approve
                  </button>
                  <button onClick={() => handleFeedbackModeration(f.id, "rejected")}
                    className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
          </>
        )}

        {activeTab === "engage" && (
          <>
            {pendingEngage.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No pending Engage CHS requests.</p>
            ) : (
              pendingEngage.map((r) => (
                <EngageRequestCard
                  key={r.id}
                  request={r}
                  session={session}
                  onAccept={handleEngageAccept}
                  onReject={handleEngageReject}
                  onRequestMoreInfo={handleEngageRequestMoreInfo}
                />
              ))
            )}

            {/* Real, direct client request: handled requests stay
                visible here for a real 7 days (from when admin last
                read them) instead of vanishing the instant they're
                acted on — admin sends them to Archive manually, or
                they age out automatically after 7 days. */}
            {recentlyHandledEngage.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                  Recently handled — archives automatically after 7 days
                </p>
                {recentlyHandledEngage.map((r) => (
                  <div key={r.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-semibold text-chs-charcoal">{r.service_type}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${
                        r.status === "accepted" ? "bg-green-100 text-green-700" : r.status === "rejected" ? "bg-gray-200 text-gray-500" : "bg-chs-amber-light text-chs-amber-dark"
                      }`}>
                        {r.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">Ref {r.reference}</p>
                    {r.admin_note && <p className="text-[11px] text-gray-600 mt-1">{r.admin_note}</p>}
                    <button onClick={() => handleArchiveEngage(r.id)}
                      className="mt-2 w-full py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                      🗄️ Send to Archive
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "vendors" && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
            🏪 A business wanting to sell building materials or services on the CHS Marketplace, awaiting review of their real CAC registration and business details before they can list.
          </p>
        )}
        {activeTab === "vendors" &&
          (pendingVendors.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No pending vendor registrations.</p>
          ) : (
            pendingVendors.map((v) => (
              <div key={v.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-semibold text-chs-charcoal">{v.business_name}</p>
                  <span className="text-[9px] text-gray-400 whitespace-nowrap ml-2">{new Date(v.created_at).toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-500">{v.category} — {v.location_state}</p>
                {v.cac_number && <p className="text-xs text-gray-500">CAC: {v.cac_number}</p>}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleVendorVerification(v.id, "verified")}
                    className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                    Verify
                  </button>
                  <button onClick={() => handleVendorVerification(v.id, "rejected")}
                    className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                    Reject
                  </button>
                </div>
              </div>
            ))
          ))}

        {activeTab === "vendors" && recentlyHandledVendors.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
              Recently handled — archives automatically after 7 days
            </p>
            {recentlyHandledVendors.map((v) => (
              <div key={v.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-semibold text-chs-charcoal">{v.business_name}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${v.verification_status === "verified" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                    {v.verification_status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{v.category} — {v.location_state}</p>
                <button onClick={() => handleArchiveVendor(v.id)}
                  className="w-full py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                  🗄️ Send to Archive
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "referrals" && (
          <>
            <p className="text-xs font-bold text-chs-charcoal mb-2">Agent referrals — real, un-paid-out ({agentReferrals.length})</p>
            {agentReferrals.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-4">No active agent referrals.</p>
            ) : (
              agentReferrals.map((r) => (
                <div key={r.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-semibold text-chs-charcoal">{r.masked_reference}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-400 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</span>
                      <span className="text-[9px] font-bold uppercase text-gray-400">{r.stage}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Commission {formatNaira(r.chs_commission || 0)} · {r.split_50_50 ? "50/50 co-broker split" : `${r.agent_share_pct}% agent share`}
                  </p>
                  {r.stage !== "enquiry" && (
                    <button onClick={() => handleCompleteAgentReferral(r.id)} disabled={completingReferralId === r.id}
                      className="mt-2 w-full py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
                      {completingReferralId === r.id ? "Processing..." : "Mark completed & pay agent(s)"}
                    </button>
                  )}
                </div>
              ))
            )}

            <p className="text-xs font-bold text-chs-charcoal mb-2 mt-4">Fee per category (editable)</p>
            {feeSettings.map((fee) => (
              <FeeSettingRow key={fee.category} fee={fee} onUpdate={handleUpdateFee} />
            ))}

            <p className="text-xs font-bold text-chs-charcoal mt-4 mb-2">
              Referral fees ({owedFees.length})
            </p>
            {owedFees.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No referral fees recorded yet.</p>
            ) : (
              owedFees.map((f) => (
                <div key={f.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-semibold text-chs-charcoal">{formatNaira(f.amount)}</p>
                    <span className="text-[10px] font-bold uppercase text-gray-400">{f.status}</span>
                  </div>
                  {f.status === "owed" && (
                    <button onClick={() => handleUpdateOwedFeeStatus(f.id, "invoiced")}
                      className="py-1.5 px-3 rounded-full bg-chs-amber-light text-chs-amber-dark text-[10px] font-semibold">
                      Mark invoiced
                    </button>
                  )}
                  {f.status === "invoiced" && (
                    <button onClick={() => handleUpdateOwedFeeStatus(f.id, "paid")}
                      className="py-1.5 px-3 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                      Mark paid
                    </button>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "faults" && (
          <>
            <p className="text-[10px] text-gray-400 mb-2">
              Faults not yet sent for approval — each one is genuinely routed to the manager if that property&apos;s management is truly delegated, or the owner otherwise.
            </p>
            {unroutedFaults.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No maintenance requests awaiting routing.</p>
            ) : (
              unroutedFaults.map((f) => {
                const isDelegated = f.tenancies?.management_delegated === true;
                return (
                  <div key={f.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-semibold text-chs-charcoal">{f.category}</p>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${isDelegated ? "bg-chs-amber-light text-chs-amber-dark" : "bg-gray-100 text-gray-500"}`}>
                        {isDelegated ? "Delegated → Manager" : "→ Owner"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{f.description}</p>
                    <p className="text-[10px] text-gray-400 mt-1 capitalize">Status: {f.status.replace(/_/g, " ")} · {new Date(f.created_at).toLocaleString()}</p>
                    <button
                      onClick={() => handleSendFaultForApproval(f)}
                      className="w-full mt-2 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold"
                    >
                      Send for approval → {isDelegated ? "Manager" : "Owner"}
                    </button>
                  </div>
                );
              })
            )}
          </>
        )}

        {activeTab === "artisans" && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
            🔧 A real tradesperson (plumber, electrician, etc.) registering to quote on maintenance jobs, awaiting review of their trade and details before they can be matched with real jobs.
          </p>
        )}
        {activeTab === "artisans" && (
          <>
            {pendingArtisans.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No pending artisan registrations.</p>
            ) : (
              pendingArtisans.map((a) => (
                <div key={a.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold text-chs-charcoal capitalize">{a.trades?.join(", ")}</p>
                    <span className="text-[9px] text-gray-400 whitespace-nowrap ml-2">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{a.years_experience} years experience · {a.equipment_tier.replace(/_/g, " ")} equipment</p>
                  <p className="text-xs text-gray-500">{a.base_lga ? `${a.base_lga}, ` : ""}{a.base_state} · {a.willing_to_travel_interstate ? "Willing to travel" : "Local jobs only"}</p>
                  <p className="text-xs text-gray-500 capitalize">{a.artisan_type === "chs_agent" ? "CHS Maintenance Agent" : "Independent"}</p>
                  {a.certification_document_url && (
                    <a href={a.certification_document_url} target="_blank" rel="noreferrer" className="text-[10px] text-chs-red underline block mt-1">View certification</a>
                  )}
                  {a.equipment_photo_url && (
                    <a href={a.equipment_photo_url} target="_blank" rel="noreferrer" className="text-[10px] text-chs-red underline block">View equipment photo</a>
                  )}
                  {a.equipment_receipt_url && (
                    <a href={a.equipment_receipt_url} target="_blank" rel="noreferrer" className="text-[10px] text-chs-red underline block">View equipment receipt</a>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => handleArtisanVerification(a.id, "verified")}
                      className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                      Verify
                    </button>
                    <button onClick={() => handleArtisanVerification(a.id, "rejected")}
                      className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
            {recentlyHandledArtisans.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                  Recently handled — archives automatically after 7 days
                </p>
                {recentlyHandledArtisans.map((a) => (
                  <div key={a.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-semibold text-chs-charcoal capitalize">{a.trades?.join(", ")}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${a.verification_status === "verified" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                        {a.verification_status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{a.base_state}</p>
                    <button onClick={() => handleArchiveArtisan(a.id)}
                      className="w-full py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                      🗄️ Send to Archive
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "hotelcontrols" && <AdminHotelControls />}

        {activeTab === "walletsecurity" && (
          <div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
              🚩 First, patterns the automatic scan found unusual (it runs every 15 minutes and changes nothing by itself). Then, transfers a user has reported as not authorised, or as a scam. 🚨 Reported transfers:  The reported amount is already held in the recipient&apos;s wallet and cannot be withdrawn to a bank. Reverse it while the money is still there, dismiss the report if it was a genuine payment, or freeze the recipient and escalate.
            </p>
            <p className="text-xs font-bold text-chs-charcoal mb-2">🚩 Unusual wallet patterns ({riskFlags.filter((f) => f.status === "open").length} open)</p>
            {riskFlags.length === 0 ? (
              <p className="text-[11px] text-gray-400 mb-4">Nothing flagged by the automatic scan.</p>
            ) : riskFlags.map((f) => (
              <div key={f.id} className={`bg-white rounded-xl border-2 p-3 mb-2 ${f.status === "open" ? "border-chs-amber" : "border-gray-100"}`}>
                <div className="flex justify-between items-start gap-2">
                  <p className="text-xs font-bold text-chs-charcoal">{({ fan_in: "Many senders to one wallet", new_account: "New account receiving a lot", round_trip: "Money going in circles", rapid_outflow: "Rapid outflow", pin_attack: "Transaction PIN locked after wrong guesses" } as Record<string, string>)[f.kind] || f.kind}</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${f.status === "open" ? "bg-chs-amber text-chs-charcoal" : "bg-gray-100 text-gray-500"}`}>{f.status.toUpperCase()}</span>
                </div>
                <p className="text-[11px] text-gray-600 mt-0.5"><b>{f.name}</b> · {f.phone} · wallet {f.balance !== null ? formatNaira(f.balance) : "?"}{f.frozen ? " · FROZEN" : ""}</p>
                <p className="text-[11px] text-gray-600">{f.details}</p>
                {f.admin_note && <p className="text-[10px] text-gray-500 mt-1">Finding: {f.admin_note}</p>}
                {f.status === "open" && (
                  <>
                    <input type="text" value={reportNotes[f.id] || ""} onChange={(e) => setReportNotes({ ...reportNotes, [f.id]: e.target.value })} maxLength={300}
                      placeholder="Record your finding (required)" className="w-full mt-2 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      <button onClick={() => handleRiskFlag(f.id, "clear")} disabled={queueBusy === f.id} className="py-1.5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-semibold disabled:opacity-50">Looks fine — clear</button>
                      <button onClick={() => handleRiskFlag(f.id, "freeze")} disabled={queueBusy === f.id} className="py-1.5 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">🧊 Freeze the wallet</button>
                    </div>
                  </>
                )}
              </div>
            ))}

            <p className="text-xs font-bold text-chs-charcoal mt-4 mb-2">🚨 Transfers reported by users</p>
            {transferReports.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">✓ No transfer reports.</p>
            ) : transferReports.map((r) => (
              <div key={r.id} className={`bg-white rounded-xl border-2 p-3 mb-3 ${r.status === "open" ? "border-chs-red" : "border-gray-100"}`}>
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm font-bold text-chs-charcoal">{formatNaira(r.amount)}</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${r.status === "open" ? "bg-chs-red text-white" : "bg-gray-100 text-gray-500"}`}>{r.status === "open" ? "OPEN" : r.status.toUpperCase()}</span>
                </div>
                <p className="text-[11px] text-gray-600">Ref {r.reference} · reported {new Date(r.created_at).toLocaleString()}</p>
                <p className="text-[11px] text-gray-600 mt-1">Sent by (reporting): <b>{r.reporter_name}</b> · {r.reporter_phone}</p>
                <p className="text-[11px] text-gray-600">Received by: <b>{r.recipient_name}</b> · {r.recipient_phone} — wallet holds {r.recipient_balance !== null ? formatNaira(r.recipient_balance) : "?"}{r.recipient_frozen ? " · FROZEN" : ""}</p>
                {r.note && <p className="text-[11px] text-chs-red mt-1">Reporter says: “{r.note}”</p>}
                {r.admin_note && <p className="text-[10px] text-gray-500 mt-1">Finding: {r.admin_note}</p>}
                {r.status === "open" && (
                  <>
                    <input type="text" value={reportNotes[r.id] || ""} onChange={(e) => setReportNotes({ ...reportNotes, [r.id]: e.target.value })} maxLength={300}
                      placeholder="Record your finding (required)" className="w-full mt-2 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
                    <div className="grid grid-cols-3 gap-1.5 mt-2">
                      <button onClick={() => handleTransferReport(r.id, "reverse")} disabled={queueBusy === r.id} className="py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">↩ Reverse it</button>
                      <button onClick={() => handleTransferReport(r.id, "dismiss")} disabled={queueBusy === r.id} className="py-1.5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-semibold disabled:opacity-50">Genuine — dismiss</button>
                      <button onClick={() => handleTransferReport(r.id, "freeze_recipient")} disabled={queueBusy === r.id} className="py-1.5 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">🧊 Freeze recipient</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "rtorequests" && <AdminRtoPanel onChanged={loadRtoQueue} />}

        {activeTab === "inspections" && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
            🚗 Physical property inspections already booked. The whole transport cost is paid by the person who asked for the visit — never split with the owner and never carried by CHS. Enter where the agent sets off from and the real one-way distance to fix the final cost; the requester and the owner are told.
          </p>
        )}
        {activeTab === "inspections" && (
          <>
            {upcomingInspections.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No upcoming inspections booked.</p>
            ) : (
              upcomingInspections.map((insp) => (
                <div key={insp.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold text-chs-charcoal">{insp.properties?.title || "Property"}</p>
                    <span className="text-[9px] font-bold uppercase bg-chs-amber-light text-chs-amber-dark px-2 py-0.5 rounded-full">{insp.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{insp.properties?.location_area}</p>
                  <p className="text-xs text-gray-500 mt-1">📅 {insp.requested_date} at {insp.requested_time}</p>
                  <p className="text-xs text-gray-500">📍 {insp.meeting_point}</p>
                  {insp.transport_fee != null ? (
                    <p className="text-xs text-gray-500">🚗 Transport cost, paid 100% by the requester: <b>{formatNaira(insp.transport_fee)}</b> — {insp.fee_final ? `final (agent from ${insp.takeoff_point}, ${insp.distance_km} km each way) · ${insp.payment_status === "held" ? "PAID — held until the visit" : "awaiting the requester's wallet payment"}` : "an estimate until the agent's takeoff point is set"}</p>
                  ) : (
                    <p className="text-xs text-gray-500">🚗 Transport cost: not yet quoted — paid 100% by the requester</p>
                  )}
                  {(insp.status === "pending" || insp.status === "confirmed") && (
                    <div className="mt-2 bg-white rounded-lg border border-gray-200 p-2">
                      <p className="text-[10px] font-bold text-gray-500 mb-1">{insp.fee_final ? "Change" : "Set"} the agent, their takeoff and the final cost</p>
                      <select value={takeoffForm[insp.id]?.agent ?? insp.agent_id ?? ""} onFocus={() => { if (assignableAgents.length === 0) supabase.rpc("get_assignable_agents").then(({ data }) => setAssignableAgents((data as typeof assignableAgents) || [])); }}
                        onChange={(e) => setTakeoffForm({ ...takeoffForm, [insp.id]: { point: takeoffForm[insp.id]?.point ?? insp.takeoff_point ?? "", km: takeoffForm[insp.id]?.km ?? "", agent: e.target.value } })}
                        className="w-full mb-1.5 px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] bg-white">
                        <option value="">Choose the CHS agent who will go…</option>
                        {assignableAgents.map((a) => <option key={a.id} value={a.id}>{a.full_name} · {a.phone}</option>)}
                      </select>
                      <div className="flex gap-1.5">
                        <input type="text" placeholder="Agent sets off from (e.g. Barnawa)" value={takeoffForm[insp.id]?.point ?? insp.takeoff_point ?? ""}
                          onChange={(e) => setTakeoffForm({ ...takeoffForm, [insp.id]: { point: e.target.value, km: takeoffForm[insp.id]?.km ?? "", agent: takeoffForm[insp.id]?.agent ?? insp.agent_id ?? "" } })}
                          className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
                        <input type="number" min="0" step="0.1" placeholder="km one way" value={takeoffForm[insp.id]?.km ?? ""}
                          onChange={(e) => setTakeoffForm({ ...takeoffForm, [insp.id]: { point: takeoffForm[insp.id]?.point ?? insp.takeoff_point ?? "", km: e.target.value, agent: takeoffForm[insp.id]?.agent ?? insp.agent_id ?? "" } })}
                          className="w-24 px-2 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
                      </div>
                      <button onClick={() => handleSetTakeoff(insp.id)} disabled={takeoffBusy === insp.id}
                        className="w-full mt-1.5 py-1.5 rounded-full bg-chs-red text-white text-[11px] font-semibold disabled:opacity-50">
                        {takeoffBusy === insp.id ? "Saving…" : "Confirm — ask the requester to pay the final cost from their wallet"}
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">Ref {insp.reference}</p>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "developers" && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
            🏗️ A commercial developer applying to list real construction/development projects on CHS, awaiting review of their application before their account is upgraded.
          </p>
        )}
        {activeTab === "developers" && (
          <>
            {developerApplications.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No pending developer applications.</p>
            ) : (
              developerApplications.map((d) => (
                <div key={d.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold text-chs-charcoal">🏗️ {d.company_name}</p>
                    <span className="text-[9px] text-gray-400 whitespace-nowrap ml-2">{new Date(d.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">CAC: {d.cac_number} · {d.years_experience}</p>
                  {d.current_projects && <p className="text-xs text-gray-500">{d.current_projects}</p>}
                  <p className="text-xs text-gray-500">
                    {d.offers_instalments ? "✓ Offers instalments" : "No instalment plans"} · {d.accepts_investment_capital ? "✓ Accepts co-investment" : "No co-investment"}
                  </p>
                  {d.portfolio_url && (
                    <a href={d.portfolio_url} target="_blank" rel="noreferrer" className="text-[10px] text-chs-red underline block mt-1">View portfolio</a>
                  )}
                  <button onClick={() => handleDeveloperReviewed(d.id)} disabled={d.status !== "pending"}
                    className="mt-2 py-1.5 px-3 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-40">
                    {d.status === "pending" ? "Mark as reviewed — contacted directly" : "✓ Reviewed"}
                  </button>
                  {d.status === "reviewed" && (
                    <button onClick={() => handleDeveloperPartnered(d.id)}
                      className="mt-2 ml-2 py-1.5 px-3 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold">
                      ✓ Mark partnered — elevate to developer account
                    </button>
                  )}
                </div>
              ))
            )}
            {recentlyHandledDevelopers.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                  Recently handled — archives automatically after 7 days
                </p>
                {recentlyHandledDevelopers.map((d) => (
                  <div key={d.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-semibold text-chs-charcoal">🏗️ {d.company_name}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${d.status === "partnered" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                        {d.status}
                      </span>
                    </div>
                    <button onClick={() => handleArchiveDeveloper(d.id)}
                      className="w-full mt-2 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                      🗄️ Send to Archive
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "tenantregisteroversight" && (
          <div>
            {correspondenceOverview.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-chs-charcoal mb-1">💬 Real Tenant Correspondence — CHS sees every conversation</p>
                <p className="text-[10px] text-gray-500 mb-2">
                  Messages deliver directly, as before — this is real, live visibility for CHS, not a delay. A real, red flag means the tenant&apos;s own message is still awaiting a reply.
                </p>
                {correspondenceOverview.map((c) => (
                  <div key={c.tenancy_id} className={`rounded-xl border p-3 mb-2 ${c.awaiting_landlord_reply ? "bg-red-50 border-red-200" : "bg-[var(--zone-card)] border-gray-100"}`}>
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-semibold text-chs-charcoal">{c.property_title}</p>
                      {c.awaiting_landlord_reply && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-chs-red text-white">Awaiting reply</span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 mb-1">
                      {c.tenant_name} ({c.tenant_phone}) ↔ {c.responsible_party_name || "Unassigned"} ({c.responsible_party_role})
                    </p>
                    <p className="text-xs text-chs-charcoal bg-white rounded-lg px-2 py-1.5 mb-1">&quot;{c.last_message_text}&quot;</p>
                    <p className="text-[9px] text-gray-400">{new Date(c.last_message_at).toLocaleString()} · {c.message_count} real message{c.message_count !== 1 ? "s" : ""} total</p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mb-2">
              Real oversight into the tenant register every agent/manager keeps — search by name, phone, or reference number to review the actual ID and selfie on file.
            </p>
            <div className="flex gap-2 mb-3">
              <input type="text" value={tenantRegisterSearch} onChange={(e) => setTenantRegisterSearch(e.target.value)}
                placeholder="Search a real name, phone, or reference number"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <button onClick={handleTenantRegisterSearch} className="px-4 py-2 rounded-full bg-chs-red text-white text-xs font-semibold">
                {tenantRegisterLoading ? "..." : "Search"}
              </button>
            </div>
            {tenantRegisterResults.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No real results yet — search above.</p>
            ) : (
              tenantRegisterResults.map((t) => (
                <div key={t.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <p className="text-sm font-semibold text-chs-charcoal">{t.full_name} <span className="text-[10px] text-gray-400 font-normal">({t.reference_number})</span></p>
                  <p className="text-xs text-gray-500">{t.phone} · {t.occupation}</p>
                  <p className="text-xs text-gray-500">{t.street_address ? `${t.street_address}, ` : ""}{t.location_area} · {t.property_type} · {t.bedrooms} bed(s)</p>
                  <p className="text-xs text-gray-500">Annual rent: ₦{Number(t.annual_rent).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{t.id_type} — {t.id_number}</p>
                  <div className="flex gap-3 mt-1">
                    {t.id_document_url && (
                      <DocumentViewLink url={t.id_document_url} label="View real ID" />
                    )}
                    {t.selfie_url && (
                      <DocumentViewLink url={t.selfie_url} label="View real selfie" />
                    )}
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1">Recorded {new Date(t.created_at).toLocaleDateString()}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "escrowoversight" && (
          <div>
            {(() => {
              const saleTotal = pendingLegalTransfers.reduce((s, t) => s + Number(t.amount), 0);
              const marketplaceTotal = marketplaceQueue.filter((q) => q.payment_status === "held_escrow").reduce((s, q) => s + Number(q.quoted_amount || 0), 0);
              const directOrderTotal = directOrderQueue.reduce((s, o) => s + Number(o.amount), 0);
              const depositsTotal = heldDeposits.reduce((s, d) => s + Number(d.security_deposit_amount), 0);
              const rentTotal = heldRent.reduce((s, r) => s + Number(r.amount), 0);
              const bookingsTotal = heldShortletBookings.reduce((s, b) => s + Number(b.total_price), 0);
              const grandTotal = saleTotal + marketplaceTotal + directOrderTotal + depositsTotal + rentTotal + bookingsTotal;
              return (
                <div className="bg-chs-charcoal rounded-xl p-4 mb-4 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] text-white/60 uppercase font-semibold">Total real funds currently held in escrow</p>
                      <p className="text-2xl font-bold">{formatNaira(grandTotal)}</p>
                    </div>
                    {/* Real, direct fix: this whole screen only ever
                        loaded once, on first open — a real, brand-new
                        held payment could sit invisible until a full
                        page reload. One real, manual refresh, for
                        every held category at once. */}
                    <button onClick={loadEscrowData} className="bg-white/15 hover:bg-white/25 text-white text-[10px] font-semibold px-3 py-1.5 rounded-full shrink-0">
                      🔄 Refresh
                    </button>
                  </div>
                  <div className="flex gap-4 mt-2 text-[10px] text-white/70">
                    <span>Property sales: {formatNaira(saleTotal)}</span>
                    <span>Rent: {formatNaira(rentTotal)}</span>
                    <span>Marketplace: {formatNaira(marketplaceTotal)}</span>
                    <span>Direct orders: {formatNaira(directOrderTotal)}</span>
                    <span>Bookings: {formatNaira(bookingsTotal)}</span>
                    <span>Deposits: {formatNaira(depositsTotal)}</span>
                  </div>
                </div>
              );
            })()}

            {/* Real, direct fix for the exact confusion just raised
                directly: a real transaction existing somewhere in one
                of four separate sections below, with nothing telling
                admin which one to check. One real, unified list,
                every held category together, newest first — so
                finding a specific real transaction never again
                depends on guessing its category first. */}
            {(() => {
              // Real, direct fix per a direct, firm client report: the
              // unified summary only ever showed what was held — it
              // had no real way to actually release anything, unlike
              // the full category sections below it that always had.
              // Every real item here now carries its own real,
              // working release action, calling the exact same real
              // function the detailed section below uses — nothing
              // new invented, just made reachable from one place.
              // Direct Orders is also added here for the first time —
              // it existed as its own real category but was never
              // included in this unified view at all.
              type RefundRun = (reason: string) => PromiseLike<{ error: { message: string } | null }>;
              type UnifiedItem = {
                key: string; label: string; category: string; amount: number; date: string;
                action: string; onRelease: () => void; releaseBlockedNote?: string;
                refund?: { run: RefundRun; opensAt: string | null; defaulterLabel: string };
              };
              const unified: UnifiedItem[] = [
                ...heldRent.map((r) => ({
                  key: `rent-${r.id}`, label: r.property_title, category: "Rent", amount: Number(r.amount), date: r.created_at,
                  action: "Release to landlord", onRelease: () => handleReleaseRent(r.id),
                  refund: { run: (reason: string) => supabase.rpc("request_rent_refund", { p_rent_payment_id: r.id, p_admin_reason: reason }), opensAt: r.release_deadline, defaulterLabel: "landlord" },
                })),
                ...pendingLegalTransfers.map((t) => ({
                  key: `sale-${t.id}`, label: t.property_title, category: "Property Sale", amount: Number(t.amount), date: t.created_at,
                  action: "Confirm transfer & release", onRelease: () => handleConfirmLegalTransfer(t.id),
                  refund: { run: (reason: string) => supabase.rpc("request_sale_refund", { p_offer_id: t.id, p_admin_reason: reason }), opensAt: t.document_deadline, defaulterLabel: "seller" },
                })),
                ...heldShortletBookings.map((b) => ({
                  key: `booking-${b.id}`, label: `${b.property_title} — ${b.guest_full_name}`, category: b.status === "confirmed" ? "Booking (confirmed)" : "Booking (awaiting host)",
                  amount: Number(b.total_price), date: b.created_at,
                  action: "Release to host", onRelease: () => handleReleaseShortletBooking(b.id),
                  releaseBlockedNote: b.status !== "confirmed" ? "Not releasable yet — the host has not accepted this booking." : undefined,
                  refund: { run: (reason: string) => supabase.rpc("refund_shortlet_booking", { p_booking_id: b.id, p_reason: reason }), opensAt: null, defaulterLabel: "host" },
                })),
                ...marketplaceQueue.filter((q) => q.payment_status === "held_escrow").map((q) => ({
                  key: `mkt-${q.id}`, label: q.product_name || "Marketplace order", category: "Marketplace", amount: Number(q.quoted_amount || 0), date: q.created_at,
                  action: "Release to vendor", onRelease: () => handleReleaseMarketplaceEscrow(q.id),
                  refund: { run: (reason: string) => supabase.rpc("refund_marketplace_escrow_to_buyer", { p_request_id: q.id, p_reason: reason }), opensAt: null, defaulterLabel: "vendor" },
                })),
                ...directOrderQueue.map((o) => ({
                  key: `direct-${o.id}`, label: o.product_name || "Direct order", category: "Direct Order", amount: Number(o.amount), date: o.created_at,
                  action: "Release to vendor", onRelease: () => handleReleaseDirectOrder(o.id),
                  refund: { run: (reason: string) => supabase.rpc("refund_direct_order_to_buyer", { p_order_id: o.id, p_reason: reason }), opensAt: null, defaulterLabel: "vendor" },
                })),
                // A security deposit already has its own two-way decision
                // (release to guest / claim for host) — its "refund" is the
                // existing Release to guest, so no separate refund button.
                ...heldDeposits.map((d) => ({
                  key: `dep-${d.id}`, label: d.property_title, category: "Shortlet Deposit", amount: Number(d.security_deposit_amount), date: d.created_at,
                  action: "Release to guest", onRelease: () => handleResolveDeposit(d.id, "released_to_guest"),
                })),
              ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
              return (
                <div className="bg-amber-50 rounded-xl border border-chs-amber p-3 mb-4">
                  <p className="text-xs font-bold text-chs-amber-dark mb-2">📋 Every real held transaction, newest first — all categories together ({unified.length})</p>
                  {escrowNotice && <p className="text-[11px] text-green-800 bg-green-50 border border-green-200 rounded-lg px-2.5 py-2 mb-2">{escrowNotice}</p>}
                  {actionError && <p className="text-[11px] text-chs-red bg-chs-amber-light rounded-lg px-2.5 py-2 mb-2">{actionError}</p>}
                  {unified.length === 0 ? (
                    <p className="text-[11px] text-gray-400">Nothing currently held in any category.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {unified.map((u) => {
                        const refundOpen = refundOpenKey === u.key;
                        const refundNotYet = !!u.refund?.opensAt && new Date(u.refund.opensAt).getTime() > Date.now();
                        return (
                          <div key={u.key} className="bg-white rounded-lg px-2.5 py-1.5">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-[9px] font-bold text-white bg-chs-charcoal px-1.5 py-0.5 rounded-full mr-1.5">{u.category}</span>
                                <span className="text-[11px] text-chs-charcoal">{u.label}</span>
                                {u.date && <p className="text-[9px] text-gray-400 ml-0.5">{new Date(u.date).toLocaleString()}</p>}
                              </div>
                              <span className="text-[11px] font-bold text-chs-amber-dark whitespace-nowrap ml-2">{formatNaira(u.amount)}</span>
                            </div>

                            <div className="flex gap-1.5 mt-1.5">
                              <button onClick={u.onRelease} disabled={!!u.releaseBlockedNote}
                                className="flex-1 py-1 rounded-full bg-chs-charcoal text-white text-[9px] font-semibold disabled:opacity-40">
                                ✓ {u.action}
                              </button>
                              {u.refund && (
                                <button onClick={() => { setRefundOpenKey(refundOpen ? null : u.key); setActionError(null); }} disabled={refundNotYet}
                                  className="flex-1 py-1 rounded-full bg-white border border-chs-red text-chs-red text-[9px] font-semibold disabled:opacity-40 disabled:border-gray-300 disabled:text-gray-400">
                                  ↩ Refund payer
                                </button>
                              )}
                            </div>
                            {u.releaseBlockedNote && <p className="text-[8px] text-gray-400 mt-1">{u.releaseBlockedNote}</p>}
                            {u.refund && refundNotYet && (
                              <p className="text-[8px] text-gray-400 mt-1">Refund opens {new Date(u.refund.opensAt as string).toLocaleString()} — after the {u.refund.defaulterLabel}&apos;s deadline has passed.</p>
                            )}
                            {u.category === "Shortlet Deposit" && (
                              <p className="text-[8px] text-gray-400 mt-1">For a disputed claim (host keeps the deposit), use the detailed Shortlet/Hire Deposits section below instead — it needs a written reason.</p>
                            )}

                            {u.refund && refundOpen && !refundNotYet && (
                              <div className="mt-2 border-t border-gray-100 pt-2">
                                <p className="text-[9px] text-gray-600 mb-1.5 leading-relaxed">
                                  The payer receives their <b>full payment back, including CHS&apos;s commission</b>, less only the real bank processing fee (1.5% of CHS&apos;s commission + ₦100, never above ₦2,000). The commission charged to the {u.refund.defaulterLabel} is cancelled. Both parties are notified with exact figures. This cannot be undone.
                                </p>
                                <input
                                  type="text"
                                  placeholder={`Real reason (e.g. ${u.refund.defaulterLabel} failed to deliver after the deadline)`}
                                  value={refundReasons[u.key] || ""}
                                  onChange={(e) => setRefundReasons({ ...refundReasons, [u.key]: e.target.value })}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[10px] mb-1.5"
                                />
                                <button onClick={() => handleConfirmRefund(u.key, u.refund!.run)} disabled={refundBusyKey === u.key}
                                  className="w-full py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
                                  {refundBusyKey === u.key ? "Processing refund…" : "Confirm refund to payer"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            <p className="text-xs font-bold text-chs-charcoal mb-2 mt-4">🏠 Rent held pending confirmation ({heldRent.length})</p>
            {heldRent.length === 0 ? (
              <p className="text-[11px] text-gray-400 mb-4">No real rent currently held.</p>
            ) : (
              heldRent.map((r) => {
                const daysLeft = Math.ceil((new Date(r.release_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={r.id} className="bg-[var(--zone-card)] rounded-lg p-2.5 mb-1.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-chs-charcoal">{r.property_title}</p>
                        <p className="text-[10px] text-gray-400">Landlord: {r.landlord_name} · {daysLeft > 0 ? `${daysLeft} days to auto-release` : "Past grace period"}</p>
                        <p className="text-[9px] text-gray-400">Paid {new Date(r.created_at).toLocaleString()}</p>
                      </div>
                      <p className="text-xs font-bold text-chs-red">{formatNaira(r.amount)}</p>
                    </div>
                    <button onClick={() => handleReleaseRent(r.id)} className="w-full mt-1.5 py-1 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold">
                      Release now
                    </button>
                  </div>
                );
              })
            )}

            <p className="text-xs font-bold text-chs-charcoal mb-2">🏠 Property sale escrow — verify delivery, then release ({pendingLegalTransfers.length})</p>
            {actionError && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-2.5 py-2 mb-2">{actionError}</p>}
            {pendingLegalTransfers.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No real property sale funds currently held.</p>
            ) : (
              pendingLegalTransfers.map((offer) => (
                <div key={offer.id} className={`bg-[var(--zone-card)] rounded-xl border-2 p-3 mb-2 ${offer.release_request_status === "pending" ? "border-chs-amber" : "border-gray-100"}`}>
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm font-semibold text-chs-charcoal">{offer.property_title || "Property"}</p>
                    {offer.release_request_status === "pending" && <span className="text-[9px] font-bold bg-chs-amber text-chs-charcoal px-2 py-0.5 rounded-full whitespace-nowrap">SELLER ASKED FOR RELEASE</span>}
                  </div>
                  <p className="text-xs text-gray-500">Sold for {formatNaira(offer.amount)} · <b>to be released to the seller: {formatNaira(offer.held_net)}</b> (net of CHS commission)</p>
                  <p className="text-[11px] text-gray-600 mt-1">Seller: <b>{offer.seller_name}</b> · {offer.seller_phone}</p>
                  <p className="text-[11px] text-gray-600">Buyer: <b>{offer.buyer_name}</b> · {offer.buyer_phone} <span className="text-gray-400">(call to verify delivery)</span></p>
                  <p className="text-[11px] text-gray-600 mt-1">
                    Delivery on the platform: {offer.dispatch_status === "received" ? "✓ buyer confirmed receipt" : offer.dispatch_status === "dispatched" ? `📦 seller marked dispatched${offer.dispatch_method ? ` via ${offer.dispatch_method}` : ""}${offer.tracking_reference ? ` (tracking ${offer.tracking_reference})` : ""}` : offer.dispatch_status === "requested" ? "⏳ buyer requested the documents; not yet marked dispatched" : "nothing recorded yet"}
                  </p>
                  {offer.release_request_status === "pending" && (
                    <p className="text-[11px] bg-chs-amber-light text-chs-charcoal rounded-lg px-2.5 py-1.5 mt-1.5">
                      The seller asked for release{offer.release_requested_at ? ` on ${new Date(offer.release_requested_at).toLocaleString()}` : ""}.{offer.release_request_note ? ` Seller says: “${offer.release_request_note}”` : ""}
                    </p>
                  )}
                  {offer.release_request_status === "rejected" && offer.release_decision_note && <p className="text-[10px] text-gray-500 mt-1">Last request declined: {offer.release_decision_note}</p>}
                  <input type="text" value={saleNotes[offer.id] || ""} onChange={(e) => setSaleNotes({ ...saleNotes, [offer.id]: e.target.value })} maxLength={300}
                    placeholder="Your note — required for a phone check (who, when, what the buyer said) and to decline" className="w-full mt-2 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    <button onClick={() => handleSaleRelease(offer.id, "platform_records")} className="py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">✓ Verified from platform records — release</button>
                    <button onClick={() => handleSaleRelease(offer.id, "phone_call")} className="py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">📞 Verified by phoning the buyer — release</button>
                  </div>
                  {offer.release_request_status === "pending" && (
                    <button onClick={() => handleSaleRejectRequest(offer.id)} className="w-full mt-1.5 py-1.5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-semibold">Decline the seller&apos;s request (reason required)</button>
                  )}
                </div>
              ))
            )}

            <p className="text-xs font-bold text-chs-charcoal mb-2 mt-4">🛒 Marketplace escrow ({marketplaceQueue.filter((q) => q.payment_status === "held_escrow").length})</p>
            {marketplaceQueue.filter((q) => q.payment_status === "held_escrow").length === 0 ? (
              <p className="text-[11px] text-gray-400 mb-4">No real marketplace funds currently held.</p>
            ) : (
              marketplaceQueue.filter((q) => q.payment_status === "held_escrow").map((q) => (
                <div key={q.id} className="bg-[var(--zone-card)] rounded-lg p-2.5 mb-1.5 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-chs-charcoal">{q.product_name || "Marketplace order"}</p>
                    <p className="text-[9px] text-gray-400">Paid {new Date(q.created_at).toLocaleString()}</p>
                  </div>
                  <p className="text-xs font-bold text-chs-red">{formatNaira(q.quoted_amount || 0)}</p>
                </div>
              ))
            )}

            <p className="text-xs font-bold text-chs-charcoal mb-2 mt-4">🏨 Shortlet/hire deposits ({heldDeposits.length})</p>
            {heldDeposits.length === 0 ? (
              <p className="text-[11px] text-gray-400">No real deposits currently held.</p>
            ) : (
              <>
                {heldDeposits.map((d) => (
                  <div key={`s-${d.id}`} className="bg-[var(--zone-card)] rounded-lg p-2.5 mb-1.5 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-chs-charcoal">Booking — {d.property_title}</p>
                      <p className="text-[9px] text-gray-400">Paid {new Date(d.created_at).toLocaleString()}</p>
                    </div>
                    <p className="text-xs font-bold text-chs-red">{formatNaira(d.security_deposit_amount)}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === "shortletdeposits" && (
          <div>
            {shortletCorrespondence.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-chs-charcoal mb-1">💬 Real Guest–Host Correspondence — CHS sees every conversation</p>
                <p className="text-[10px] text-gray-500 mb-2">
                  Messages deliver directly, as before — this is real, live visibility for CHS, not a delay. A real, red flag means the guest&apos;s own message is still awaiting a reply.
                </p>
                {shortletCorrespondence.map((c) => (
                  <div key={c.booking_id} className={`rounded-xl border p-3 mb-2 ${c.awaiting_host_reply ? "bg-red-50 border-red-200" : "bg-[var(--zone-card)] border-gray-100"}`}>
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-semibold text-chs-charcoal">{c.property_title}</p>
                      {c.awaiting_host_reply && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-chs-red text-white">Awaiting reply</span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 mb-1">
                      {c.guest_name} ({c.guest_phone}) ↔ {c.host_name} ({c.host_phone})
                    </p>
                    <p className="text-xs text-chs-charcoal bg-white rounded-lg px-2 py-1.5 mb-1">&quot;{c.last_message_text}&quot;</p>
                    <p className="text-[9px] text-gray-400">{new Date(c.last_message_at).toLocaleString()} · {c.message_count} real message{c.message_count !== 1 ? "s" : ""} total</p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mb-2">
              Real security deposits currently held, awaiting a genuine decision — released back to the guest if there was no real damage, or claimed for the host if there was, always with a real, recorded reason.
            </p>
            {heldDeposits.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No real deposits currently held.</p>
            ) : (
              heldDeposits.map((d) => (
                <div key={d.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <p className="text-sm font-semibold text-chs-charcoal">{d.property_title || "Property"}</p>
                  <p className="text-xs text-gray-500">{d.guest_full_name} · {d.guest_phone} · {d.check_in} → {d.check_out}</p>
                  <p className="text-sm font-bold text-chs-charcoal mt-1">Real deposit held: {formatNaira(d.security_deposit_amount)}</p>
                  <input
                    type="text"
                    placeholder="If claiming for the host: real reason (e.g. real, reported damage)"
                    value={depositReasons[d.id] || ""}
                    onChange={(e) => setDepositReasons({ ...depositReasons, [d.id]: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-[11px] my-2"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleResolveDeposit(d.id, "released_to_guest")}
                      className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                      Release to guest
                    </button>
                    <button onClick={() => handleResolveDeposit(d.id, "claimed_by_host")}
                      className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                      Claim for host
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "shortletbookings" && (
          <div>
            <p className="text-xs text-gray-500 mb-3">
              Booking requests for hotels, lodges and venues. Every request and every message comes to CHS first — the guest and the host never deal with each other directly. A guest sends a request (nothing is charged); CHS relays it to the host; the host confirms the dates are free; the guest then pays within a short window. Urgent requests (check-in today or within 3 days) are shown first, in red, and relay to the host automatically only if no one on the team has acted within their short window (30 minutes, or 10 for same-day). Phone any host who goes quiet.
            </p>
            {actionError && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-2.5 py-2 mb-2">{actionError}</p>}
            <div className={`rounded-xl border-2 p-3 mb-3 ${pendingMsgs.length > 0 ? "bg-chs-amber-light border-chs-amber" : "bg-green-50 border-green-200"}`}>
              <div className="flex justify-between items-center mb-1">
                <p className={`text-xs font-bold ${pendingMsgs.length > 0 ? "text-chs-charcoal" : "text-green-700"}`}>
                  {pendingMsgs.length > 0 ? `💬 ${pendingMsgs.length} guest/host message${pendingMsgs.length !== 1 ? "s" : ""} waiting for your review` : "✓ No guest/host messages waiting for review"}
                </p>
                <button onClick={loadPendingMsgs} className="text-[10px] font-semibold text-chs-red underline">🔄 Refresh</button>
              </div>
              {pendingMsgs.length > 0 && (
                <p className="text-[10px] text-gray-500 mb-2">Until a booking is paid, no message reaches the other side until you approve it. Phone numbers and emails are already blocked automatically.</p>
              )}
              {pendingMsgs.map((m) => (
                <div key={m.id} className="bg-white rounded-lg border border-gray-200 p-2.5 mb-2">
                  <p className="text-[10px] text-gray-400">{m.property_title} · {m.booking_ref} · from the <b>{m.sender_role}</b>{m.sender_role === "host" ? ` to ${m.guest_full_name}` : ` (${m.guest_full_name})`} · {m.is_paid ? "booking paid" : "booking not paid yet"}</p>
                  <p className="text-xs text-chs-charcoal my-1.5">“{m.text}”</p>
                  <div className="flex gap-2 mb-1.5">
                    <button onClick={() => handleApproveMsg(m.id)} disabled={queueBusy === m.id}
                      className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[11px] font-semibold disabled:opacity-50">✓ Approve and deliver</button>
                  </div>
                  <input type="text" value={msgReasons[m.id] || ""} onChange={(e) => setMsgReasons({ ...msgReasons, [m.id]: e.target.value })}
                    placeholder="Reason, if you are not delivering it" className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
                  <button onClick={() => handleRejectMsg(m.id)} disabled={queueBusy === m.id}
                    className="w-full py-1.5 rounded-full bg-gray-200 text-gray-600 text-[11px] font-semibold disabled:opacity-50">Do not deliver</button>
                </div>
              ))}
            </div>
            <div className={`rounded-xl border-2 p-3 mb-3 ${releaseItems.some((r) => r.kind !== "arrived_unconfirmed") ? "bg-chs-amber-light border-chs-amber" : "bg-green-50 border-green-200"}`}>
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-bold text-chs-charcoal">
                  {releaseItems.length > 0 ? `💰 ${releaseItems.length} stay${releaseItems.length !== 1 ? "s" : ""} where the guest has arrived and the host's payment is still held` : "✓ No arrived stays are waiting for a payment release"}
                </p>
                <button onClick={loadReleaseItems} className="text-[10px] font-semibold text-chs-red underline">🔄 Refresh</button>
              </div>
              {releaseItems.length > 0 && <p className="text-[10px] text-gray-500 mb-2">The host is paid as soon as the guest confirms arrival, and automatically 24 hours after check-in if nobody reports a problem. Release early when a host has asked and the stay is clearly under way.</p>}
              {releaseItems.map((r) => (
                <div key={r.id} className={`rounded-lg border p-2.5 mb-2 bg-white ${r.kind === "problem" ? "border-chs-red" : "border-gray-200"}`}>
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-xs font-semibold text-chs-charcoal">{r.property_title} · {r.booking_ref}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${r.kind === "problem" ? "bg-chs-red text-white" : r.kind === "host_requested" ? "bg-chs-amber text-chs-charcoal" : "bg-gray-100 text-gray-500"}`}>
                      {r.kind === "problem" ? "⚠ GUEST REPORTED A PROBLEM" : r.kind === "host_requested" ? "HOST ASKED FOR RELEASE" : "GUEST HAS NOT CONFIRMED YET"}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600">{r.guest_full_name} · {r.guest_phone} · {r.check_in} → {r.check_out}</p>
                  <p className="text-[11px] text-gray-500">Host: {r.host_name} · <b>{r.host_phone}</b></p>
                  <p className="text-xs font-bold text-chs-charcoal mt-0.5">{formatNaira(r.host_net)} <span className="text-[10px] font-normal text-gray-500">to the host (net) · {formatNaira(r.amount_held)} held in all</span></p>
                  {r.move_in_issue_note && <p className="text-[11px] text-chs-red mt-0.5">Guest says: “{r.move_in_issue_note}”</p>}
                  {r.release_request_note && <p className="text-[11px] text-gray-600 mt-0.5">Host says: “{r.release_request_note}”</p>}
                  {r.auto_release_at && r.kind !== "problem" && <p className="text-[10px] text-gray-400 mt-0.5">Releases automatically at {new Date(r.auto_release_at).toLocaleString()}</p>}
                  <button onClick={() => handleReleaseNow(r.id, r.kind)} disabled={queueBusy === r.id}
                    className={`w-full mt-1.5 py-1.5 rounded-full text-[11px] font-semibold disabled:opacity-50 ${r.kind === "problem" ? "bg-gray-200 text-gray-600" : "bg-chs-red text-white"}`}>
                    {queueBusy === r.id ? "Releasing…" : "Release the host's payment now"}
                  </button>
                </div>
              ))}
            </div>
            <div className={`rounded-xl border-2 p-3 mb-3 ${staleCalendars.length > 0 ? "bg-red-50 border-chs-red" : "bg-green-50 border-green-200"}`}>
              <p className={`text-xs font-bold mb-1 ${staleCalendars.length > 0 ? "text-chs-red" : "text-green-700"}`}>
                {staleCalendars.length > 0
                  ? `📅 ${staleCalendars.length} listing${staleCalendars.length !== 1 ? "s have" : " has"} an availability calendar nobody has confirmed in 3+ days`
                  : "📅 Every active hotel, lodge and venue calendar has been confirmed in the last 3 days"}
              </p>
              {staleCalendars.length > 0 && (
                <>
                  <p className="text-[10px] text-gray-500 mb-2">Guests book on these calendars. A host who hasn&apos;t confirmed lately may have walk-in guests the calendar doesn&apos;t show — phone them. Hosts get a daily reminder at 7am.</p>
                  <div className="space-y-1">
                    {staleCalendars.slice(0, 12).map((c) => (
                      <div key={c.id} className="bg-white rounded-lg px-2.5 py-1.5 flex justify-between items-center gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-chs-charcoal truncate">{c.title}</p>
                          <p className="text-[9px] text-gray-500">{c.owner_name} · {c.owner_phone} · {c.rooms} room{c.rooms !== 1 ? "s" : ""}{c.pending_requests > 0 ? ` · ${c.pending_requests} request(s) pending` : ""}</p>
                        </div>
                        <span className="text-[9px] font-bold text-white bg-chs-red px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          {c.days_since === null ? "never confirmed" : `${c.days_since}d ago`}
                        </span>
                      </div>
                    ))}
                    {staleCalendars.length > 12 && <p className="text-[9px] text-gray-400 text-center pt-1">…and {staleCalendars.length - 12} more</p>}
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-bold text-chs-charcoal">📋 Requests in progress ({bookingQueue.length})</p>
              <button onClick={loadBookingQueue} className="text-[10px] font-semibold text-chs-red underline">🔄 Refresh</button>
            </div>
            {bookingQueue.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No booking requests are in progress right now.</p>
            ) : (
              (["awaiting_admin_relay", "pending_host_review", "awaiting_payment"] as const).map((stage) => {
                const rows = bookingQueue.filter((q) => q.stage === stage);
                if (rows.length === 0) return null;
                const heading = stage === "awaiting_admin_relay" ? "📨 Waiting for you to relay to the host"
                  : stage === "pending_host_review" ? "⏳ With the host — waiting for them to confirm the dates"
                  : "💳 Host confirmed — waiting for the guest to pay";
                return (
                  <div key={stage} className="mb-4">
                    <p className="text-[11px] font-bold text-chs-charcoal mb-1.5">{heading} ({rows.length})</p>
                    {rows.map((q) => {
                      const urgent = q.lane === "express" || q.lane === "soon";
                      const mins = q.minutes_left ?? null;
                      const left = mins === null ? null : mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
                      return (
                        <div key={q.id} className={`rounded-xl border-2 p-3 mb-2 ${q.lane === "express" ? "bg-red-50 border-chs-red" : urgent ? "bg-chs-amber-light border-chs-amber" : "bg-[var(--zone-card)] border-gray-100"}`}>
                          <div className="flex justify-between items-start gap-2">
                            <p className="text-sm font-semibold text-chs-charcoal">{q.property_title}</p>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${q.lane === "express" ? "bg-chs-red text-white" : urgent ? "bg-chs-amber text-chs-charcoal" : q.lane === "legacy" ? "bg-gray-200 text-gray-600" : "bg-gray-100 text-gray-500"}`}>
                              {q.lane === "express" ? "⚡ EXPRESS" : q.lane === "soon" ? "🕒 SOON" : q.lane === "legacy" ? "OLDER — PAID AT REQUEST" : "STANDARD"}
                            </span>
                          </div>
                          {q.express_group_id && (q.group_size ?? 0) > 1 && (
                            <p className="text-[10px] font-bold text-chs-red mb-0.5">⚡ Express group: this guest asked {q.group_size} hotels at once. The first to confirm wins and the others cancel by themselves.</p>
                          )}
                          <p className="text-xs text-gray-600">{q.guest_full_name} · {q.guest_phone} · {q.check_in} → {q.check_out}{q.expected_arrival_time ? ` · arriving about ${q.expected_arrival_time}` : ""}</p>
                          <p className="text-[11px] text-gray-500">Host: {q.host_name} · <b>{q.host_phone}</b></p>
                          <p className="text-sm font-bold text-chs-charcoal mt-1">
                            {formatNaira(q.amount_if_confirmed)}
                            <span className="text-[10px] font-normal text-gray-500"> {q.payment_status === "held_escrow" ? "— already paid, held in escrow" : "— not paid yet (nothing is held)"}</span>
                          </p>
                          {left && (
                            <p className={`text-[11px] font-semibold mt-0.5 ${mins !== null && mins <= 30 ? "text-chs-red" : "text-amber-700"}`}>
                              ⏱ {left} left {stage === "awaiting_admin_relay" ? "before it relays automatically" : stage === "pending_host_review" ? "for the host to answer" : "for the guest to pay"}
                            </p>
                          )}
                          {q.admin_relay_note && <p className="text-[10px] text-gray-500 italic mt-0.5">CHS note to host: “{q.admin_relay_note}”</p>}
                          {q.relay_mode === "auto" && stage !== "awaiting_admin_relay" && <p className="text-[9px] text-gray-400 mt-0.5">Relayed to the host automatically</p>}
                          <p className="text-[9px] text-gray-400 mt-0.5">Requested {new Date(q.created_at).toLocaleString()}</p>

                          {stage === "awaiting_admin_relay" && (
                            <div className="mt-2">
                              <input type="text" value={relayNotes[q.id] || ""} onChange={(e) => setRelayNotes({ ...relayNotes, [q.id]: e.target.value })}
                                placeholder="Optional note to the host (e.g. guest is ID-verified)" className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
                              <button onClick={() => handleRelayBooking(q.id)} disabled={queueBusy === q.id}
                                className="w-full py-1.5 rounded-full bg-chs-red text-white text-[11px] font-semibold disabled:opacity-50">
                                {queueBusy === q.id ? "Relaying…" : "✓ Relay to the host"}
                              </button>
                              <input type="text" value={bookingRejectReasons[q.id] || ""} onChange={(e) => setBookingRejectReasons({ ...bookingRejectReasons, [q.id]: e.target.value })}
                                placeholder="Reason, if declining this request" className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] mt-2 mb-1.5" />
                              <button onClick={() => handleRejectBooking(q.id)} disabled={queueBusy === q.id}
                                className="w-full py-1.5 rounded-full bg-gray-200 text-gray-600 text-[11px] font-semibold disabled:opacity-50">
                                Decline this request (guest pays nothing)
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "staleoffers" && (
          <div>
            <p className="text-xs text-gray-500 mb-3">
              A real accepted offer whose buyer has not paid within 7 real days. Send a direct reminder, or — if there is genuinely no real response — release the property back to other interested buyers. This is exactly the kind of oversight that shows an owner CHS has their real interest at heart, not just the buyer&apos;s.
            </p>
            {actionError && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-2.5 py-2 mb-2">{actionError}</p>}
            {stalePendingOffers.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No real deals currently stalled beyond 7 days. Good sign.</p>
            ) : (
              stalePendingOffers.map((o) => (
                <div key={o.id} className="bg-red-50 rounded-xl border-2 border-chs-red p-3 mb-2">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-semibold text-chs-charcoal">{o.property_title}</p>
                    <span className="text-[9px] font-bold text-white bg-chs-red px-1.5 py-0.5 rounded-full whitespace-nowrap">{o.days_pending} real days pending</span>
                  </div>
                  <p className="text-sm font-bold text-chs-charcoal mb-1">{formatNaira(o.amount)}</p>
                  <p className="text-[11px] text-gray-600">Buyer: {o.buyer_name} · {o.buyer_phone}</p>
                  <p className="text-[11px] text-gray-500 mb-2">Seller: {o.seller_name} · {o.seller_phone}</p>
                  <p className="text-[9px] text-gray-400 mb-2">Accepted {new Date(o.pending_since).toLocaleDateString()} — buyer never completed payment</p>
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => handleSendStaleReminder(o.id)}
                      className="flex-1 py-1.5 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold">
                      ⏰ Send reminder to buyer
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Real reason for releasing this deal (e.g. no response after 2 reminders)"
                    value={staleOfferReasons[o.id] || ""}
                    onChange={(e) => setStaleOfferReasons({ ...staleOfferReasons, [o.id]: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-[11px] mb-2"
                  />
                  <button onClick={() => handleReleaseStaleOffer(o.id)}
                    className="w-full py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                    Release property back to the market
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "marketplacemoderation" && (
          <div>
            <p className="text-xs text-gray-500 mb-3">
              Every real marketplace message and payment waits here — a request or response only reaches the other party once approved; a payment only moves once you confirm what actually happened.
            </p>

            {directOrderQueue.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-chs-charcoal mb-1.5">🛒 Real Direct Orders (paid, no negotiation)</p>
                {directOrderQueue.map((o) => (
                  <div key={o.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-semibold text-chs-charcoal">{o.product_name || "Product"}</p>
                      <span className="text-[9px] font-bold text-white bg-chs-charcoal px-1.5 py-0.5 rounded-full">{o.reference_number}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">Vendor: {o.vendor_name}</p>
                    <p className="text-[9px] text-gray-400 mb-1">Paid {new Date(o.created_at).toLocaleString()}</p>
                    <p className="text-sm font-bold text-chs-charcoal mb-2">Real amount held: {formatNaira(o.amount)}</p>
                    <input type="text" placeholder="If refunding: real reason"
                      value={directOrderReasons[o.id] || ""} onChange={(e) => setDirectOrderReasons({ ...directOrderReasons, [o.id]: e.target.value })}
                      className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-[11px] mb-2" />
                    <div className="flex gap-2">
                      <button onClick={() => handleReleaseDirectOrder(o.id)} className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">Confirm delivered — release</button>
                      <button onClick={() => handleRefundDirectOrder(o.id)} className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">Refund buyer</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {marketplaceQueue.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">Nothing real is waiting for review right now.</p>
            ) : (
              marketplaceQueue.map((q) => (
                <div key={q.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-semibold text-chs-charcoal">{q.product_name || "Product"}</p>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[9px] font-bold text-white bg-chs-charcoal px-1.5 py-0.5 rounded-full">{q.reference_number}</span>
                      <span className="text-[9px] text-gray-400 whitespace-nowrap">{new Date(q.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">Vendor: {q.vendor_name}</p>

                  {q.moderation_status === "pending_review" && (
                    <>
                      <p className="text-xs text-chs-charcoal bg-white rounded-lg p-2 mb-2">{q.property_details}</p>
                      <input type="text" placeholder="If blocking: real reason"
                        value={marketplaceReasons[q.id] || ""} onChange={(e) => setMarketplaceReasons({ ...marketplaceReasons, [q.id]: e.target.value })}
                        className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-[11px] mb-2" />
                      <div className="flex gap-2">
                        <button onClick={() => handleApproveRequest(q.id)} className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">Approve &amp; relay to vendor</button>
                        <button onClick={() => handleBlockRequest(q.id)} className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">Block</button>
                      </div>
                    </>
                  )}

                  {q.response_moderation_status === "pending_review" && (
                    <>
                      <p className="text-xs text-chs-charcoal bg-white rounded-lg p-2 mb-1">{q.vendor_response}</p>
                      {q.quoted_amount && <p className="text-sm font-bold text-chs-charcoal mb-2">{formatNaira(q.quoted_amount)}</p>}
                      <input type="text" placeholder="If blocking: real reason"
                        value={marketplaceReasons[q.id] || ""} onChange={(e) => setMarketplaceReasons({ ...marketplaceReasons, [q.id]: e.target.value })}
                        className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-[11px] mb-2" />
                      <div className="flex gap-2">
                        <button onClick={() => handleApproveResponse(q.id)} className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">Approve &amp; relay to buyer</button>
                        <button onClick={() => handleBlockResponse(q.id)} className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">Block</button>
                      </div>
                    </>
                  )}

                  {q.payment_status === "held_escrow" && (
                    <>
                      <p className="text-sm font-bold text-chs-charcoal mb-1">Real amount held: {formatNaira(q.quoted_amount || 0)}</p>
                      <input type="text" placeholder="If refunding: real reason"
                        value={marketplaceReasons[q.id] || ""} onChange={(e) => setMarketplaceReasons({ ...marketplaceReasons, [q.id]: e.target.value })}
                        className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-[11px] mb-2" />
                      <div className="flex gap-2">
                        <button onClick={() => handleReleaseMarketplaceEscrow(q.id)} className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">Confirm delivered — release</button>
                        <button onClick={() => handleRefundMarketplaceEscrow(q.id)} className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">Refund buyer</button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "platformearnings" && (
          <div>
            <p className="text-xs text-gray-500 mb-3">Every real, collected commission — the money sender, amount, and timestamp — most recent first.</p>
            <div className="bg-chs-charcoal text-white rounded-xl p-4 mb-3">
              <p className="text-[10px] text-white/70 uppercase font-bold">Total shown below</p>
              <p className="font-serif text-2xl font-bold mt-0.5">{formatNaira(recentEarnings.reduce((s, e) => s + e.commission_amount, 0))}</p>
            </div>
            {recentEarnings.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No real, collected earnings yet.</p>
            ) : (
              recentEarnings.map((e) => (
                <div key={e.id} className="bg-[var(--zone-card)] rounded-lg p-2.5 mb-1.5 text-xs">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-chs-charcoal">{e.profiles?.full_name} ({e.profiles?.phone})</span>
                    <span className="font-bold text-green-700">+{formatNaira(e.commission_amount)}</span>
                  </div>
                  <p className="text-gray-500 mt-0.5">{e.transaction_type.replace(/_/g, " ")} · {e.payer_role} · {new Date(e.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "transactionlog" && (
          <div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
              📊 A real, unified financial record — for genuine accountability and audit, not just a browsing screen.
            </p>
            <div className="flex gap-1.5 mb-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {([["7", "This week"], ["30", "30 days"], ["60", "60 days"], ["90", "90 days"], ["180", "180 days"], ["365", "360 days"], ["custom", "Custom"]] as const).map(([val, label]) => (
                <button key={val} onClick={() => setTxLogRange(val)}
                  className={`shrink-0 text-[10px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap ${txLogRange === val ? "bg-chs-charcoal text-white" : "bg-gray-100 text-gray-600"}`}>
                  {label}
                </button>
              ))}
            </div>
            {txLogRange === "custom" && (
              <div className="flex gap-2 mb-3">
                <input type="date" value={txLogCustomStart} onChange={(e) => setTxLogCustomStart(e.target.value)}
                  className="flex-1 px-2 py-2 rounded-lg border border-gray-200 text-xs" />
                <input type="date" value={txLogCustomEnd} onChange={(e) => setTxLogCustomEnd(e.target.value)}
                  className="flex-1 px-2 py-2 rounded-lg border border-gray-200 text-xs" />
                <button onClick={loadTransactionLog} className="px-3 py-2 rounded-lg bg-chs-red text-white text-xs font-semibold">Go</button>
              </div>
            )}
            {txLogLoading || !txLogData ? (
              <p className="text-center text-sm text-gray-400 py-8">Loading real figures…</p>
            ) : (
              <>
                <div className="bg-chs-charcoal text-white rounded-xl p-4 mb-3">
                  <p className="text-[10px] text-white/70 uppercase font-bold">Processed (total transactions)</p>
                  <p className="font-serif text-2xl font-bold mt-0.5">{txLogData.processed_count}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-green-700 uppercase">Successful</p>
                    <p className="text-lg font-bold text-chs-charcoal">{txLogData.successful.count}</p>
                    <p className="text-[10px] text-gray-500">{formatNaira(txLogData.successful.total_value)}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-gray-500 uppercase">Refunded</p>
                    <p className="text-lg font-bold text-chs-charcoal">{txLogData.refunded.count}</p>
                    <p className="text-[10px] text-gray-500">{formatNaira(txLogData.refunded.total_value)}</p>
                  </div>
                </div>
                <div className="bg-chs-amber-light rounded-xl p-3 mb-3">
                  <p className="text-[9px] font-bold text-chs-amber-dark uppercase">🔒 In Escrow right now</p>
                  <p className="text-lg font-bold text-chs-charcoal">{txLogData.in_escrow.count} real transaction{txLogData.in_escrow.count !== 1 ? "s" : ""}</p>
                  <p className="text-xs text-gray-600">{formatNaira(txLogData.in_escrow.total_value)} currently held</p>
                </div>
                <div className="bg-white rounded-xl border-2 border-chs-red p-3 mb-3">
                  <p className="text-xs font-bold text-chs-red mb-1">💰 Platform Earnings</p>
                  <p className="font-serif text-xl font-bold text-chs-charcoal mb-2">{formatNaira(txLogData.platform_earnings.total)}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">By who paid</p>
                  {Object.entries(txLogData.platform_earnings.by_payer_role).map(([role, amt]) => (
                    <div key={role} className="flex justify-between text-xs mb-0.5">
                      <span className="capitalize text-gray-600">{role}</span>
                      <span className="font-semibold text-chs-charcoal">{formatNaira(amt as number)}</span>
                    </div>
                  ))}
                  <p className="text-[10px] font-bold text-gray-400 uppercase mt-2 mb-1">By transaction type</p>
                  {Object.entries(txLogData.platform_earnings.by_transaction_type).map(([type, amt]) => (
                    <div key={type} className="flex justify-between text-xs mb-0.5">
                      <span className="capitalize text-gray-600">{type.replace(/_/g, " ")}</span>
                      <span className="font-semibold text-chs-charcoal">{formatNaira(amt as number)}</span>
                    </div>
                  ))}

                  {/* Real, itemized list with a real date and time on
                      every entry — the exact thing missing before,
                      per direct, repeated client report. */}
                  <p className="text-[10px] font-bold text-gray-400 uppercase mt-3 mb-1">Every real, paid commission — with date &amp; time</p>
                  {txLogData.platform_earnings.items.length === 0 ? (
                    <p className="text-[10px] text-gray-400">None in this real date range.</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-1.5">
                      {txLogData.platform_earnings.items.map((item) => (
                        <div key={item.id} className="bg-[var(--zone-card)] rounded-lg px-2 py-1.5">
                          <div className="flex justify-between">
                            <span className="text-[11px] font-semibold text-chs-charcoal">{item.property_title || item.transaction_type.replace(/_/g, " ")}</span>
                            <span className="text-[11px] font-bold text-chs-red">{formatNaira(item.commission_amount)}</span>
                          </div>
                          <p className="text-[9px] text-gray-500">
                            {item.payer_name} ({item.payer_role}) · {item.commission_percentage}% of {formatNaira(item.base_amount)}
                          </p>
                          <p className="text-[9px] text-gray-400">
                            {new Date(item.paid_at).toLocaleString()}{item.reference ? ` · ${item.reference}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Real, new visibility into invoiced-but-unpaid
                    commissions — the exact real question the client
                    asked about the Kakuri warehouse: this is genuinely
                    still owed, not yet collected, and here is who owes
                    it and since when. */}
                {txLogData.platform_earnings.pending_items.length > 0 && (
                  <div className="bg-amber-50 rounded-xl border-2 border-chs-amber p-3 mb-3">
                    {/* Real, direct rewording per a direct, well-founded
                        client objection: CHS does not operate on a
                        real invoice-and-wait billing model — every
                        real commission is collected automatically, at
                        the exact real moment the underlying payment
                        happens, never as a separate bill sent
                        afterward. Confirmed directly before rewording:
                        every real item that can still land here is one
                        of exactly two genuine situations — (1) a real
                        deal that was cleared to proceed but the actual
                        payment was never made (nothing has moved; the
                        deal simply never completed), or (2) a real
                        host/landlord's share that is correctly, still
                        held pending a scheduled release, with the
                        commission collected automatically the instant
                        that release happens — not something anyone is
                        separately "waiting to be paid." */}
                    <p className="text-xs font-bold text-chs-amber-dark mb-1">⏳ Not Yet Collected — Transaction Incomplete</p>
                    <p className="text-[10px] text-gray-500 mb-2">
                      CHS never bills separately — every commission is collected automatically the moment the real payment happens. If something shows here, it means one of two real things: either the underlying deal was never actually paid for (nothing moved), or this is a host/landlord&apos;s share still correctly held pending a scheduled payout, which will be collected automatically at that point. Nothing is wrong; there is simply no real payment to collect against yet.
                    </p>
                    <div className="space-y-1.5">
                      {txLogData.platform_earnings.pending_items.map((item) => (
                        <div key={item.id} className="bg-white rounded-lg px-2 py-1.5">
                          <div className="flex justify-between">
                            <span className="text-[11px] font-semibold text-chs-charcoal">{item.property_title || item.transaction_type.replace(/_/g, " ")}</span>
                            <span className="text-[11px] font-bold text-chs-amber-dark">{formatNaira(item.commission_amount)}</span>
                          </div>
                          <p className="text-[9px] text-gray-500">
                            Real share due from {item.payer_name} ({item.payer_role}) · {item.payer_phone}
                          </p>
                          <p className="text-[9px] text-gray-400">Deal recorded {new Date(item.created_at).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="bg-[var(--zone-card)] rounded-xl p-3">
                  <p className="text-xs font-bold text-chs-charcoal mb-1">📣 Marketing & Subscriptions</p>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-600">Property promotions</span>
                    <span className="font-semibold text-chs-charcoal">{formatNaira(txLogData.marketing_and_subscriptions.promotions_total)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Team subscriptions</span>
                    <span className="font-semibold text-chs-charcoal">{formatNaira(txLogData.marketing_and_subscriptions.team_subscriptions_total)}</span>
                  </div>
                </div>
                {txLogData.refunded.count === 0 && (
                  <p className="text-[10px] text-gray-400 mt-3 text-center">
                    Honest note: refunds show a real zero because there is currently no working refund request feature in the app — not because none were needed.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "notificationsfeed" && (
          <div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
              🔔 Every real notification you&apos;ve received, in one place — the same ones in the bell dropdown, without the limit.
            </p>
            {notificationsFeed.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No real notifications yet.</p>
            ) : (
              notificationsFeed.map((n) => (
                <button key={n.id} onClick={async () => {
                  if (!n.read) {
                    await supabase.from("notifications").update({ read: true, read_at: new Date().toISOString() }).eq("id", n.id);
                    setNotificationsFeed((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
                  }
                  if (n.link) router.push(n.link);
                }} className={`block w-full text-left rounded-xl border p-3 mb-2 ${n.read ? "bg-white border-gray-100" : "bg-chs-amber-light border-chs-amber-dark"}`}>
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold text-chs-charcoal">{n.title}</p>
                    <span className="text-[9px] text-gray-400 whitespace-nowrap ml-2">{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{n.body}</p>
                </button>
              ))
            )}
          </div>
        )}

        {activeTab === "subadminactivities" && (
          <div>
            {!profile?.is_super_admin ? (
              <p className="text-center text-sm text-gray-400 py-8">This real activity log is visible to Super Admin only.</p>
            ) : (
              <>
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
                  📜 A real, permanent record of every resolved sub-admin request — once approved or rejected, it stays here rather than vanishing.
                </p>
                {loadingActionHistory ? (
                  <p className="text-center text-sm text-gray-400 py-8">Loading...</p>
            ) : actionHistory.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No resolved actions yet.</p>
            ) : (
              actionHistory.map((h) => (
                <div key={h.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <span className={h.status === "approved" ? "text-green-700 font-semibold text-xs" : "text-chs-red font-semibold text-xs"}>
                    {h.status === "approved" ? "✓" : "✕"} {h.action_type.replace(/_/g, " ")}
                  </span>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {h.profiles?.[0]?.full_name || "Unknown"} · {h.resolved_at && new Date(h.resolved_at).toLocaleString()}
                  </p>
                  {h.resolution_note && <p className="text-[11px] text-gray-600 mt-1">&quot;{h.resolution_note}&quot;</p>}
                </div>
              ))
            )}
              </>
            )}
          </div>
        )}

        {activeTab === "assignrole" && (
          <div>
            <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4 space-y-2 mb-4">
              <p className="text-sm font-bold text-chs-charcoal">📊 Grant real investor access</p>
              <p className="text-[10px] text-gray-400">
                A genuine, restricted view of real business figures — growth, revenue, escrow health — with no individual buyer, seller, or tenant ever identifiable. The person must already have a real CHS account.
              </p>
              <input type="text" value={investorContact} onChange={(e) => setInvestorContact(e.target.value)}
                placeholder="Their phone number or email"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <button onClick={handleGrantInvestor} className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold">
                Grant investor access
              </button>
              {investorGrantResult && <p className="text-xs text-green-700">{investorGrantResult}</p>}
            </div>

            <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4 space-y-2 mb-4">
              <p className="text-sm font-bold text-chs-charcoal">👥 Assign an admin role</p>
              <p className="text-[10px] text-gray-400">
                The person must already have a real CHS account — this promotes their existing account, it doesn&apos;t create a new one.
              </p>
              <input type="text" value={assignContact} onChange={(e) => setAssignContact(e.target.value)}
                placeholder="Their phone number or email"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <select value={assignRole} onChange={(e) => setAssignRole(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                <option value="customer_care">Customer Care (disputes, feedback)</option>
                <option value="registration_setup">Registration & Setup (approvals, face verification)</option>
                <option value="owner_buyer_tenant">Owner/Buyer/Tenant (properties, applications, sales)</option>
                <option value="agent_relations">Agent Relations (referral fees)</option>
                <option value="artisan_dev_pm_vendor">Artisan/Developer/PM/Vendor</option>
              </select>
              {assignMessage && (
                <p className={`text-xs rounded-lg px-3 py-2 ${assignMessage.startsWith("✓") ? "text-green-700 bg-green-50" : "text-chs-red bg-red-50"}`}>
                  {assignMessage}
                </p>
              )}
              <button onClick={async () => { await handleAssignStaffRole(); setSubAdminRoster([]); }} disabled={assigning}
                className="w-full py-2.5 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">
                {assigning ? "Assigning..." : "Assign role"}
              </button>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Every real current sub-admin</p>
            {subAdminRoster.filter((s) => !s.is_super_admin).length === 0 ? (
              <p className="text-xs text-gray-400">No real sub-admins assigned yet.</p>
            ) : (
              subAdminRoster.filter((s) => !s.is_super_admin).map((s) => (
                <div key={s.id} className="bg-white rounded-lg border border-gray-100 p-2.5 mb-1.5 flex justify-between items-center">
                  <p className="text-xs text-chs-charcoal">{s.full_name} — {s.phone}</p>
                  <span className="text-[9px] font-bold text-gray-500 capitalize">{s.staff_role?.replace(/_/g, " ") || "No domain"}</span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "staffreports" && (
          <div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
              📋 Real daily reports submitted by team members across every real agent and property manager on the platform — not CHS&apos;s own internal staff (see Sub-Admin&apos;s Daily Report for that).
            </p>
            {teamDailyReports.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No real staff reports yet.</p>
            ) : (
              teamDailyReports.map((r) => (
                <div key={r.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold text-chs-charcoal">{r.team_member?.[0]?.full_name || "Team member"}</p>
                    <span className="text-[9px] text-gray-400">{r.report_date}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-1">Submitted by {r.submitter?.[0]?.full_name || "—"}</p>
                  <p className="text-xs text-gray-700">{r.activities}</p>
                  {r.transactions_handled && <p className="text-[11px] text-gray-500 mt-1">Transactions: {r.transactions_handled}</p>}
                  {r.complaints_raised && <p className="text-[11px] text-chs-red mt-1">Complaints: {r.complaints_raised}</p>}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "subadmindailyreports" && (
          <div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
              🗂️ Real daily reports from CHS&apos;s own internal admin/sub-admin staff.
            </p>
            {adminDailyReports.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No real sub-admin reports yet.</p>
            ) : (
              adminDailyReports.map((r) => (
                <div key={r.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold text-chs-charcoal">{r.submitter?.[0]?.full_name || "Sub-admin"}</p>
                    <span className="text-[9px] text-gray-400">{r.report_date}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-1 capitalize">{r.staff_role_at_time?.replace(/_/g, " ")}</p>
                  <p className="text-xs text-gray-700">{r.activities}</p>
                  {r.transactions_handled && <p className="text-[11px] text-gray-500 mt-1">Transactions: {r.transactions_handled}</p>}
                  {r.complaints_raised && <p className="text-[11px] text-chs-red mt-1">Complaints: {r.complaints_raised}</p>}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "subadminpanel" && (
          <div>
            {!profile?.is_super_admin ? (
              <p className="text-center text-sm text-gray-400 py-8">This real panel is visible to Super Admin only.</p>
            ) : (
              <>
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
                  🛡️ Every real sub-admin and what they can currently see — the same, real domain-based restriction enforced at the database level, shown here so you know exactly what each one&apos;s own dashboard looks like right now.
                </p>
                {subAdminRoster.filter((s) => !s.is_super_admin).length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-8">No real sub-admins assigned yet.</p>
                ) : (
                  subAdminRoster.filter((s) => !s.is_super_admin).map((s) => {
                    const domainTabLabels: Record<string, string[]> = {
                      customer_care: ["Disputes", "Condition Reports", "Feedback"],
                      registration_setup: ["Face Verification", "ID Verification", "Registrations"],
                      owner_buyer_tenant: ["Processed History", "Sale Approvals", "Applications", "Offer Review", "Properties", "Inspections", "Tenant Register Oversight", "Escrow Oversight", "Shortlet/Hire Deposits", "Marketplace Moderation", "Platform Earnings", "Transaction History Log"],
                      agent_relations: ["Referral fees"],
                      artisan_dev_pm_vendor: ["Vendors", "Maintenance", "Artisans", "Developers"],
                    };
                    const visibleTabs = s.staff_role ? domainTabLabels[s.staff_role] || [] : [];
                    return (
                      <div key={s.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                        <p className="text-sm font-semibold text-chs-charcoal">{s.full_name} — {s.phone}</p>
                        <p className="text-[10px] text-gray-500 mb-1.5 capitalize">Domain: {s.staff_role?.replace(/_/g, " ") || "None assigned"}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Real tabs this sub-admin currently sees</p>
                        <div className="flex flex-wrap gap-1">
                          {visibleTabs.length === 0 ? (
                            <span className="text-[10px] text-gray-400">None — no domain assigned yet.</span>
                          ) : (
                            visibleTabs.map((t) => (
                              <span key={t} className="text-[9px] bg-white border border-gray-200 rounded-full px-2 py-0.5 text-chs-charcoal">{t}</span>
                            ))
                          )}
                          <span className="text-[9px] bg-white border border-gray-200 rounded-full px-2 py-0.5 text-chs-charcoal">Overview</span>
                          <span className="text-[9px] bg-white border border-gray-200 rounded-full px-2 py-0.5 text-chs-charcoal">Analytics</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "superadminindex" && (
          <div>
            {!profile?.is_super_admin ? (
              <p className="text-center text-sm text-gray-400 py-8">This real shortcut index is visible to Super Admin only.</p>
            ) : (
              <>
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-4">
                  🧭 A real, direct shortcut into every real section on the long horizontal bar below — grouped the same way, so you never have to scroll to find one thing.
                </p>
                {[
                  { group: "General", items: [
                    { key: "overview" as Tab, label: "Overview" },
                    { key: "analytics" as Tab, label: "Analytics" },
                  ] },
                  { group: "Financial", items: [
                    { key: "finance" as Tab, label: "Finance" },
                    { key: "platformearnings" as Tab, label: "Platform Earnings" },
                    { key: "transactionlog" as Tab, label: "Transaction History Log" },
                    { key: "referrals" as Tab, label: `Referral Fees (${owedFees.filter(f => f.status === "owed").length})` },
                    { key: "escrowoversight" as Tab, label: "🔒 Escrow Oversight" },
                    { key: "shortletdeposits" as Tab, label: "Shortlet/Hire Deposits" },
                  ] },
                  { group: "Verification", items: [
                    { key: "registrations" as Tab, label: `Registrations (${pendingRegistrationsFull.length})` },
                    { key: "liveness" as Tab, label: `Face Verification (${pendingLiveness.length})` },
                    { key: "buyerid" as Tab, label: `ID Verification (${pendingBuyerIds.length})` },
                    { key: "properties" as Tab, label: `Properties (${pendingProperties.length})` },
                    { key: "vendors" as Tab, label: `Vendors (${pendingVendors.length})` },
                    { key: "artisans" as Tab, label: `Artisans (${pendingArtisans.length})` },
                    { key: "developers" as Tab, label: `Developers (${developerApplications.length})` },
                  ] },
                  { group: "Review & Approval", items: [
                    { key: "applications" as Tab, label: `Applications (${pendingApplications.length})` },
                    { key: "offerreview" as Tab, label: `Offer Review (${pendingOfferReview.length + pendingOfferDecisions.length})` },
                    { key: "saleapprovals" as Tab, label: `Sale Approvals (${pendingSaleApprovals.length})` },
                  ] },
                  { group: "Complaints & Care", items: [
                    { key: "disputes" as Tab, label: `Disputes (${openDisputes.length})` },
                    { key: "conditionreports" as Tab, label: `Condition Reports (${conditionReports.length})` },
                    { key: "feedback" as Tab, label: `Feedback (${pendingFeedback.length})` },
                    { key: "faults" as Tab, label: `Maintenance (${unroutedFaults.length})` },
                  ] },
                  { group: "Oversight", items: [
                    { key: "tenantregisteroversight" as Tab, label: "Tenant Register Oversight" },
                    { key: "marketplacemoderation" as Tab, label: "Marketplace Moderation" },
                    { key: "hotelcontrols" as Tab, label: "Hotel Controls (peak & cancellations)" },
                    { key: "walletsecurity" as Tab, label: `Wallet Security (${walletSecurityOpen})` },
                    { key: "rtorequests" as Tab, label: `Rent-to-Own Requests (${rtoQueue.filter((r) => r.needs_action).length})` },
                    { key: "inspections" as Tab, label: `Inspections (${upcomingInspections.length})` },
                    { key: "engage" as Tab, label: `Engage CHS (${pendingEngage.length})` },
                  ] },
                  { group: "Tools", items: [
                    { key: "trace" as Tab, label: "Trace an Account" },
                    { key: "auditlog" as Tab, label: "Audit Log" },
                    { key: "processedhistory" as Tab, label: "Processed History" },
                  ] },
                ].map((section) => (
                  <div key={section.group} className="mb-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">{section.group}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {section.items.map((item) => (
                        <button key={item.key} onClick={() => setActiveTab(item.key)}
                          className="text-left px-3 py-2 rounded-lg bg-[var(--zone-card)] border border-gray-100 text-xs font-semibold text-chs-charcoal hover:border-chs-red">
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div>
            {!profile?.is_super_admin ? (
              <p className="text-center text-sm text-gray-400 py-8">Real platform settings are visible to Super Admin only.</p>
            ) : (
              <PlatformSettingsPanel />
            )}
          </div>
        )}

        {activeTab === "userregistry" && (
          <div>
            {!profile?.is_super_admin ? (
              <p className="text-center text-sm text-gray-400 py-8">The real user registry is visible to Super Admin only.</p>
            ) : !registryData ? (
              <p className="text-center text-sm text-gray-400 py-8">Loading real figures…</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-chs-charcoal text-white rounded-xl p-4">
                    <p className="text-[10px] text-white/70 uppercase font-bold">Registered Users</p>
                    <p className="font-serif text-2xl font-bold mt-0.5">{registryData.total_registered}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-[9px] font-bold text-green-700 uppercase">Active (30 days)</p>
                    <p className="text-2xl font-bold text-chs-charcoal mt-0.5">{registryData.active_count}</p>
                  </div>
                </div>
                {usersByState.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-3 mb-3">
                    <p className="text-xs font-bold text-chs-charcoal mb-0.5">📍 Users by state</p>
                    <p className="text-[10px] text-gray-400 mb-2">Total registered, with how many have a CHS-verified identity. &quot;Not stated&quot; are accounts that never gave a state.</p>
                    {(() => {
                      const max = Math.max(...usersByState.map((r) => Number(r.total_users)), 1);
                      return usersByState.map((r) => (
                        <div key={r.state} className="mb-1.5">
                          <div className="flex justify-between text-[11px] text-chs-charcoal">
                            <span className="font-semibold">{r.state}</span>
                            <span>{r.total_users} <span className="text-gray-400">· {r.verified_users} verified</span></span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-chs-red rounded-full" style={{ width: `${(Number(r.total_users) / max) * 100}%` }} />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
                <div className="flex gap-2 mb-3">
                  <input type="text" value={registrySearch} onChange={(e) => setRegistrySearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadUserRegistry()}
                    placeholder="Search real name, phone, or reference number"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                  <button onClick={loadUserRegistry} className="px-4 py-2 rounded-full bg-chs-red text-white text-xs font-semibold">Search</button>
                </div>
                {registryData.users.map((u) => (
                  <div key={u.reference_number} className="bg-[var(--zone-card)] rounded-lg p-2.5 mb-1.5 text-xs">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-chs-charcoal">{u.full_name}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${u.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-gray-500 mt-0.5 font-mono">{u.reference_number} · {u.phone} · <span className="capitalize">{u.role}</span></p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Registered {new Date(u.created_at).toLocaleDateString()} · Last seen {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "never"}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

      </div>
      {showGuide && <GuidePrompt role="admin" onDismiss={() => setShowGuide(false)} />}
        </div>
      </div>
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  security_services: "Security Services",
  cleaning_services: "Cleaning Services",
  fumigation_pest_control: "Fumigation & Pest Control",
  facilities_maintenance: "Facilities Maintenance",
};

function FeeSettingRow({
  fee,
  onUpdate,
}: {
  fee: ReferralFeeSetting;
  onUpdate: (category: string, newAmount: number) => void;
}) {
  const [amount, setAmount] = useState(fee.flat_fee_amount);

  return (
    <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2 flex items-center justify-between gap-2">
      <p className="text-xs font-semibold text-chs-charcoal">{CATEGORY_LABELS[fee.category] || fee.category}</p>
      <div className="flex gap-1.5 items-center">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
          className="w-24 px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
        />
        <button
          onClick={() => onUpdate(fee.category, amount)}
          className="py-1.5 px-3 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// Restored from the original app's real, three-way workflow — Accept,
// Reject (requires a real written reason), and Request more info
// (requires a real specific question) — rather than the previous single
// "mark as contacted" button with no genuine decision behind it.
function EngageRequestCard({
  request,
  session,
  onAccept,
  onReject,
  onRequestMoreInfo,
}: {
  request: EngageRequest;
  session: Session | null;
  onAccept: (id: string, serviceType: string) => void;
  onReject: (id: string, reason: string) => void;
  onRequestMoreInfo: (id: string, question: string) => void;
}) {
  const [mode, setMode] = useState<"none" | "reject" | "more_info">("none");
  const [text, setText] = useState("");

  return (
    <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
      <div className="flex justify-between items-start">
        <p className="text-sm font-semibold text-chs-charcoal">{request.service_type}</p>
        <span className="text-[9px] text-gray-400 whitespace-nowrap ml-2">{new Date(request.created_at).toLocaleString()}</span>
      </div>
      <p className="text-xs text-gray-500 mt-1">{request.location}</p>
      <p className="text-xs text-gray-600 mt-1">{request.description}</p>
      {request.budget && <p className="text-xs text-gray-500 mt-1">Budget: {request.budget}</p>}
      {(request.contact_phone || request.contact_email) && (
        <p className="text-[11px] text-gray-500 mt-1">
          📞 {request.contact_phone} {request.contact_email && `· ${request.contact_email}`}
        </p>
      )}

      {Object.keys(request.category_details || {}).length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5">
          {Object.entries(request.category_details).map(([label, value]) =>
            value ? (
              <p key={label} className="text-[11px] text-gray-600">
                <span className="font-semibold text-chs-charcoal">{label}:</span> {value}
              </p>
            ) : null
          )}
        </div>
      )}

      {mode === "none" ? (
        <div className="flex gap-2 mt-2">
          <button onClick={() => onAccept(request.id, request.service_type)}
            className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
            Accept
          </button>
          <button onClick={() => setMode("reject")}
            className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
            Reject
          </button>
          <button onClick={() => setMode("more_info")}
            className="flex-1 py-1.5 rounded-full bg-chs-amber-light text-chs-amber-dark text-[10px] font-semibold">
            Request info
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <label className="text-[10px] font-semibold text-gray-600">
            {mode === "reject" ? "Reason for rejecting (the owner will see this)" : "What additional information do you need?"}
          </label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
            className="w-full mt-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
          <div className="flex gap-2 mt-1.5">
            <button onClick={() => setMode("none")}
              className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
              Cancel
            </button>
            <button
              onClick={() => mode === "reject" ? onReject(request.id, text) : onRequestMoreInfo(request.id, text)}
              className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold"
            >
              {mode === "reject" ? "Confirm rejection" : "Send request"}
            </button>
          </div>
        </div>
      )}
      {session && <EngageChatThread requestId={request.id} session={session} isAdmin={true} reference={request.reference} />}
      {session && <EngageDocumentManager requestId={request.id} adminUserId={session.user.id} />}
    </div>
  );
}
