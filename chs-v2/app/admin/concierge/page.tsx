"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface ConciergeRequest {
  id: string;
  user_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  raw_message: string;
  input_method: string;
  status: string;
  saved_search_id: string | null;
  created_at: string;
}

// Real admin queue for concierge requests — every "Talk to an Agent"
// submission lands here. Triaging one fills in structured criteria and
// (for a registered user) creates a real saved_search in the same
// step, wiring straight into the existing Vacancy Alert matching
// instead of being a second, disconnected system.
export default function AdminConciergePage() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<ConciergeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "in_progress" | "matched" | "closed" | "all">("pending");
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session || profile?.role !== "admin") {
      router.push("/");
      return;
    }
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, profile]);

  async function loadRequests() {
    setLoading(true);
    const { data } = await supabase
      .from("concierge_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setRequests(data || []);
    setLoading(false);
  }

  function openTriage(r: ConciergeRequest) {
    setOpenId(r.id);
    setForm({
      purpose: "rent",
      state: "",
      lga: "",
      area: "",
      min_price: "",
      max_price: "",
      property_type: "",
      min_bedrooms: "",
    });
    setActionError(null);
  }

  async function handleTriage(requestId: string) {
    setSaving(true);
    setActionError(null);

    const { error } = await supabase.rpc("link_concierge_request_to_search", {
      p_request_id: requestId,
      p_purpose: form.purpose || null,
      p_state: form.state || null,
      p_lga: form.lga || null,
      p_area: form.area || null,
      p_min_price: form.min_price ? Number(form.min_price) : null,
      p_max_price: form.max_price ? Number(form.max_price) : null,
      p_property_type: form.property_type || null,
      p_min_bedrooms: form.min_bedrooms || null,
    });

    setSaving(false);
    if (error) {
      setActionError("Could not save — please try again.");
      return;
    }
    setOpenId(null);
    loadRequests();
  }

  async function markStatus(requestId: string, status: string) {
    await supabase.from("concierge_requests").update({ status }).eq("id", requestId);
    loadRequests();
  }

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/admin" className="text-xs text-gray-400">← Back to Admin</Link>
        <h1 className="text-xl font-bold text-chs-charcoal mt-2 mb-1">Concierge Requests</h1>
        <p className="text-sm text-gray-500 mb-5">Every &quot;Talk to an Agent&quot; submission, real and unfiltered.</p>

        <div className="flex gap-2 mb-4 flex-wrap">
          {(["pending", "in_progress", "matched", "closed", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                filter === f ? "bg-chs-red text-white border-chs-red" : "border-gray-300 text-gray-600"
              }`}
            >
              {f.replace("_", " ")} {f !== "all" ? `(${requests.filter((r) => r.status === f).length})` : `(${requests.length})`}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">No requests in this view.</p>
        )}

        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-chs-charcoal">
                    {r.contact_name || "Registered user"} {r.input_method === "voice" && <span className="text-xs font-normal text-gray-400">(via voice)</span>}
                  </p>
                  <p className="text-xs text-gray-400">
                    {r.contact_phone || (r.user_id ? "Logged-in account" : "No contact given")}
                    {" · "}{new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${
                  r.status === "pending" ? "bg-amber-50 text-amber-700" :
                  r.status === "in_progress" ? "bg-blue-50 text-blue-700" :
                  r.status === "matched" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {r.status.replace("_", " ")}
                </span>
              </div>

              <p className="text-sm text-gray-700 mt-2">{r.raw_message}</p>

              {r.saved_search_id && (
                <p className="text-xs text-green-600 mt-1">✓ Linked to a saved search — will auto-match new listings</p>
              )}

              {openId === r.id ? (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                      className="px-2.5 py-2 rounded-lg border border-gray-200 text-xs">
                      <option value="rent">Rent</option>
                      <option value="sale">Sale</option>
                      <option value="lease">Lease</option>
                      <option value="hire">Hire</option>
                    </select>
                    <input value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })}
                      placeholder="Property type" className="px-2.5 py-2 rounded-lg border border-gray-200 text-xs" />
                    <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}
                      placeholder="State" className="px-2.5 py-2 rounded-lg border border-gray-200 text-xs" />
                    <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}
                      placeholder="Area" className="px-2.5 py-2 rounded-lg border border-gray-200 text-xs" />
                    <input value={form.min_bedrooms} onChange={(e) => setForm({ ...form, min_bedrooms: e.target.value })}
                      placeholder="Min bedrooms" className="px-2.5 py-2 rounded-lg border border-gray-200 text-xs" />
                    <input value={form.max_price} onChange={(e) => setForm({ ...form, max_price: e.target.value })}
                      placeholder="Budget (₦)" className="px-2.5 py-2 rounded-lg border border-gray-200 text-xs" />
                  </div>
                  {actionError && <p className="text-xs text-red-600">{actionError}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => handleTriage(r.id)} disabled={saving}
                      className="text-xs font-semibold bg-chs-red text-white px-3 py-2 rounded-lg disabled:opacity-50">
                      {saving ? "Saving..." : "Save & Mark In Progress"}
                    </button>
                    <button onClick={() => setOpenId(null)} className="text-xs font-semibold text-gray-500 px-3 py-2">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => openTriage(r)} className="text-xs font-semibold text-chs-red">
                    Triage
                  </button>
                  {r.status !== "matched" && (
                    <button onClick={() => markStatus(r.id, "matched")} className="text-xs font-semibold text-green-600">
                      Mark Matched
                    </button>
                  )}
                  {r.status !== "closed" && (
                    <button onClick={() => markStatus(r.id, "closed")} className="text-xs font-semibold text-gray-400">
                      Close
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
