"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { NIGERIAN_STATES } from "@/lib/geoData";
import { formatNaira } from "@/lib/format";

interface Estate {
  id: string;
  name: string;
  address: string;
  state: string;
  total_units_declared: number | null;
  subscription_status: string;
}

// The real entity your tester described: "we buy a slot... all our
// tenants and everybody in our property can be bundled under it." One
// estate, one manager, many real units — everything else (service
// charges, the dashboard, tenant onboarding) attaches to this.
export default function EstatesPage() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [estates, setEstates] = useState<Estate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [state, setState] = useState(NIGERIAN_STATES[0]);
  const [totalUnits, setTotalUnits] = useState<number | "">("");
  const [showManagerReport, setShowManagerReport] = useState(false);
  const [managerReportPeriod, setManagerReportPeriod] = useState<"week" | "month" | "quarter">("month");
  const [managerReport, setManagerReport] = useState<{
    new_tenancies_count: number; service_charges_billed: number; service_charges_collected: number; maintenance_resolved: number;
  } | null>(null);
  const [loadingManagerReport, setLoadingManagerReport] = useState(false);

  // Real, new feature per direct client request: a genuine, date-
  // range activity report a manager can generate across their whole
  // real portfolio of estates, for their own records or to prepare
  // something to submit — not just a live, un-datable snapshot.
  async function loadManagerReport(period: typeof managerReportPeriod) {
    if (!session) return;
    setLoadingManagerReport(true);
    const end = new Date();
    const start = new Date();
    if (period === "week") start.setDate(start.getDate() - 7);
    else if (period === "month") start.setMonth(start.getMonth() - 1);
    else start.setMonth(start.getMonth() - 3);
    const { data } = await supabase.rpc("get_manager_activity_report", {
      p_manager_id: session.user.id, p_start_date: start.toISOString(), p_end_date: end.toISOString(),
    });
    setManagerReport(data);
    setLoadingManagerReport(false);
  }
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState("up_to_50");
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeMessage, setSubscribeMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    const allRoles = profile ? [profile.role, ...(profile.secondary_roles || [])] : [];
    if (profile && !allRoles.includes("manager")) {
      router.push("/");
      return;
    }
    loadEstates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, profile]);

  async function loadEstates() {
    if (!session) return;
    const { data } = await supabase
      .from("estates")
      .select("id, name, address, state, total_units_declared, subscription_status")
      .eq("manager_id", session.user.id)
      .order("created_at", { ascending: false });
    setEstates(data || []);
    setLoading(false);
  }

  async function handleSubscribe(estateId: string) {
    setSubscribing(true);
    setSubscribeMessage(null);
    const { error: rpcError } = await supabase.rpc("activate_estate_subscription", { p_estate_id: estateId, p_tier: selectedTier });
    setSubscribing(false);
    if (rpcError) {
      setSubscribeMessage(rpcError.message);
      return;
    }
    setActivatingId(null);
    loadEstates();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !name.trim() || !address.trim()) {
      setError("Please fill in the estate name and address.");
      return;
    }
    setCreating(true);
    setError(null);
    const { error: insertError } = await supabase.from("estates").insert({
      name: name.trim(),
      address: address.trim(),
      state,
      manager_id: session.user.id,
      total_units_declared: totalUnits || null,
    });
    setCreating(false);
    if (insertError) {
      setError("Could not create this estate. Please try again.");
      return;
    }
    setShowCreate(false);
    setName("");
    setAddress("");
    setTotalUnits("");
    loadEstates();
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] px-4 py-8">
      <div className="max-w-md mx-auto">
        <Link href="/manager" className="text-xs text-gray-400 mb-4 inline-block">← Back to My Dashboard</Link>
        <div className="flex justify-between items-center mb-4">
          <h1 className="font-serif text-2xl font-bold text-chs-charcoal">🏘️ My Estates</h1>
          {!showCreate && (
            <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 rounded-full bg-chs-red text-white text-xs font-semibold">
              + New Estate
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <button onClick={() => { setShowManagerReport(!showManagerReport); if (!managerReport) loadManagerReport("month"); }}
            className="text-sm font-bold text-chs-charcoal">
            📊 {showManagerReport ? "Hide" : "Generate"} my activity report — across all my estates
          </button>
          {showManagerReport && (
            <div className="mt-3">
              <div className="flex gap-2 mb-2">
                {(["week", "month", "quarter"] as const).map((p) => (
                  <button key={p} onClick={() => { setManagerReportPeriod(p); loadManagerReport(p); }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                      managerReportPeriod === p ? "bg-chs-red text-white" : "bg-gray-100 text-gray-600"
                    }`}>
                    {p === "week" ? "This Week" : p === "month" ? "This Month" : "This Quarter"}
                  </button>
                ))}
              </div>
              {loadingManagerReport ? (
                <p className="text-[11px] text-gray-400 text-center py-4">Loading real report...</p>
              ) : managerReport ? (
                <div className="space-y-1.5 text-xs bg-[var(--zone-card)] rounded-lg p-3">
                  <div className="flex justify-between"><span className="text-gray-500">New tenancies this period</span><span className="font-semibold">{managerReport.new_tenancies_count}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Service charges billed</span><span className="font-semibold">{formatNaira(managerReport.service_charges_billed)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Service charges collected</span><span className="font-bold text-green-700">{formatNaira(managerReport.service_charges_collected)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Maintenance resolved</span><span className="font-semibold">{managerReport.maintenance_resolved}</span></div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2 mb-4">
            <p className="text-sm font-bold text-chs-charcoal mb-1">Real estate details</p>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">Estate name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Malali Gardens Estate" className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">Address</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="Full estate address" className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">State</label>
              <select value={state} onChange={(e) => setState(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">Total real units (approximate — for planning only)</label>
              <input type="number" value={totalUnits} onChange={(e) => setTotalUnits(e.target.value ? Number(e.target.value) : "")}
                placeholder="e.g. 500" className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </div>
            {error && <p className="text-xs text-chs-red bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold">
                Cancel
              </button>
              <button type="submit" disabled={creating} className="flex-1 py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                {creating ? "Creating..." : "Create estate"}
              </button>
            </div>
          </form>
        )}

        {estates.length === 0 && !showCreate ? (
          <p className="text-sm text-gray-400 text-center py-10">No estates yet — create your first one above.</p>
        ) : (
          <div className="space-y-2">
            {estates.map((e) => (
              <div key={e.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <Link href={`/manager/estates/${e.id}`}>
                  <p className="text-sm font-bold text-chs-charcoal">{e.name}</p>
                  <p className="text-xs text-gray-500">{e.address}, {e.state}</p>
                </Link>
                <div className="flex justify-between items-center mt-1.5">
                  <span className="text-[10px] text-gray-400">{e.total_units_declared || "?"} units planned</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                    e.subscription_status === "active" ? "text-green-700 bg-green-50" : "text-chs-amber-dark bg-chs-amber-light"
                  }`}>
                    {e.subscription_status}
                  </span>
                </div>
                {e.subscription_status !== "active" && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    {activatingId === e.id ? (
                      <div className="space-y-1.5">
                        <select value={selectedTier} onChange={(ev) => setSelectedTier(ev.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] bg-white">
                          <option value="up_to_50">Up to 50 units — {formatNaira(75000)}/month</option>
                          <option value="51_to_200">51–200 units — {formatNaira(180000)}/month</option>
                          <option value="201_to_500">201–500 units — {formatNaira(350000)}/month</option>
                        </select>
                        {subscribeMessage && <p className="text-[10px] text-gray-600">{subscribeMessage}</p>}
                        <div className="flex gap-1.5">
                          <button onClick={() => setActivatingId(null)} className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                            Cancel
                          </button>
                          <button onClick={() => handleSubscribe(e.id)} disabled={subscribing}
                            className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
                            {subscribing ? "Activating..." : "Pay from wallet"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setActivatingId(e.id)} className="w-full py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                        💳 Subscribe to unlock this estate
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
