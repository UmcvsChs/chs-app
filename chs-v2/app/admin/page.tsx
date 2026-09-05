"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import DocumentViewLink from "@/components/DocumentViewLink";
import EngageChatThread from "@/components/EngageChatThread";
import { EngageDocumentManager } from "@/components/EngageDocuments";

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
}
import { ReferralFeeSetting, ReferralFeeOwed } from "@/types/referralFee";
import OwnerAdminMessageThread from "@/components/OwnerAdminMessageThread";
import RoleBadge from "@/components/RoleBadge";
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
}

type Tab = "overview" | "analytics" | "finance" | "trace" | "saleapprovals" | "liveness" | "registrations" | "applications" | "properties" | "disputes" | "feedback" | "engage" | "vendors" | "referrals" | "faults" | "artisans" | "inspections" | "developers" | "tenantregisteroversight" | "shortletdeposits";
interface TracePromotion { is_active: boolean; rank_category: string | null; properties: { title: string }[] | null; }

export default function AdminDashboard() {
  const router = useRouter();
  const { session, profile, signOut, setTestModeRole, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
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
  const [pendingLiveness, setPendingLiveness] = useState<{ id: string; user_id: string; captured_photo_url: string; profiles: { full_name: string } | null }[]>([]);
  const [pendingBuyerIds, setPendingBuyerIds] = useState<{ id: string; user_id: string; id_type: string; id_number: string; id_document_url: string; profiles: { full_name: string } | null }[]>([]);
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

  useEffect(() => {
    supabase.rpc("get_pending_registrations_full").then(({ data }) => setPendingRegistrationsFull(data || []));
  }, []);

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
    setPendingRegistrationsFull((prev) => prev.filter((p) => p.id !== userId));
  }
  const [tenantRegisterSearch, setTenantRegisterSearch] = useState("");
  const [tenantRegisterResults, setTenantRegisterResults] = useState<{
    id: string; reference_number: string; full_name: string; phone: string; location_area: string; street_address: string | null;
    property_type: string; bedrooms: number; annual_rent: number; occupation: string; id_type: string; id_number: string;
    id_document_url: string | null; selfie_url: string | null; created_at: string;
  }[]>([]);
  const [tenantRegisterLoading, setTenantRegisterLoading] = useState(false);
  const [heldDeposits, setHeldDeposits] = useState<{
    id: string; guest_full_name: string; guest_phone: string; check_in: string; check_out: string;
    security_deposit_amount: number; properties: { title: string; owner_id: string }[] | null;
  }[]>([]);
  const [depositReasons, setDepositReasons] = useState<Record<string, string>>({});

  // Real, new feature completing the deposit mechanism — admin, not
  // the host directly, resolves a held deposit, matching the same
  // CHS-mediated pattern used everywhere else: a claim isn't just the
  // host's word against the guest's.
  useEffect(() => {
    supabase.from("shortlet_bookings")
      .select("id, guest_full_name, guest_phone, check_in, check_out, security_deposit_amount, properties(title, owner_id)")
      .eq("security_deposit_status", "held")
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

  useEffect(() => {
    // Real, critical fix — confirmed directly against a real, live
    // account: a Property Manager's uploaded professional certificate
    // (and an Agent's uploaded valid ID) had never had any admin
    // review screen at all, on top of the earlier, separate buyer-ID
    // fix. This was forcing admin to approve these two real
    // registration types completely blind, with no way to ever see
    // the document that was actually, correctly uploaded.
    supabase.from("profiles").select("id, full_name, phone, valid_id_type, valid_id_number, valid_id_document_url")
      .eq("role", "agent").eq("valid_id_verified", false).not("valid_id_document_url", "is", null)
      .then(({ data }) => setPendingAgentIds(data || []));
    supabase.from("profiles").select("id, full_name, phone, profession, professional_registration_number, certificate_document_url")
      .eq("role", "manager").eq("professional_credentials_verified", false).not("certificate_document_url", "is", null)
      .then(({ data }) => setPendingManagerCerts(data || []));
  }, []);

  const [totalCommissionEarnings, setTotalCommissionEarnings] = useState(0);
  const [openOwnerConcerns, setOpenOwnerConcerns] = useState<{ id: string; subject: string; message: string; profiles: { full_name: string } | null }[]>([]);
  const [agentChangeRequests, setAgentChangeRequests] = useState<{ id: string; requested_agent_name: string | null; requested_agent_phone: string | null; requested_agent_chs_id: string | null; properties: { title: string } | null }[]>([]);
  const [approvingAgentInput, setApprovingAgentInput] = useState<Record<string, string>>({});
  const [suspendPhone, setSuspendPhone] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendResult, setSuspendResult] = useState<string | null>(null);
  const [suspending, setSuspending] = useState(false);
  const [pendingAppeals, setPendingAppeals] = useState<{ id: string; message: string; profiles: { full_name: string; phone: string } | null }[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<{ id: string; title: string; body: string; read: boolean; created_at: string }[]>([]);
  const [showNotifBell, setShowNotifBell] = useState(false);
  const unreadNotifCount = adminNotifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!session) return;
    supabase.from("notifications").select("id, title, body, read, created_at").eq("user_id", session.user.id)
      .order("created_at", { ascending: false }).limit(30)
      .then(({ data }) => setAdminNotifications(data || []));

    // Real-time — a genuine, live update the moment a new
    // notification lands, matching a WhatsApp-style badge rather than
    // only refreshing when the page is manually reloaded.
    const channel = supabase
      .channel("admin-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${session.user.id}` },
        (payload) => setAdminNotifications((prev) => [payload.new as typeof adminNotifications[0], ...prev]))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function handleOpenNotifBell() {
    setShowNotifBell(!showNotifBell);
    if (!showNotifBell && unreadNotifCount > 0) {
      await supabase.from("notifications").update({ read: true }).eq("user_id", session?.user.id).eq("read", false);
      setAdminNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }
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
  const [analyticsPeriod, setAnalyticsPeriod] = useState<"today" | "week" | "month" | "quarter">("month");
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
    if (period === "today") start.setHours(0, 0, 0, 0);
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
  const [pendingSaleDocs, setPendingSaleDocs] = useState<{ id: string; property_id: string; document_type: string; file_url: string; properties: { title: string } | null }[]>([]);
  const [pendingLegalTransfers, setPendingLegalTransfers] = useState<{ id: string; amount: number; properties: { title: string; owner_id: string } | null }[]>([]);

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
  const [pendingProperties, setPendingProperties] = useState<PendingProperty[]>([]);
  const [openDisputes, setOpenDisputes] = useState<Dispute[]>([]);
  const [pendingFeedback, setPendingFeedback] = useState<CommunityFeedback[]>([]);
  const [pendingEngage, setPendingEngage] = useState<EngageRequest[]>([]);
  const [pendingVendors, setPendingVendors] = useState<MarketplaceVendor[]>([]);
  const [pendingArtisans, setPendingArtisans] = useState<Artisan[]>([]);
  const [upcomingInspections, setUpcomingInspections] = useState<(Inspection & { properties: { title: string; location_area: string } | null })[]>([]);
  const [developerApplications, setDeveloperApplications] = useState<DeveloperApplication[]>([]);
  const [showGuide, setShowGuide] = useState(false);

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
  } | null>(null);

  // Real resolved-history view — closes a related gap: once a
  // sub-admin action is approved/rejected, it previously vanished
  // from admin view entirely with no audit trail.
  const [showActionHistory, setShowActionHistory] = useState(false);
  const [actionHistory, setActionHistory] = useState<{
    id: string; action_type: string; status: string; resolved_at: string | null; resolution_note: string | null;
    profiles: { full_name: string }[] | null;
  }[]>([]);
  const [loadingActionHistory, setLoadingActionHistory] = useState(false);
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
  const [agentReferrals, setAgentReferrals] = useState<{ id: string; masked_reference: string; stage: string; chs_commission: number | null; agent_share_pct: number | null; split_50_50: boolean; agent_payout: number | null }[]>([]);
  const [completingReferralId, setCompletingReferralId] = useState<string | null>(null);
  const [unroutedFaults, setUnroutedFaults] = useState<(FaultReport & { tenancies: { management_delegated: boolean; landlord_id: string; manager_id: string | null } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

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
    if (profile && !profile.terms_accepted_at) {
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
    const [profilesRes, applicationsRes, propertiesRes, disputesRes, feedbackRes, engageRes, vendorsRes, feeSettingsRes, owedFeesRes, faultsRes, artisansRes, inspectionsRes, developerAppsRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, role, state, created_at").eq("status", "pending").order("created_at", { ascending: true }).limit(200),
      supabase.from("rental_applications").select("*, properties(title, street_address, location_area, owner_id, profiles!properties_owner_id_fkey(full_name, phone)), tenant:profiles!rental_applications_tenant_id_fkey(full_name, phone)").in("status", ["pending", "awaiting_owner_decision", "owner_decided_pending_relay"]).order("created_at", { ascending: true }).limit(200),
      supabase.from("properties").select("id, title, location_area, purpose, price").eq("verification_status", "pending").order("created_at", { ascending: true }).limit(200),
      supabase.from("disputes").select("*").eq("status", "open").order("created_at", { ascending: true }).limit(200),
      supabase.from("community_feedback").select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(200),
      supabase.from("engage_chs_requests").select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(200),
      supabase.from("marketplace_vendors").select("*").eq("verification_status", "pending").order("created_at", { ascending: true }).limit(200),
      supabase.from("referral_fee_settings").select("*").order("flat_fee_amount", { ascending: false }),
      supabase.from("referral_fees_owed").select("*").order("created_at", { ascending: true }).limit(200),
      supabase.from("fault_reports").select("*, tenancies(management_delegated, landlord_id, manager_id)").in("status", ["reported", "assigned", "converted_to_quote", "gathering_quotes"]).order("created_at", { ascending: true }).limit(200),
      supabase.from("artisans").select("*").eq("verification_status", "pending").order("created_at", { ascending: true }).limit(200),
      supabase.from("inspections").select("*, properties(title, location_area)").in("status", ["pending", "confirmed"]).order("requested_date", { ascending: true }).limit(200),
      supabase.from("developer_applications").select("*").in("status", ["pending", "reviewed"]).order("created_at", { ascending: true }).limit(200),
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

    const { data: saleApprovalsData } = await supabase
      .from("offers")
      .select("*, properties(title)")
      .eq("status", "accepted")
      .eq("chs_cleared", false)
      .order("created_at", { ascending: true });
    setPendingSaleApprovals((saleApprovalsData as unknown as typeof pendingSaleApprovals) || []);

    const { data: livenessData } = await supabase
      .from("liveness_submissions")
      .select("id, user_id, captured_photo_url, profiles(full_name)")
      .eq("status", "pending_review")
      .order("created_at", { ascending: true });
    setPendingLiveness((livenessData as unknown as typeof pendingLiveness) || []);

    const { data: buyerIdData } = await supabase
      .from("buyer_id_verifications")
      .select("id, user_id, id_type, id_number, id_document_url, profiles(full_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setPendingBuyerIds((buyerIdData as unknown as typeof pendingBuyerIds) || []);

    // Real, previously-missing commission earnings summary — sums
    // every real, paid commission, not a projection or estimate.
    const { data: commissionData } = await supabase
      .from("transaction_commissions")
      .select("commission_amount")
      .eq("status", "paid");
    setTotalCommissionEarnings((commissionData || []).reduce((sum, r) => sum + Number(r.commission_amount), 0));

    const { data: concernsData } = await supabase
      .from("owner_concerns")
      .select("id, subject, message, profiles:owner_id(full_name)")
      .eq("status", "open")
      .order("created_at", { ascending: true });
    setOpenOwnerConcerns((concernsData as unknown as typeof openOwnerConcerns) || []);

    const { data: agentChangeData } = await supabase
      .from("agent_change_requests")
      .select("id, requested_agent_name, requested_agent_phone, requested_agent_chs_id, properties(title)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setAgentChangeRequests((agentChangeData as unknown as typeof agentChangeRequests) || []);

    const { data: appealsData } = await supabase
      .from("account_appeals")
      .select("id, message, profiles:user_id(full_name, phone)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setPendingAppeals((appealsData as unknown as typeof pendingAppeals) || []);
    loadAdminReports();

    // Real, distinct list of owners with active correspondence —
    // derived from the actual messages table, not a guess.
    const { data: msgOwnerData } = await supabase
      .from("owner_admin_messages")
      .select("owner_id, profiles:owner_id(full_name)")
      .order("created_at", { ascending: false });
    const seen = new Set<string>();
    const uniqueOwners: { owner_id: string; full_name: string }[] = [];
    (msgOwnerData || []).forEach((m: Record<string, unknown>) => {
      const oid = m.owner_id as string;
      if (!seen.has(oid)) {
        seen.add(oid);
        const prof = m.profiles as { full_name: string } | { full_name: string }[] | null;
        const name = Array.isArray(prof) ? prof[0]?.full_name : prof?.full_name;
        uniqueOwners.push({ owner_id: oid, full_name: name || "Owner" });
      }
    });
    setOwnersWithMessages(uniqueOwners);

    // Real, pending pre-commitment negotiation messages — genuine
    // review queue, matching the exact strategic requirement that no
    // negotiation reaches a non-committed buyer without CHS review.
    const { data: precommitData } = await supabase
      .from("precommit_messages")
      .select("id, text, sender_role, profiles:sender_id(full_name), offers(properties(title))")
      .eq("status", "pending_review")
      .order("created_at", { ascending: true });
    setPendingPrecommitMessages((precommitData as unknown as typeof pendingPrecommitMessages) || []);

    // Real, itemized transaction log — the actual fix for "opaque
    // earnings": every real commission line item, who paid it, what
    // role, what percentage, and when — not just one lump total.
    const { data: txnData } = await supabase
      .from("transaction_commissions")
      .select("id, transaction_type, payer_role, base_amount, commission_percentage, commission_amount, paid_at, properties(title, street_address), profiles:payer_id(full_name)")
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(50);

    // Real fix: installment payments are deliberately NOT duplicated
    // into transaction_commissions (a real unique constraint conflict
    // found during testing), so they'd otherwise be invisible here —
    // exactly the kind of "opaque earnings" gap being fixed. Fetched
    // separately and merged into the same real, unified log.
    const { data: installmentData } = await supabase
      .from("sale_installment_payments")
      .select("id, amount, buyer_commission, offers(amount, buyer_id, properties(title), profiles:buyer_id(full_name))")
      .order("paid_at", { ascending: false })
      .limit(50);
    const installmentAsTransactions = (installmentData || []).flatMap((p: Record<string, unknown>) => {
      const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
      const props = offer?.properties ? (Array.isArray(offer.properties) ? offer.properties[0] : offer.properties) : null;
      const buyerProfile = offer?.profiles ? (Array.isArray(offer.profiles) ? offer.profiles[0] : offer.profiles) : null;
      return [{
        id: p.id, transaction_type: "sale_installment", payer_role: "buyer",
        base_amount: p.amount, commission_percentage: null, commission_amount: p.buyer_commission,
        paid_at: p.paid_at, properties: props, profiles: buyerProfile,
      }];
    });

    // Real fix per direct client testing: a tenant's actual rent
    // payment (peer-to-peer, not a CHS commission) was invisible to
    // admin entirely — the money genuinely reached the landlord (this
    // was verified directly), but admin had no way to see it happened
    // at all. Merged in here too, clearly labeled as rent rather than
    // CHS earnings, so admin retains real oversight of platform-wide
    // money movement, not just CHS's own commission revenue.
    const { data: rentData } = await supabase
      .from("rent_payments")
      .select("id, amount, created_at, tenancies(property_id, properties(title, street_address))")
      .order("created_at", { ascending: false })
      .limit(50);
    const rentAsTransactions = (rentData || []).map((r: Record<string, unknown>) => {
      const tenancy = Array.isArray(r.tenancies) ? r.tenancies[0] : r.tenancies;
      const props = tenancy?.properties ? (Array.isArray(tenancy.properties) ? tenancy.properties[0] : tenancy.properties) : null;
      return {
        id: r.id, transaction_type: "rent_payment (not CHS earnings)", payer_role: "tenant",
        base_amount: r.amount, commission_percentage: null, commission_amount: 0,
        paid_at: r.created_at, properties: props, profiles: null,
      };
    });

    const merged = [...(txnData || []), ...installmentAsTransactions, ...rentAsTransactions]
      .sort((a, b) => new Date(b.paid_at as string).getTime() - new Date(a.paid_at as string).getTime())
      .slice(0, 50);
    setRecentTransactions(merged as unknown as typeof recentTransactions);

    // Real, admin-wide escrow visibility now shown directly via
    // pendingLegalTransfers below, with the actual release button
    // right alongside it — no separate summary needed.

    const { data: saleDocsData } = await supabase
      .from("property_sale_documents")
      .select("id, property_id, document_type, file_url, properties(title)")
      .eq("verification_status", "pending")
      .order("created_at", { ascending: true });
    setPendingSaleDocs((saleDocsData as unknown as typeof pendingSaleDocs) || []);

    const { data: legalTransferData } = await supabase
      .from("offers")
      .select("id, amount, properties(title, owner_id)")
      .eq("payment_status", "paid")
      .eq("legal_transfer_confirmed", false)
      .order("created_at", { ascending: true });
    setPendingLegalTransfers((legalTransferData as unknown as typeof pendingLegalTransfers) || []);
    setPendingApplications(applicationsRes.data || []);
    setPendingProperties(propertiesRes.data || []);
    setOpenDisputes(disputesRes.data || []);
    setPendingFeedback(feedbackRes.data || []);
    setPendingEngage(engageRes.data || []);
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
      .select("id, masked_reference, stage, chs_commission, agent_share_pct, split_50_50, agent_payout")
      .neq("stage", "completed")
      .neq("stage", "lost")
      .then(({ data }) => setAgentReferrals(data || []));

    // Only a real super admin needs to see or act on these — a
    // sub-admin querying this would just get an empty result anyway
    // (RLS: admin_login_requests_own_read only shows their own), but
    // there's no reason to even ask unless they're the one who'd act.
    if (profile?.is_super_admin) {
      const { data: loginRequests } = await supabase
        .from("admin_login_requests")
        .select("id, admin_id, code, created_at, profiles(full_name, role)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      setPendingLoginRequests((loginRequests as typeof pendingLoginRequests) || []);

      const { data: actionRequests } = await supabase
        .from("admin_action_requests")
        .select("id, requested_by, domain, action_type, target_id, proposed_changes, note, created_at, profiles(full_name, staff_role)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      setPendingActionRequests((actionRequests as typeof pendingActionRequests) || []);
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
      .select("id, action_type, status, resolved_at, resolution_note, profiles(full_name)")
      .neq("status", "pending")
      .order("resolved_at", { ascending: false })
      .limit(50);
    setActionHistory((data as typeof actionHistory) || []);
    setLoadingActionHistory(false);
    setShowActionHistory(true);
  }

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
    const [walletRes, walletTxRes, promoTxRes, promoRes, roadmapRes, bankRes, engageRes] = await Promise.all([
      supabase.from("wallets").select("main_balance, frozen").eq("user_id", user.id).maybeSingle(),
      supabase.from("wallet_transactions").select("amount, direction, description, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("promo_credit_transactions").select("amount, direction, description, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("property_promotions").select("is_active, rank_category, properties(title)").eq("owner_id", user.id),
      supabase.from("construction_roadmap_access").select("model_id, amount_paid, is_test_grant, created_at").eq("user_id", user.id),
      supabase.from("linked_bank_accounts").select("bank_name, account_number, account_name").eq("user_id", user.id).maybeSingle(),
      supabase.from("engage_chs_requests").select("reference, service_type, status").eq("owner_id", user.id),
    ]);

    setTraceData({
      wallet: walletRes.data,
      walletTx: walletTxRes.data || [],
      promoCredits: promoTxRes.data || [],
      promotions: (promoRes.data as TracePromotion[]) || [],
      roadmapAccess: roadmapRes.data || [],
      bankAccount: bankRes.data,
      engageRequests: engageRes.data || [],
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
    loadData();
  }

  // Genuinely never approves an application directly — only ever moves
  // it forward to the property's real owner for the actual final
  // decision, matching the fix already built into this table from the
  // start (see backend-v2/12_rental_applications.sql).
  async function handleApplicationScreened(applicationId: string) {
    setActionError(null);
    const { error } = await supabase
      .from("rental_applications")
      .update({ status: "awaiting_owner_decision" })
      .eq("id", applicationId);
    if (error) {
      setActionError("Could not update this application. Please try again.");
      return;
    }
    loadData();
  }

  async function handleRelayOwnerDecision(applicationId: string) {
    setActionError(null);
    const { error } = await supabase.rpc("relay_owner_decision_to_tenant", { p_application_id: applicationId });
    if (error) {
      setActionError(error.message);
      return;
    }
    loadData();
  }

  async function handlePropertyVerification(propertyId: string, status: "verified" | "rejected") {
    setActionError(null);
    const { error } = await supabase.rpc("request_admin_action", {
      p_action_type: "verify_property",
      p_target_id: propertyId,
      p_proposed_changes: { verification_status: status },
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    loadData();
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
    loadData();
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
    loadData();
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
    loadData();
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
    loadData();
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
    loadData();
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
    loadData();
  }

  async function handleBuyerIdReview(submissionId: string, approve: boolean) {
    setActionError(null);
    const { error } = await supabase.rpc("request_admin_action", {
      p_action_type: "review_buyer_id",
      p_target_id: submissionId,
      p_proposed_changes: { status: approve ? "approved" : "rejected" },
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    loadData();
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
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
          <div className="flex items-center gap-2">
            {/* Real, new feature per direct client request: a genuine,
                live notification bell — no more relying on admin to
                remember to check for pending items. */}
            <button onClick={handleOpenNotifBell} className="relative bg-white/15 p-2 rounded-full">
              🔔
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-chs-red text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                </span>
              )}
            </button>
            <button onClick={() => signOut()} className="bg-white/15 px-3 py-1.5 rounded-full text-xs font-semibold">
              Log out
            </button>
          </div>
        </div>
        {showNotifBell && (
          <div className="bg-white rounded-xl mt-2 p-3 max-h-72 overflow-y-auto">
            {adminNotifications.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No notifications yet.</p>
            ) : (
              adminNotifications.map((n) => (
                <div key={n.id} className={`p-2 rounded-lg mb-1.5 ${n.read ? "bg-gray-50" : "bg-chs-amber-light"}`}>
                  <p className="text-xs font-semibold text-chs-charcoal">{n.title}</p>
                  <p className="text-[10px] text-gray-500">{n.body}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        )}
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

      <div className="flex border-b border-gray-200 bg-white px-4 overflow-x-auto">
        {([
          { key: "overview", label: "Overview", domain: null },
          { key: "analytics", label: "📊 Analytics", domain: null },
          { key: "finance", label: "Finance", domain: "finance" },
          { key: "trace", label: "🔎 Trace an Account", domain: "super_admin_only" },
          { key: "saleapprovals", label: `Sale Approvals (${pendingSaleApprovals.length})`, domain: "owner_buyer_tenant" },
          { key: "liveness", label: `Face Verification (${pendingLiveness.length})`, domain: "registration_setup" },
          { key: "registrations", label: `Registrations (${pendingRegistrationsFull.length})`, domain: "registration_setup" },
          { key: "applications", label: `Applications (${pendingApplications.length})`, domain: "owner_buyer_tenant" },
          { key: "properties", label: `Properties (${pendingProperties.length})`, domain: "owner_buyer_tenant" },
          { key: "disputes", label: `Disputes (${openDisputes.length})`, domain: "customer_care" },
          { key: "feedback", label: `Feedback (${pendingFeedback.length})`, domain: "customer_care" },
          { key: "engage", label: `Engage CHS (${pendingEngage.length})`, domain: "super_admin_only" },
          { key: "vendors", label: `Vendors (${pendingVendors.length})`, domain: "artisan_dev_pm_vendor" },
          { key: "referrals", label: `Referral fees (${owedFees.filter(f => f.status === "owed").length})`, domain: "agent_relations" },
          { key: "faults", label: `Maintenance (${unroutedFaults.length})`, domain: "artisan_dev_pm_vendor" },
          { key: "artisans", label: `Artisans (${pendingArtisans.length})`, domain: "artisan_dev_pm_vendor" },
          { key: "inspections", label: `Inspections (${upcomingInspections.length})`, domain: "owner_buyer_tenant" },
          { key: "developers", label: `Developers (${developerApplications.length})`, domain: "artisan_dev_pm_vendor" },
          { key: "tenantregisteroversight", label: "Tenant Register Oversight", domain: "owner_buyer_tenant" },
          { key: "shortletdeposits", label: "Shortlet/Hire Deposits", domain: "owner_buyer_tenant" },
        ] as { key: Tab; label: string; domain: string | null }[])
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
          .map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`text-xs font-semibold px-3 py-3 border-b-2 whitespace-nowrap ${
              activeTab === tab.key ? "border-chs-red text-chs-charcoal" : "border-transparent text-gray-400"
            }`}
          >
            {tab.label}
          </button>
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
              <p className="text-[10px] text-white/50 mt-1">Sum of every real, paid commission across Sale, Rental, Shortlet/Hire, and Rent-to-Own — updates automatically as real transactions complete.</p>
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
                {pendingLegalTransfers.map((offer) => (
                  <div key={offer.id} className="bg-white rounded-lg p-2.5 mb-2 last:mb-0">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-chs-charcoal font-semibold">{offer.properties?.title || "Property"}</span>
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

            {pendingPrecommitMessages.length > 0 && (
              <div className="col-span-2 bg-white rounded-xl border-2 border-chs-amber-dark p-3">
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
            {profile?.is_super_admin && (
              <div className="col-span-2 bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4 space-y-2">
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
                <button onClick={handleAssignStaffRole} disabled={assigning}
                  className="w-full py-2.5 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">
                  {assigning ? "Assigning..." : "Assign role"}
                </button>
              </div>
            )}
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
            <div className="flex gap-2 overflow-x-auto pb-1">
              {([
                { key: "today", label: "Today" },
                { key: "week", label: "This Week" },
                { key: "month", label: "This Month" },
                { key: "quarter", label: "This Quarter" },
              ] as const).map((p) => (
                <button key={p.key} onClick={() => { setAnalyticsPeriod(p.key); loadAnalytics(p.key); }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${
                    analyticsPeriod === p.key ? "bg-chs-red text-white" : "bg-gray-100 text-gray-600"
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>

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
                              {p.properties?.[0]?.title || "Untitled"} — {p.is_active ? "ON" : "OFF"}{p.rank_category && `, Category ${p.rank_category}`}
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
                  </div>
                )}
              </div>
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
                  <p className="text-sm font-semibold text-chs-charcoal">{offer.properties?.title || "Property"}</p>
                  <p className="text-xs text-gray-500 mt-1">Accepted offer: {formatNaira(offer.amount)}</p>
                  {offer.note && <p className="text-xs text-gray-400 mt-1">{offer.note}</p>}
                  <button onClick={() => handleClearSale(offer.id)}
                    className="w-full mt-2 py-2 rounded-full bg-chs-red text-white text-xs font-semibold">
                    Clear for escrow
                  </button>
                </div>
              ))
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
                  <p className="text-sm font-semibold text-chs-charcoal mb-2">{sub.profiles?.full_name || "User"}</p>
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

            <p className="text-xs font-bold text-chs-charcoal mt-4 mb-2">📜 Real Sale Legal Documents ({pendingSaleDocs.length})</p>
            {pendingSaleDocs.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No sale documents pending review.</p>
            ) : (
              pendingSaleDocs.map((doc) => (
                <div key={doc.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <p className="text-sm font-semibold text-chs-charcoal mb-1">{doc.properties?.title || "Property"}</p>
                  <p className="text-xs text-gray-500 mb-2 capitalize">{doc.document_type.replace(/_/g, " ")}</p>
                  <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-[10px] text-chs-red underline block mb-2">View uploaded document</a>
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

            <p className="text-xs font-bold text-chs-charcoal mt-4 mb-2">🔒 Real Held Funds — Confirm Legal Transfer ({pendingLegalTransfers.length})</p>
            {pendingLegalTransfers.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No sales awaiting legal transfer confirmation.</p>
            ) : (
              pendingLegalTransfers.map((offer) => (
                <div key={offer.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <p className="text-sm font-semibold text-chs-charcoal mb-1">{offer.properties?.title || "Property"}</p>
                  <p className="text-xs text-gray-500 mb-2">Real funds held: {formatNaira(offer.amount)}</p>
                  <button onClick={() => handleConfirmLegalTransfer(offer.id)}
                    className="w-full py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                    ✓ Confirm real legal documents transferred — release funds
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
                  <p className="text-sm font-semibold text-chs-charcoal">{p.full_name}</p>
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
          </div>
        )}

        {activeTab === "applications" &&
          (pendingApplications.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No pending rental applications.</p>
          ) : (
            pendingApplications.map((app) => (
              <div key={app.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                <p className="text-sm font-semibold text-chs-charcoal">{app.properties?.title || "Property"}</p>
                <p className="text-[10px] text-gray-500 mb-2">
                  {app.properties?.street_address ? `${app.properties.street_address}, ` : ""}{app.properties?.location_area}
                  {" — Owner: "}{app.properties?.profiles?.full_name} ({app.properties?.profiles?.phone})
                </p>

                <p className="text-[10px] font-bold text-gray-400 uppercase mt-2">Applicant</p>
                <p className="text-xs text-chs-charcoal">{app.tenant?.full_name} — {app.tenant?.phone}</p>
                <p className="text-[11px] text-gray-500">{app.applicant_occupation} · {app.applicant_present_address}</p>
                <p className="text-[11px] text-gray-500">Income: {app.applicant_income_source}</p>
                <p className="text-[11px] text-gray-500">{app.applicant_id_type} — {app.applicant_id_number}</p>
                {app.applicant_id_document_url && (
                  <a href={app.applicant_id_document_url} target="_blank" rel="noreferrer" className="text-[10px] text-chs-red underline">View applicant ID</a>
                )}

                <p className="text-[10px] font-bold text-gray-400 uppercase mt-2">Guarantor</p>
                <p className="text-xs text-chs-charcoal">{app.guarantor_name} — {app.guarantor_phone}</p>
                <p className="text-[11px] text-gray-500">{app.guarantor_relationship} · {app.guarantor_occupation}</p>
                <p className="text-[11px] text-gray-500">{app.guarantor_address}</p>
                <p className="text-[11px] text-gray-500">Move-in: {app.move_in_date} {app.guarantor_consented ? "· ✓ Consent given" : "· ⚠️ No consent recorded"}</p>

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
            pendingProperties.map((prop) => (
              <div key={prop.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3">
                <p className="text-sm font-semibold text-chs-charcoal">{prop.title}</p>
                <p className="text-xs text-gray-500">{prop.location_area} — {prop.purpose}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handlePropertyVerification(prop.id, "verified")}
                    className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                    Verify
                  </button>
                  <button onClick={() => handlePropertyVerification(prop.id, "rejected")}
                    className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
          </div>
        )}


        {activeTab === "disputes" &&
          (openDisputes.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No open disputes.</p>
          ) : (
            openDisputes.map((d) => (
              <div key={d.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3">
                <p className="text-sm text-chs-charcoal">{d.description}</p>
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
          ))}

        {activeTab === "feedback" &&
          (pendingFeedback.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No pending community feedback.</p>
          ) : (
            pendingFeedback.map((f) => (
              <div key={f.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3">
                <p className="text-sm text-chs-charcoal">{f.note}</p>
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
          ))}

        {activeTab === "engage" &&
          (pendingEngage.length === 0 ? (
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
          ))}

        {activeTab === "vendors" &&
          (pendingVendors.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No pending vendor registrations.</p>
          ) : (
            pendingVendors.map((v) => (
              <div key={v.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3">
                <p className="text-sm font-semibold text-chs-charcoal">{v.business_name}</p>
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
                    <span className="text-[9px] font-bold uppercase text-gray-400">{r.stage}</span>
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
                    <p className="text-[10px] text-gray-400 mt-1 capitalize">Status: {f.status.replace(/_/g, " ")}</p>
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
          <>
            {pendingArtisans.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No pending artisan registrations.</p>
            ) : (
              pendingArtisans.map((a) => (
                <div key={a.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <p className="text-sm font-semibold text-chs-charcoal capitalize">{a.trades?.join(", ")}</p>
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
          </>
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
                  {insp.transport_fee != null && (
                    <p className="text-xs text-gray-500">🚗 Transport: {formatNaira(insp.transport_fee)} (per person)</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">Ref {insp.reference}</p>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "developers" && (
          <>
            {developerApplications.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No pending developer applications.</p>
            ) : (
              developerApplications.map((d) => (
                <div key={d.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <p className="text-sm font-semibold text-chs-charcoal">🏗️ {d.company_name}</p>
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
          </>
        )}

        {activeTab === "tenantregisteroversight" && (
          <div>
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

        {activeTab === "shortletdeposits" && (
          <div>
            <p className="text-xs text-gray-500 mb-2">
              Real security deposits currently held, awaiting a genuine decision — released back to the guest if there was no real damage, or claimed for the host if there was, always with a real, recorded reason.
            </p>
            {heldDeposits.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No real deposits currently held.</p>
            ) : (
              heldDeposits.map((d) => (
                <div key={d.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                  <p className="text-sm font-semibold text-chs-charcoal">{d.properties?.[0]?.title || "Property"}</p>
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
      </div>
      {showGuide && <GuidePrompt role="admin" onDismiss={() => setShowGuide(false)} />}
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
      <p className="text-sm font-semibold text-chs-charcoal">{request.service_type}</p>
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
