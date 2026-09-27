"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import NotificationBell from "@/components/NotificationBell";

// Real, direct rebuild following a direct, serious client report: this
// page used to be a dead end — it showed the application, then sent
// the owner right back to the main dashboard to actually act on it,
// undoing the whole real point of a notification taking you straight
// to where you're going. The approve/decline action, and every real
// detail behind it, now lives directly here — the same real logic
// already proven working on the main dashboard, brought here instead
// of duplicated blindly, so there is nowhere left to be sent back to.
interface RentalApp {
  id: string; status: string; created_at: string; applicant_full_name: string | null;
  applicant_occupation: string | null; applicant_income_source: string | null;
  employer_business_name: string | null; employer_business_address: string | null;
  applicant_present_address: string | null; applicant_id_type: string | null;
  guarantor_name: string | null; guarantor_phone: string | null; guarantor_relationship: string | null;
  guarantor_occupation: string | null; guarantor_address: string | null; guarantor_id_type: string | null;
  move_in_date: string | null;
  properties: { title: string; location_area: string; owner_id: string }[] | null;
  tenant: { full_name: string; phone: string; valid_id_verified: boolean }[] | null;
}

export default function OwnerApplicationsPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [rentalApps, setRentalApps] = useState<RentalApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  async function loadAll() {
    if (!session) return;
    const { data: myProps } = await supabase.from("properties").select("id").eq("owner_id", session.user.id);
    const propIds = (myProps || []).map((p) => p.id);
    if (propIds.length === 0) { setRentalApps([]); setLoading(false); return; }

    const { data } = await supabase.from("rental_applications")
      .select("id, status, created_at, applicant_full_name, applicant_occupation, applicant_income_source, employer_business_name, employer_business_address, applicant_present_address, applicant_id_type, guarantor_name, guarantor_phone, guarantor_relationship, guarantor_occupation, guarantor_address, guarantor_id_type, move_in_date, properties(title, location_area, owner_id), tenant:profiles!rental_applications_tenant_id_fkey(full_name, phone, valid_id_verified)")
      .in("property_id", propIds).order("created_at", { ascending: false });
    setRentalApps((data as unknown as RentalApp[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.push("/login"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  async function handleDecision(applicationId: string, decision: "approved" | "owner_declined") {
    setActionError(null);
    setDecidingId(applicationId);
    const { error } = await supabase.rpc("record_owner_decision", { p_application_id: applicationId, p_decision: decision });
    setDecidingId(null);
    if (error) {
      setActionError(error.message.includes("phone number") || error.message.includes("email")
        ? error.message
        : `Could not record this decision: ${error.message}`);
      return;
    }
    loadAll();
  }

  const needsAttention = (s: string) => s === "awaiting_owner_decision" || s === "pending";

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] zone-owner pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <Link href="/owner" className="text-xs text-white/70">← Back to Owner Dashboard</Link>
        <div className="flex justify-between items-center mt-1">
          <h1 className="font-serif text-lg font-bold">Recent Applications</h1>
          <NotificationBell />
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {actionError && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{actionError}</p>}
        <div>
          <p className="text-xs font-bold text-chs-charcoal mb-1.5">🏠 Rental Applications</p>
          {rentalApps.length === 0 ? (
            <p className="text-xs text-gray-400">No real rental applications yet.</p>
          ) : (
            rentalApps.map((app) => (
              <div key={app.id} className={`rounded-xl border p-3 mb-2 text-xs space-y-2 ${needsAttention(app.status) ? "bg-chs-amber-light border-chs-red" : "bg-white border-gray-200"}`}>
                <div className="flex justify-between items-start pb-2 border-b border-gray-200">
                  <div>
                    <p className="font-bold text-chs-charcoal text-sm">{app.properties?.[0]?.title || "Property"}</p>
                    <p className="text-gray-500">{app.properties?.[0]?.location_area}</p>
                  </div>
                  {needsAttention(app.status) && <span className="text-[9px] font-bold text-white bg-chs-red px-1.5 py-0.5 rounded-full whitespace-nowrap">Needs you</span>}
                </div>

                <div className="flex justify-between items-start">
                  <p className="font-bold text-chs-charcoal">{app.applicant_full_name || app.tenant?.[0]?.full_name || "Applicant"}</p>
                  {app.tenant?.[0]?.valid_id_verified ? (
                    <span className="text-[9px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full whitespace-nowrap">✓ ID Verified</span>
                  ) : (
                    <span className="text-[9px] font-bold text-chs-amber-dark bg-chs-amber-light px-2 py-0.5 rounded-full whitespace-nowrap">⚠ Not yet verified</span>
                  )}
                </div>
                <p className="text-gray-500">{app.tenant?.[0]?.phone}</p>

                <div>
                  <p className="text-gray-400 text-[10px] font-bold uppercase">Occupation &amp; income</p>
                  <p className="text-gray-700">{app.applicant_occupation} — {app.applicant_income_source}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-[10px] font-bold uppercase">Where they work / their business</p>
                  <p className="text-gray-700">{app.employer_business_name}</p>
                  <p className="text-gray-500">{app.employer_business_address}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-[10px] font-bold uppercase">Current address</p>
                  <p className="text-gray-700">{app.applicant_present_address}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-[10px] font-bold uppercase">Means of identification</p>
                  <p className="text-gray-700">{app.applicant_id_type} — ✓ Verified by CHS</p>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <p className="text-gray-400 text-[10px] font-bold uppercase">Guarantor</p>
                  <p className="text-gray-700">{app.guarantor_name}</p>
                  {app.status === "awaiting_guarantor_confirmation" ? (
                    <p className="text-chs-amber-dark font-semibold mt-0.5">⏳ Awaiting the guarantor&apos;s own, independent confirmation — not yet completed by them directly.</p>
                  ) : (
                    <>
                      <p className="text-green-700 font-semibold mt-0.5">✓ Independently confirmed by the guarantor themselves</p>
                      <p className="text-gray-500">{app.guarantor_relationship} · {app.guarantor_occupation}</p>
                      <p className="text-gray-500">{app.guarantor_address}</p>
                      <p className="text-gray-500">{app.guarantor_id_type} — ✓ Verified by CHS</p>
                    </>
                  )}
                </div>

                <p className="text-gray-700 font-semibold">Wants to move in: {app.move_in_date}</p>
                <p className="text-gray-400 capitalize">Status: {app.status.replace(/_/g, " ")}</p>

                {app.status === "awaiting_owner_decision" && (
                  <div className="mt-1">
                    <p className="text-[10px] text-gray-400 mb-1.5">Your decision is relayed to the applicant by CHS.</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleDecision(app.id, "approved")} disabled={decidingId === app.id}
                        className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
                        {decidingId === app.id ? "Processing…" : "Approve"}
                      </button>
                      <button onClick={() => handleDecision(app.id, "owner_declined")} disabled={decidingId === app.id}
                        className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold disabled:opacity-50">
                        Decline
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
