"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import RoleBadge from "@/components/RoleBadge";

// Real, new page per direct client request — a genuine, separate
// login for an agent/manager's real staff (office staff, field
// agents, attendants), to see the properties they're really assigned
// to support and submit a real daily activity report.
interface TeamMembership {
  id: string;
  role_label: string;
  parent: { full_name: string } | null;
}
interface AssignedProperty {
  id: string;
  title: string;
  street_address: string | null;
  location_area: string;
  status: string;
}

export default function StaffPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [properties, setProperties] = useState<AssignedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState("");
  const [transactions, setTransactions] = useState("");
  const [complaints, setComplaints] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function loadData() {
    if (!session) return;
    const { data: teamData } = await supabase
      .from("team_members")
      .select("id, role_label, parent:parent_id(full_name)")
      .eq("member_id", session.user.id)
      .eq("status", "active");
    setMemberships((teamData as unknown as TeamMembership[]) || []);

    if (teamData && teamData.length > 0) {
      const parentIds = teamData.map((t) => (t as unknown as { parent_id: string }).parent_id);
      const { data: propsData } = await supabase
        .from("properties")
        .select("id, title, street_address, location_area, status")
        .in("managing_agent_id", parentIds);
      setProperties(propsData || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  async function handleSubmitReport() {
    if (!activities.trim()) {
      setResult("Please describe your real activities for the day.");
      return;
    }
    setSubmitting(true);
    setResult(null);
    const { error } = await supabase.rpc("submit_team_daily_report", {
      p_activities: activities.trim(),
      p_transactions: transactions.trim() || null,
      p_complaints: complaints.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      setResult(error.message);
      return;
    }
    setResult("✓ Real daily report submitted.");
    setActivities("");
    setTransactions("");
    setComplaints("");
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  if (memberships.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-lg font-semibold text-chs-charcoal mb-2">You&apos;re not currently on a real team</p>
        <p className="text-sm text-gray-500 mb-4">Ask the agent or manager you work with to add you by your real CHS phone number.</p>
        <Link href="/" className="text-sm font-semibold text-chs-red">Back to homepage</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] pb-10" style={{ ["--zone-bg" as string]: "#f7f2e3", ["--zone-card" as string]: "#fdfaf0" }}>
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <button onClick={() => router.back()} className="text-xs text-white/70">← Back</button>
        <RoleBadge label="Team Staff Dashboard" />
        <h1 className="font-serif text-lg font-bold mt-1">My Work</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-chs-charcoal mb-2">Your real team role(s)</p>
          {memberships.map((m) => (
            <p key={m.id} className="text-xs text-gray-600">
              <span className="font-semibold">{m.role_label}</span> under {m.parent?.full_name}
            </p>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-chs-charcoal mb-2">📝 Submit today&apos;s real daily report</p>
          <textarea rows={3} placeholder="What did you genuinely do today? (e.g. property visits, inspections, tenant follow-ups)"
            value={activities} onChange={(e) => setActivities(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs mb-2" />
          <textarea rows={2} placeholder="Any real transactions handled? (optional)"
            value={transactions} onChange={(e) => setTransactions(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs mb-2" />
          <textarea rows={2} placeholder="Any real complaints or faults raised? (optional)"
            value={complaints} onChange={(e) => setComplaints(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs mb-2" />
          {result && <p className="text-xs text-gray-600 mb-2">{result}</p>}
          <button onClick={handleSubmitReport} disabled={submitting}
            className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
            {submitting ? "Submitting..." : "Submit real report"}
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-chs-charcoal mb-2">🏘️ Properties you support ({properties.length})</p>
          {properties.length === 0 ? (
            <p className="text-xs text-gray-400">None assigned yet.</p>
          ) : (
            properties.map((p) => (
              <div key={p.id} className="bg-[var(--zone-card)] rounded-lg p-2.5 mb-1.5">
                <p className="text-xs font-semibold text-chs-charcoal">{p.title}</p>
                <p className="text-[10px] text-gray-500">{p.street_address ? `${p.street_address} — ` : ""}{p.location_area}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
