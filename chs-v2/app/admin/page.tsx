"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

type Tab = "overview" | "finance" | "saleapprovals" | "liveness" | "registrations" | "applications" | "properties" | "disputes" | "feedback" | "engage" | "vendors" | "referrals" | "faults" | "artisans" | "inspections" | "developers";

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
      supabase.from("rental_applications").select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(200),
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
      supabase.from("developer_applications").select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(200),
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
    const { data: dispute, error } = await supabase.from("disputes").update({ status, ruling_notes: notes || null }).eq("id", disputeId).select().single();
    if (error) {
      setActionError("Could not record this ruling. Please try again.");
      return;
    }
    // Both real parties genuinely need to know the outcome — not just
    // whoever happens to check back later.
    if (dispute) {
      const rulingText = status === "ruled_for_tenant" ? "in the tenant's favour" : "in the owner's favour";
      await supabase.rpc("notify_user", {
        p_user_id: dispute.raised_by,
        p_title: "Your dispute has been resolved",
        p_body: `CHS has ruled ${rulingText}. ${notes || ""}`,
      });
      if (dispute.against) {
        await supabase.rpc("notify_user", {
          p_user_id: dispute.against,
          p_title: "A dispute involving you has been resolved",
          p_body: `CHS has ruled ${rulingText}. ${notes || ""}`,
        });
      }
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

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen zone-admin bg-[var(--zone-bg)] pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
          <button onClick={() => signOut()} className="bg-white/15 px-3 py-1.5 rounded-full text-xs font-semibold">
            Log out
          </button>
        </div>
        <h1 className="font-serif text-lg font-bold mt-1">Admin</h1>
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
          { key: "finance", label: "Finance", domain: "finance" },
          { key: "saleapprovals", label: `Sale Approvals (${pendingSaleApprovals.length})`, domain: "owner_buyer_tenant" },
          { key: "liveness", label: `Face Verification (${pendingLiveness.length})`, domain: "registration_setup" },
          { key: "registrations", label: `Registrations (${pendingProfiles.length})`, domain: "registration_setup" },
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
          </div>
        )}

        {activeTab === "registrations" &&
          (pendingProfiles.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No pending registrations.</p>
          ) : (
            pendingProfiles.map((p) => (
              <div key={p.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3">
                <p className="text-sm font-semibold text-chs-charcoal">{p.full_name}</p>
                <p className="text-xs text-gray-500">
                  {p.phone} — {p.role} — {p.state}
                </p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleProfileDecision(p.id, "approved")}
                    className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                    Approve
                  </button>
                  <button onClick={() => handleProfileDecision(p.id, "rejected")}
                    className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                    Reject
                  </button>
                </div>
              </div>
            ))
          ))}

        {activeTab === "applications" &&
          (pendingApplications.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No pending rental applications.</p>
          ) : (
            pendingApplications.map((app) => (
              <div key={app.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3">
                <p className="text-sm font-semibold text-chs-charcoal">Guarantor: {app.guarantor_name}</p>
                <p className="text-xs text-gray-500">{app.guarantor_phone} — Move-in: {app.move_in_date}</p>
                <button onClick={() => handleApplicationScreened(app.id)}
                  className="w-full mt-2 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                  Documents cleared — send to owner
                </button>
              </div>
            ))
          ))}

        {activeTab === "properties" &&
          (pendingProperties.length === 0 ? (
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
          ))}

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
            <p className="text-xs font-bold text-chs-charcoal mb-2">Fee per category (editable)</p>
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
                  <button onClick={() => handleDeveloperReviewed(d.id)}
                    className="mt-2 py-1.5 px-3 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                    Mark as reviewed — contacted directly
                  </button>
                </div>
              ))
            )}
          </>
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
  onAccept,
  onReject,
  onRequestMoreInfo,
}: {
  request: EngageRequest;
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
    </div>
  );
}
