"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import RoleBadge from "@/components/RoleBadge";
import WalletQuickView from "@/components/WalletQuickView";
import MessageThread from "@/components/MessageThread";
import InfoTip from "@/components/InfoTip";

// Real, new page per direct, detailed client design discussion: a
// genuine home for a tenant who has actually moved in — not another
// list of buttons, a real, single place to see the property, the
// wallets that fund it, the next rent due, the fault log, the real
// documents on file, and a direct line to whoever is actually
// responsible for the property. Built after discussing the shape of
// this directly with the client, not guessed at alone.

interface TenancyDetail {
  id: string; lease_start: string; lease_end: string; annual_rent: number;
  auto_pay_rent_enabled: boolean;
  landlord_id: string; manager_id: string | null; management_delegated: boolean;
  properties: { title: string; location_area: string; street_address: string } | null;
  landlord: { full_name: string; phone: string } | null;
  manager: { full_name: string; phone: string } | null;
}

interface FaultReport {
  id: string; ticket_number: string; category: string; urgency: string; status: string;
  location_in_property: string; description: string; created_at: string;
}

interface ConditionReportSummary {
  id: string; reference: string; report_type: string; status: string; submitted_at: string;
}

const FAULT_STATUS_LABEL: Record<string, string> = {
  reported: "Reported — awaiting response", assigned: "Assigned to an artisan",
  converted_to_quote: "Quote requested", gathering_quotes: "Gathering quotes",
  awaiting_owner_approval: "Awaiting owner approval", awaiting_manager_approval: "Awaiting manager approval",
  approved_by_owner: "Approved — work starting", approved_by_manager: "Approved — work starting",
  completed_pending_confirmation: "Work done — awaiting your confirmation", resolved: "✓ Resolved",
};

export default function MyRentedSpacePage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [tenancy, setTenancy] = useState<TenancyDetail | null>(null);
  const [faults, setFaults] = useState<FaultReport[]>([]);
  const [reports, setReports] = useState<ConditionReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showFaultForm, setShowFaultForm] = useState(false);

  const [faultCategory, setFaultCategory] = useState("plumbing");
  const [faultUrgency, setFaultUrgency] = useState("medium");
  const [faultLocation, setFaultLocation] = useState("");
  const [faultDescription, setFaultDescription] = useState("");
  const [faultSubmitting, setFaultSubmitting] = useState(false);
  const [faultError, setFaultError] = useState<string | null>(null);

  const [payingRent, setPayingRent] = useState(false);
  const [payMessage, setPayMessage] = useState("");

  useEffect(() => {
    if (!session) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  function loadData() {
    if (!session) return;
    supabase.from("tenancies")
      .select("id, lease_start, lease_end, annual_rent, auto_pay_rent_enabled, landlord_id, manager_id, management_delegated, properties(title, location_area, street_address), landlord:landlord_id(full_name, phone), manager:manager_id(full_name, phone)")
      .eq("tenant_id", session.user.id).eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        setTenancy(data as unknown as TenancyDetail);
        setLoading(false);
        if (data) {
          supabase.from("fault_reports").select("id, ticket_number, category, urgency, status, location_in_property, description, created_at")
            .eq("tenancy_id", data.id).order("created_at", { ascending: false })
            .then(({ data: f }) => setFaults(f || []));
          supabase.from("condition_reports").select("id, reference, report_type, status, submitted_at")
            .eq("tenancy_id", data.id).order("submitted_at", { ascending: false })
            .then(({ data: r }) => setReports(r || []));
        }
      });
  }

  async function handlePayRent(walletSource: "main" | "rent_savings") {
    if (!tenancy) return;
    setPayingRent(true);
    setPayMessage("");
    const { data, error } = await supabase.rpc("pay_rent", { p_tenancy_id: tenancy.id, p_wallet_source: walletSource });
    setPayingRent(false);
    if (error) {
      setPayMessage(error.message.includes("insufficient_balance") ? "Insufficient balance for the real total due." : error.message.replace("not_yet_due: ", ""));
      return;
    }
    setPayMessage(`✓ Paid ${formatNaira(data.real_total_paid)} — lease renewed.`);
    loadData();
  }

  async function handleReportFault() {
    if (!tenancy || !faultLocation.trim() || !faultDescription.trim()) {
      setFaultError("Please fill in the location and description.");
      return;
    }
    setFaultSubmitting(true);
    setFaultError(null);
    const { error } = await supabase.rpc("report_fault", {
      p_tenancy_id: tenancy.id, p_category: faultCategory, p_urgency: faultUrgency,
      p_location: faultLocation.trim(), p_description: faultDescription.trim(),
    });
    setFaultSubmitting(false);
    if (error) { setFaultError(error.message); return; }
    setShowFaultForm(false);
    setFaultLocation(""); setFaultDescription("");
    loadData();
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }
  if (!session) { router.push("/login"); return null; }
  if (!tenancy) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm text-gray-500 mb-3">You don&apos;t have a real, active tenancy yet.</p>
        <Link href="/tenant" className="text-sm font-semibold text-chs-red">Back to My Rentals</Link>
      </div>
    );
  }

  const daysLeft = Math.ceil((new Date(tenancy.lease_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const paymentUrgent = daysLeft <= 30;
  const responsibleName = tenancy.management_delegated ? tenancy.manager?.full_name : tenancy.landlord?.full_name;
  const responsiblePhone = tenancy.management_delegated ? tenancy.manager?.phone : tenancy.landlord?.phone;
  const responsibleId = tenancy.management_delegated ? tenancy.manager_id : tenancy.landlord_id;
  const responsibleRole = tenancy.management_delegated ? "Manager" : "Landlord";

  return (
    <div className="min-h-screen zone-tenant bg-[var(--zone-bg)] pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-5">
        <Link href="/tenant" className="text-xs text-white/70">← Back to My Rentals</Link>
        <div className="flex justify-between items-start mt-1">
          <div>
            <RoleBadge label="My Rented Space" />
            <h1 className="font-serif text-xl font-bold mt-1">{tenancy.properties?.title}</h1>
            <p className="text-xs text-white/70">{tenancy.properties?.location_area}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-md mx-auto space-y-3">
        {/* Real countdown — moved here per direct client instruction,
            this is its genuine home, not the general dashboard. */}
        <div className={`rounded-xl px-3 py-2.5 ${paymentUrgent ? "bg-chs-red/10 border-2 border-chs-red animate-pulse" : "bg-white border border-gray-200"}`}>
          <p className={`text-sm font-bold ${paymentUrgent ? "text-chs-red" : "text-chs-charcoal"}`}>
            {paymentUrgent && "⚠️ "}{daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left to your next rent` : "Your rent is due"}
          </p>
          <p className="text-xs text-gray-500">{formatNaira(tenancy.annual_rent)}/year · Lease runs to {new Date(tenancy.lease_end).toLocaleDateString()}</p>
          {payMessage && <p className="text-xs text-gray-600 mt-1">{payMessage}</p>}
          {paymentUrgent && (
            <div className="mt-2 space-y-1.5">
              <button onClick={() => handlePayRent("main")} disabled={payingRent}
                className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                {payingRent ? "Processing…" : `Pay from Main Wallet — ${formatNaira(tenancy.annual_rent)}`}
              </button>
              <button onClick={() => handlePayRent("rent_savings")} disabled={payingRent}
                className="w-full py-2 rounded-full bg-white border-2 border-chs-red text-chs-red text-xs font-semibold disabled:opacity-50">
                Pay from Rent Savings — {formatNaira(tenancy.annual_rent)}
              </button>
            </div>
          )}
        </div>

        {/* Real, both wallets — moved here per direct client
            instruction, since this is genuinely where a tenant thinks
            about their rent money, not the general dashboard. */}
        <div>
          <p className="text-xs font-bold text-chs-charcoal mb-1.5">💰 Your Wallets</p>
          <WalletQuickView userId={session.user.id} extra="rent_savings" />
        </div>

        {/* Real "who to contact" card + direct chat, per direct
            client instruction — whoever is actually responsible for
            this tenancy, correctly resolved (manager if delegated,
            landlord otherwise), not a guess. */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs font-bold text-chs-charcoal mb-1">📞 Your {responsibleRole}</p>
          <p className="text-sm text-chs-charcoal">{responsibleName || "Not yet assigned"}</p>
          {responsiblePhone && <p className="text-xs text-gray-500">{responsiblePhone}</p>}
          {responsibleId && (
            <button onClick={() => setShowChat(true)} className="mt-2 w-full py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold">
              💬 Message your {responsibleRole.toLowerCase()}
            </button>
          )}
        </div>
        {showChat && responsibleId && session && (
          <MessageThread tenancyId={tenancy.id} session={session} recipientId={responsibleId} recipientLabel={responsibleName || responsibleRole} onClose={() => setShowChat(false)} />
        )}

        {/* Real fault log — every real fault ever reported on this
            tenancy, with its real, current status, not a one-off
            message that vanishes into a chat. */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-bold text-chs-charcoal">🔧 Fault Log{faults.length > 0 && ` (${faults.length})`}<InfoTip text="Every real fault you've reported on this tenancy, with its current status — from reported through to resolved." /></p>
            <button onClick={() => setShowFaultForm(!showFaultForm)} className="text-[10px] font-semibold text-chs-red">
              {showFaultForm ? "Cancel" : "+ Report a fault"}
            </button>
          </div>
          {showFaultForm && (
            <div className="space-y-2 mb-3 bg-[var(--zone-card)] rounded-lg p-2.5">
              <select value={faultCategory} onChange={(e) => setFaultCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white">
                <option value="plumbing">Plumbing</option><option value="electrical">Electrical</option>
                <option value="structural">Structural</option><option value="appliance">Appliance</option>
                <option value="pest">Pest</option><option value="other">Other</option>
              </select>
              <select value={faultUrgency} onChange={(e) => setFaultUrgency(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white">
                <option value="low">Low urgency</option><option value="medium">Medium urgency</option>
                <option value="high">High urgency</option>
              </select>
              <input type="text" value={faultLocation} onChange={(e) => setFaultLocation(e.target.value)}
                placeholder="Where? (e.g. Main bathroom)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs" />
              <textarea value={faultDescription} onChange={(e) => setFaultDescription(e.target.value)} rows={2}
                placeholder="Describe the real fault" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs" />
              {faultError && <p className="text-[10px] text-chs-red">{faultError}</p>}
              <button onClick={handleReportFault} disabled={faultSubmitting}
                className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                {faultSubmitting ? "Sending…" : "Submit fault report"}
              </button>
            </div>
          )}
          {faults.length === 0 ? (
            <p className="text-[11px] text-gray-400">No real faults reported yet.</p>
          ) : (
            faults.map((f) => (
              <div key={f.id} className="border-t border-gray-100 pt-2 mt-2 first:border-0 first:pt-0 first:mt-0">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-semibold text-chs-charcoal capitalize">{f.category} — {f.location_in_property}</p>
                  <span className="text-[9px] text-gray-400 font-mono">{f.ticket_number}</span>
                </div>
                <p className="text-[11px] text-gray-500">{f.description}</p>
                <p className={`text-[10px] font-semibold mt-0.5 ${f.status === "resolved" ? "text-green-700" : "text-chs-amber-dark"}`}>
                  {FAULT_STATUS_LABEL[f.status] || f.status}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Real document shelf — every real document tied to this
            tenancy, one place, per direct client instruction. */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs font-bold text-chs-charcoal mb-2">📁 Your Documents</p>
          {reports.length === 0 ? (
            <p className="text-[11px] text-gray-400 mb-2">No condition report filed yet.</p>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="flex justify-between items-center text-[11px] mb-1">
                <span className="capitalize text-gray-600">{r.report_type.replace(/_/g, " ")} report · {r.status}</span>
                <span className="text-gray-400 font-mono">{r.reference}</span>
              </div>
            ))
          )}
          <Link href={`/condition-report/${tenancy.id}?type=move_in`} className="block text-center mt-2 py-1.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold">
            File a move-in condition report
          </Link>
          <Link href="/my-receipts" className="block text-center mt-1.5 text-[10px] font-semibold text-chs-red underline">
            View all real receipts →
          </Link>
        </div>
      </div>
    </div>
  );
}
