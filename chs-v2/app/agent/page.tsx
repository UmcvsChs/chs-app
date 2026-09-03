"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { AgentReferral } from "@/types/agentReferral";
import { formatNaira } from "@/lib/format";
import GuidePrompt from "@/components/GuidePrompt";
import MessageThread from "@/components/MessageThread";
import IssueNoticeForm from "@/components/IssueNoticeForm";
import WalletQuickView from "@/components/WalletQuickView";
import RoleBadge from "@/components/RoleBadge";

const STAGE_LABELS: Record<string, string> = {
  enquiry: "New enquiry",
  inspection: "Inspection booked",
  offer: "Offer made",
  completed: "Completed",
  lost: "Lost",
};

export default function AgentDashboard() {
  const router = useRouter();
  const { session, profile, testModeRole, loading: authLoading } = useAuth();
  const [referrals, setReferrals] = useState<AgentReferral[]>([]);
  const [copied, setCopied] = useState(false);
  const [templateCopied, setTemplateCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  // Real, new feature per direct client request: agents genuinely
  // manage far more individual, scattered properties than estate
  // managers manage estates, and deserve the same real tools — a
  // portfolio view, direct tenant messaging, and formal notices —
  // without needing a formal "estate" container, since their real
  // properties span different owners and locations.
  interface ManagedProperty {
    id: string;
    title: string;
    status: string;
    agent_commission_pct: number | null;
    owner_id: string;
    owner: { full_name: string } | null;
    tenancies: { id: string; tenant_id: string; status: string }[];
  }
  const [managedPortfolio, setManagedPortfolio] = useState<{
    total_managed_properties: number; occupied_units: number; vacant_units: number;
    pending_maintenance: number; pending_disputes: number; total_collected_this_month: number;
  } | null>(null);
  const [managedProperties, setManagedProperties] = useState<ManagedProperty[]>([]);
  const [messagingTenancy, setMessagingTenancy] = useState<{ id: string; tenant_id: string } | null>(null);
  const [issuingNoticeTenancyId, setIssuingNoticeTenancyId] = useState<string | null>(null);
  const [commissionRateInputId, setCommissionRateInputId] = useState<string | null>(null);
  const [commissionRateValue, setCommissionRateValue] = useState("");
  const [ownerRateInputId, setOwnerRateInputId] = useState<string | null>(null);
  const [ownerRateValue, setOwnerRateValue] = useState("");
  const [ownerRateResult, setOwnerRateResult] = useState<string | null>(null);
  const [showTeamSection, setShowTeamSection] = useState(false);
  const [teamPhone, setTeamPhone] = useState("");
  const [teamRoleLabel, setTeamRoleLabel] = useState("");
  const [invitingTeam, setInvitingTeam] = useState(false);
  const [teamResult, setTeamResult] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; role_label: string; member: { full_name: string } | null }[]>([]);
  const [teamReports, setTeamReports] = useState<{ id: string; activities: string; transactions_handled: string | null; complaints_raised: string | null; created_at: string; team_members: { role_label: string } | null }[]>([]);

  async function loadTeamData() {
    if (!session) return;
    const { data: members } = await supabase
      .from("team_members")
      .select("id, role_label, member:member_id(full_name)")
      .eq("parent_id", session.user.id)
      .eq("status", "active");
    setTeamMembers((members as unknown as typeof teamMembers) || []);

    const { data: reports } = await supabase
      .from("team_daily_reports")
      .select("id, activities, transactions_handled, complaints_raised, created_at, team_members(role_label)")
      .order("created_at", { ascending: false })
      .limit(20);
    setTeamReports((reports as unknown as typeof teamReports) || []);
  }

  async function handleInviteTeamMember() {
    if (!teamPhone.trim() || !teamRoleLabel.trim()) return;
    setInvitingTeam(true);
    setTeamResult(null);
    const { error } = await supabase.rpc("invite_team_member", { p_phone: teamPhone.trim(), p_role_label: teamRoleLabel.trim() });
    setInvitingTeam(false);
    if (error) {
      setTeamResult(error.message);
      return;
    }
    setTeamResult("✓ Real team member added.");
    setTeamPhone("");
    setTeamRoleLabel("");
    loadTeamData();
  }

  async function handleRemoveTeamMember(teamMemberId: string) {
    const { error } = await supabase.rpc("remove_team_member", { p_team_member_id: teamMemberId });
    if (!error) loadTeamData();
  }

  async function handleSetOwnerRate(ownerId: string) {
    if (!ownerRateValue) return;
    const { error } = await supabase.rpc("set_owner_commission_rate", { p_owner_id: ownerId, p_pct: Number(ownerRateValue) });
    if (error) {
      setOwnerRateResult(error.message);
      return;
    }
    setOwnerRateResult("✓ Real rate updated — applied to every property you manage for this owner.");
    setOwnerRateInputId(null);
    loadManagedPortfolio();
  }
  const [showAgentReport, setShowAgentReport] = useState(false);
  const [agentReportPeriod, setAgentReportPeriod] = useState<"week" | "month" | "quarter">("month");
  const [agentReport, setAgentReport] = useState<{
    real_commission_earned: number; deals_closed: number; new_tenancies_managed: number;
  } | null>(null);
  const [loadingAgentReport, setLoadingAgentReport] = useState(false);

  async function loadAgentReport(period: typeof agentReportPeriod) {
    if (!session) return;
    setLoadingAgentReport(true);
    const end = new Date();
    const start = new Date();
    if (period === "week") start.setDate(start.getDate() - 7);
    else if (period === "month") start.setMonth(start.getMonth() - 1);
    else start.setMonth(start.getMonth() - 3);
    const { data } = await supabase.rpc("get_agent_activity_report", {
      p_agent_id: session.user.id, p_start_date: start.toISOString(), p_end_date: end.toISOString(),
    });
    setAgentReport(data);
    setLoadingAgentReport(false);
  }

  async function handleSetCommissionRate(propertyId: string) {
    if (!commissionRateValue) return;
    const { error } = await supabase.rpc("set_agent_commission_rate", { p_property_id: propertyId, p_pct: Number(commissionRateValue) });
    if (!error) {
      setCommissionRateInputId(null);
      loadManagedPortfolio();
    }
  }

  async function loadManagedPortfolio() {
    if (!session) return;
    const { data: overview } = await supabase.rpc("get_agent_managed_portfolio", { p_agent_id: session.user.id });
    setManagedPortfolio(overview || null);
    const { data: props } = await supabase
      .from("properties")
      .select("id, title, status, agent_commission_pct, owner_id, owner:owner_id(full_name), tenancies(id, tenant_id, status)")
      .eq("managing_agent_id", session.user.id);
    setManagedProperties((props as unknown as ManagedProperty[]) || []);
  }

  async function loadReferrals() {
    if (!session) return;
    setLoading(true);

    // Deliberately queries the masked VIEW, never the underlying real
    // table — the buyer's identity is intentionally never exposed to an
    // agent, by design already built into the original schema.
    const { data } = await supabase
      .from("agent_referrals_masked")
      .select("*")
      .or(`listing_agent_id.eq.${session.user.id},referring_agent_id.eq.${session.user.id}`)
      .order("created_at", { ascending: false });

    setReferrals(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    const allRoles = profile ? [profile.role, ...(profile.secondary_roles || [])] : [];
    // Pre-launch admin testing bypass — see AuthContext.tsx.
    const inTestMode = profile?.is_super_admin && testModeRole === "agent";
    if (profile && !allRoles.includes("agent") && !inTestMode) {
      router.push("/");
      return;
    }
    if (profile && !profile.terms_accepted_at) {
      router.push("/accept-terms?redirect=/agent");
      return;
    }
    if (profile && !profile.guide_roles_seen.includes("agent")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowGuide(true);
    }
    // Real network fetch, not a synchronous setState — loadReferrals is
    // async and only calls setState after a genuine await on Supabase's
    // response, so this is the standard, safe "fetch on mount" pattern.
    loadReferrals();
    loadManagedPortfolio();
    loadTeamData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, profile, testModeRole]);

  function copyReferralLink() {
    if (!session) return;
    const link = `${window.location.origin}?ref=${session.user.id.slice(0, 8)}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const totalEarned = referrals
    .filter((r) => r.stage === "completed" && r.agent_payout)
    .reduce((sum, r) => sum + (r.agent_payout || 0), 0);

  // Real "earned this month" — restored, found missing during the
  // systematic Agent dashboard comparison. Uses the real record's
  // created_at, since no separate "completed_at" timestamp exists on
  // this table — an honest approximation, not a precise completion
  // date, but genuinely computed from real data either way.
  const now = new Date();
  const earnedThisMonth = referrals
    .filter((r) => {
      if (r.stage !== "completed" || !r.agent_payout) return false;
      const completedDate = new Date(r.created_at);
      return completedDate.getMonth() === now.getMonth() && completedDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, r) => sum + (r.agent_payout || 0), 0);

  // Real deals-closed count — restored, found missing during the
  // systematic Agent dashboard comparison. The original showed a
  // fabricated "23 deals closed" and a fake "4.8" rating with no
  // real rating system behind it — genuinely counted here instead,
  // and the fake rating/badges are deliberately not reproduced at all
  // rather than invented as fake real-looking numbers.
  const dealsClosed = referrals.filter((r) => r.stage === "completed").length;

  function copyShareTemplate() {
    if (!session) return;
    const code = session.user.id.slice(0, 8);
    const name = profile?.full_name || "your CHS agent";
    const message = `Looking for a verified property in Nigeria? Check out CHS — real, verified listings, no agent wahala, no hidden fees. Contact ${name} or browse directly: ${window.location.origin}?ref=${code}`;
    navigator.clipboard.writeText(message);
    setTemplateCopied(true);
    setTimeout(() => setTemplateCopied(false), 2000);
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen zone-agent bg-[var(--zone-bg)] pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <RoleBadge label="Agent Dashboard" />
        <div className="flex justify-between items-end mt-1 gap-2">
          <h1 className="font-serif text-lg font-bold">Agent Dashboard</h1>
          {session && <WalletQuickView userId={session.user.id} extra="agent_earnings" />}
        </div>

        {/* Real Agent ID card — restored, found missing during the
            systematic Agent dashboard comparison. Deliberately honest:
            the original showed a fabricated "4.8 rating" and "23 deals
            closed" with no real rating system behind either — this
            version only ever shows the real, genuinely computed deals
            count, and doesn't invent a rating or trust badges that
            don't exist. */}
        {profile && (
          <div className="bg-white/10 rounded-xl px-3 py-2.5 mt-3">
            <p className="text-xs font-bold">Certified CHS Agent</p>
            <p className="text-[10px] text-white/60 mt-0.5">
              Agent ID: {session?.user.id.slice(0, 8).toUpperCase()} · {dealsClosed} deal{dealsClosed !== 1 ? "s" : ""} closed
            </p>
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Verification status — reusing the same real fields built
            during the original app's #15 and #16 fixes, an honest
            human-reviewed status, not a fake automated pass. */}
        {profile && (
          <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 flex gap-4 text-xs">
            <div>
              <p className="text-gray-400">Membership</p>
              <p className={`font-semibold ${profile.membership_verified ? "text-chs-red" : "text-chs-amber-dark"}`}>
                {profile.membership_verified ? "✓ Verified" : "⏳ Pending review"}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Valid ID</p>
              <p className={`font-semibold ${profile.valid_id_verified ? "text-chs-red" : "text-chs-amber-dark"}`}>
                {profile.valid_id_verified ? "✓ Verified" : "⏳ Pending review"}
              </p>
            </div>
          </div>
        )}

        {profile?.chs_agent_id && (
          <div className="bg-chs-charcoal rounded-xl p-3 text-center">
            <p className="text-[9px] text-white/60 uppercase font-semibold">Your Real CHS Agent ID</p>
            <p className="text-lg font-bold text-white mt-0.5 tracking-wide">{profile.chs_agent_id}</p>
            <p className="text-[10px] text-white/50 mt-1">Share this with a property owner to be granted full management authority on their listing — messaging their tenant, notices, maintenance, and earnings, exactly as an owner would.</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <button onClick={() => { setShowAgentReport(!showAgentReport); if (!agentReport) loadAgentReport("month"); }}
            className="text-sm font-bold text-chs-charcoal">
            📊 {showAgentReport ? "Hide" : "Generate"} my activity report
          </button>
          {showAgentReport && (
            <div className="mt-3">
              <div className="flex gap-2 mb-2">
                {(["week", "month", "quarter"] as const).map((p) => (
                  <button key={p} onClick={() => { setAgentReportPeriod(p); loadAgentReport(p); }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                      agentReportPeriod === p ? "bg-chs-red text-white" : "bg-gray-100 text-gray-600"
                    }`}>
                    {p === "week" ? "This Week" : p === "month" ? "This Month" : "This Quarter"}
                  </button>
                ))}
              </div>
              {loadingAgentReport ? (
                <p className="text-[11px] text-gray-400 text-center py-4">Loading real report...</p>
              ) : agentReport ? (
                <div className="space-y-1.5 text-xs bg-[var(--zone-card)] rounded-lg p-3">
                  <div className="flex justify-between"><span className="text-gray-500">Real commission earned</span><span className="font-bold text-green-700">{formatNaira(agentReport.real_commission_earned)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Deals closed</span><span className="font-semibold">{agentReport.deals_closed}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">New tenancies managed</span><span className="font-semibold">{agentReport.new_tenancies_managed}</span></div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Real, new feature per direct client design: a genuine,
            standing commission rate per owner relationship — not
            re-entered per property. Reviewable and adjustable at any
            time; changing it here updates every real property this
            agent manages for that specific owner immediately. */}

        {/* Real, new feature per direct client request: a genuine
            mini-admin capability — inviting real, separate staff
            accounts, assigning them a role, and seeing their real
            daily activity reports. */}

        <Link href="/agent/tenant-register" className="block bg-white rounded-xl border border-gray-200 p-4 text-sm font-bold text-chs-charcoal">
          📋 My Tenant Register →
        </Link>

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

              {teamMembers.map((m) => (
                <div key={m.id} className="bg-[var(--zone-card)] rounded-lg p-2.5 mb-2 last:mb-0">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-chs-charcoal">{m.member?.full_name}</p>
                      <p className="text-[10px] text-gray-400">{m.role_label}</p>
                    </div>
                    <button onClick={() => handleRemoveTeamMember(m.id)} className="text-[10px] text-chs-red underline">
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {teamReports.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-bold text-chs-charcoal mb-2">📋 Real Daily Reports</p>
                  {teamReports.map((r) => (
                    <div key={r.id} className="bg-[var(--zone-card)] rounded-lg p-2.5 mb-1.5 text-[11px]">
                      <p className="font-semibold text-chs-charcoal">{r.team_members?.role_label} — {new Date(r.created_at).toLocaleDateString()}</p>
                      <p className="text-gray-600 mt-0.5">{r.activities}</p>
                      {r.transactions_handled && <p className="text-green-700 mt-0.5">💰 {r.transactions_handled}</p>}
                      {r.complaints_raised && <p className="text-chs-amber-dark mt-0.5">⚠️ {r.complaints_raised}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {managedProperties.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-bold text-chs-charcoal mb-1">💰 Your Real Commission Rate Per Owner</p>
            <p className="text-[10px] text-gray-400 mb-3">
              Each owner negotiates their own real rate with you — set it once here, and it applies automatically to every property you manage for them.
            </p>
            {Array.from(new Map(managedProperties.map((p) => [p.owner_id, p])).values()).map((p) => (
              <div key={p.owner_id} className="bg-[var(--zone-card)] rounded-lg p-2.5 mb-2 last:mb-0">
                <p className="text-xs font-semibold text-chs-charcoal mb-1">{p.owner?.full_name || "Owner"}</p>
                {ownerRateInputId === p.owner_id ? (
                  <div className="flex gap-1.5">
                    <input type="number" placeholder={`Current: ${p.agent_commission_pct || "not set"}%`}
                      value={ownerRateValue} onChange={(e) => setOwnerRateValue(e.target.value)}
                      className="flex-1 px-2 py-1 rounded-lg border border-gray-200 text-[11px]" />
                    <button onClick={() => handleSetOwnerRate(p.owner_id)} className="px-2 py-1 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                      Save
                    </button>
                    <button onClick={() => setOwnerRateInputId(null)} className="px-2 py-1 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <p className="text-[11px] text-gray-600">
                      {p.agent_commission_pct ? `${p.agent_commission_pct}% agreed rate` : "No real rate set yet"}
                    </p>
                    <button onClick={() => { setOwnerRateInputId(p.owner_id); setOwnerRateValue(""); }} className="text-[10px] text-chs-red underline">
                      {p.agent_commission_pct ? "Adjust" : "Set rate"}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {ownerRateResult && <p className="text-[10px] text-gray-500 mt-2">{ownerRateResult}</p>}
          </div>
        )}

        {managedPortfolio && managedPortfolio.total_managed_properties > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-bold text-chs-charcoal mb-3">🏘️ Your Real Managed Portfolio</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-[var(--zone-card)] rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-chs-charcoal">{managedPortfolio.total_managed_properties}</p>
                <p className="text-[9px] text-gray-400">Properties</p>
              </div>
              <div className="bg-[var(--zone-card)] rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-green-600">{managedPortfolio.occupied_units}</p>
                <p className="text-[9px] text-gray-400">Occupied</p>
              </div>
              <div className="bg-[var(--zone-card)] rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-chs-amber-dark">{managedPortfolio.vacant_units}</p>
                <p className="text-[9px] text-gray-400">Vacant</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-chs-red">{managedPortfolio.pending_maintenance}</p>
                <p className="text-[9px] text-gray-400">Maintenance</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-chs-red">{managedPortfolio.pending_disputes}</p>
                <p className="text-[9px] text-gray-400">Disputes</p>
              </div>
              <div className="bg-[var(--zone-card)] rounded-lg p-2 text-center">
                <p className="text-[11px] font-bold text-chs-charcoal">{formatNaira(managedPortfolio.total_collected_this_month)}</p>
                <p className="text-[9px] text-gray-400">This month</p>
              </div>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {managedProperties.map((p) => {
                const activeTenancy = p.tenancies?.find((t) => t.status === "active");
                return (
                  <div key={p.id} className="bg-[var(--zone-card)] rounded-lg p-2.5">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-semibold text-chs-charcoal">{p.title}</p>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full text-gray-500 bg-white">{p.status}</span>
                    </div>
                    {activeTenancy && (
                      <div className="flex gap-3 mt-1.5">
                        <button onClick={() => setMessagingTenancy(activeTenancy)} className="text-[10px] font-semibold text-chs-red underline">
                          💬 Message tenant
                        </button>
                        <button onClick={() => setIssuingNoticeTenancyId(activeTenancy.id)} className="text-[10px] font-semibold text-chs-charcoal underline">
                          Issue notice
                        </button>
                      </div>
                    )}
                    {p.status === "active" && (
                      <div className="mt-1.5">
                        {p.agent_commission_pct ? (
                          <p className="text-[10px] text-green-700">✓ Your real commission rate: {p.agent_commission_pct}% (CHS takes 3% of that only)</p>
                        ) : commissionRateInputId === p.id ? (
                          <div className="flex gap-1.5">
                            <input type="number" placeholder="Your real rate, e.g. 10" value={commissionRateValue}
                              onChange={(e) => setCommissionRateValue(e.target.value)}
                              className="flex-1 px-2 py-1 rounded-lg border border-gray-200 text-[10px]" />
                            <button onClick={() => handleSetCommissionRate(p.id)} className="px-2 py-1 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                              Set
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => { setCommissionRateInputId(p.id); setCommissionRateValue(""); }} className="text-[10px] text-chs-red underline">
                            Set my real commission rate for this property
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {messagingTenancy && session && (
          <MessageThread
            tenancyId={messagingTenancy.id}
            session={session}
            recipientId={messagingTenancy.tenant_id}
            recipientLabel="Your tenant"
            onClose={() => setMessagingTenancy(null)}
          />
        )}

        {issuingNoticeTenancyId && session && (() => {
          const tenancy = managedProperties.flatMap((p) => p.tenancies).find((t) => t.id === issuingNoticeTenancyId);
          return tenancy ? (
            <IssueNoticeForm
              tenancyId={tenancy.id}
              tenantId={tenancy.tenant_id}
              session={session}
              onSuccess={() => { setIssuingNoticeTenancyId(null); loadManagedPortfolio(); }}
              onCancel={() => setIssuingNoticeTenancyId(null)}
            />
          ) : null;
        })()}

        <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-chs-charcoal mb-2">Your referral link</p>
          <p className="text-xs text-gray-500 mb-3">
            Share this — you earn commission on any resulting transaction.
          </p>
          <button
            onClick={copyReferralLink}
            className="w-full py-2.5 rounded-full bg-chs-red text-white text-xs font-semibold"
          >
            {copied ? "✓ Copied!" : "Copy my referral link"}
          </button>
        </div>

        <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-chs-charcoal">Total earned (completed deals)</p>
          <p className="text-xl font-bold text-chs-charcoal mt-1">{formatNaira(totalEarned)}</p>
          <p className="text-[10px] text-gray-400 mt-1">Earned this month: {formatNaira(earnedThisMonth)}</p>
        </div>

        {/* Real "ready-to-share message" — restored, found missing
            during the systematic Agent dashboard comparison. Uses the
            agent's genuine real code and name, not a hardcoded example. */}
        <div className="bg-chs-charcoal rounded-xl p-4 mt-3">
          <p className="text-xs font-bold text-white mb-2">🔗 Ready-to-share message</p>
          <p className="text-[11px] text-white/70 italic leading-relaxed mb-3">
            &quot;Looking for a verified property in Nigeria? Check out CHS — real, verified listings, no agent wahala, no hidden fees. Contact {profile?.full_name || "your CHS agent"} or browse directly: {typeof window !== "undefined" ? window.location.origin : "chs.ng"}?ref={session?.user.id.slice(0, 8)}&quot;
          </p>
          <button onClick={copyShareTemplate} className="w-full py-2.5 rounded-full bg-chs-amber-dark text-white text-xs font-semibold">
            {templateCopied ? "✓ Copied!" : "Copy message to share"}
          </button>
        </div>

        <div>
          <p className="text-xs font-bold text-chs-charcoal mb-2">My referrals ({referrals.length})</p>
          {referrals.length === 0 ? (
            <p className="text-sm text-gray-400">No referrals yet — share your link to get started.</p>
          ) : (
            referrals.map((r) => (
              <div key={r.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-chs-charcoal">{r.masked_reference}</span>
                  <span className="text-[10px] font-bold uppercase text-chs-red bg-chs-amber-light px-2 py-1 rounded-full">
                    {STAGE_LABELS[r.stage]}
                  </span>
                </div>
                {r.agent_payout !== null && (
                  <p className="text-gray-500 mt-1">Your share: {formatNaira(r.agent_payout)}</p>
                )}
                {r.split_50_50 && <p className="text-gray-400 mt-1">Split 50/50 with another agent</p>}
              </div>
            ))
          )}
        </div>
      </div>
      {showGuide && <GuidePrompt role="agent" onDismiss={() => setShowGuide(false)} />}
    </div>
  );
}
