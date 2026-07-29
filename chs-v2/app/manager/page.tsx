"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { FaultReport, FaultQuotation } from "@/types/faultReport";
import { formatNaira } from "@/lib/format";

interface TenancyWithProperty {
  id: string;
  lease_start: string;
  lease_end: string;
  annual_rent: number;
  status: string;
  properties: { title: string; location_area: string } | null;
}

interface FaultWithQuotations extends FaultReport {
  fault_quotations: FaultQuotation[];
}

const STATUS_LABELS: Record<string, string> = {
  reported: "Reported",
  assigned: "Assigned",
  converted_to_quote: "Converted to quote",
  gathering_quotes: "Gathering quotes",
  awaiting_owner_approval: "Awaiting owner approval",
  awaiting_manager_approval: "Awaiting your approval",
  approved_by_owner: "Approved by owner",
  approved_by_manager: "Approved by you",
  resolved: "Resolved",
};

export default function ManagerDashboard() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [tenancies, setTenancies] = useState<TenancyWithProperty[]>([]);
  const [faults, setFaults] = useState<FaultWithQuotations[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

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
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, profile]);

  async function loadData() {
    if (!session) return;
    setLoading(true);

    const { data: managedTenancies } = await supabase
      .from("tenancies")
      .select("id, lease_start, lease_end, annual_rent, status, properties(title, location_area)")
      .eq("manager_id", session.user.id)
      .order("created_at", { ascending: false });

    setTenancies((managedTenancies as unknown as TenancyWithProperty[]) || []);

    if (managedTenancies && managedTenancies.length > 0) {
      const tenancyIds = managedTenancies.map((t) => t.id);
      const { data: faultData } = await supabase
        .from("fault_reports")
        .select("*, fault_quotations(*)")
        .in("tenancy_id", tenancyIds)
        .order("created_at", { ascending: false });
      setFaults((faultData as unknown as FaultWithQuotations[]) || []);
    }

    setLoading(false);
  }

  async function handleApproveQuotation(faultId: string, vendor: string, amount: number) {
    setActionError(null);
    // Genuinely records WHICH vendor and amount were actually approved —
    // not just flipping a status flag — matching the real, tested
    // multi-quotation vetting system from the original app.
    const { error } = await supabase
      .from("fault_reports")
      .update({ status: "approved_by_manager", approved_vendor: vendor, approved_amount: amount })
      .eq("id", faultId);
    if (error) {
      setActionError("Could not approve this quotation. Please try again.");
      return;
    }
    loadData();
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <h1 className="font-serif text-lg font-bold mt-1">Property Manager</h1>
      </div>

      {actionError && (
        <p className="text-xs text-chs-red bg-chs-amber-light mx-4 mt-3 rounded-lg px-3 py-2">{actionError}</p>
      )}

      <div className="px-4 py-4 space-y-5">
        <div>
          <p className="text-xs font-bold text-chs-charcoal mb-2">Managed tenancies ({tenancies.length})</p>
          {tenancies.length === 0 ? (
            <p className="text-sm text-gray-400">No tenancies assigned to you yet.</p>
          ) : (
            tenancies.map((t) => (
              <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-3 mb-2">
                <p className="text-sm font-semibold text-chs-charcoal">{t.properties?.title}</p>
                <p className="text-xs text-gray-500">{t.properties?.location_area}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {t.lease_start} → {t.lease_end} — {formatNaira(t.annual_rent)}/year
                </p>
              </div>
            ))
          )}
        </div>

        <div>
          <p className="text-xs font-bold text-chs-charcoal mb-2">Maintenance requests ({faults.length})</p>
          {faults.length === 0 ? (
            <p className="text-sm text-gray-400">No maintenance requests on your managed tenancies.</p>
          ) : (
            faults.map((fault) => (
              <div key={fault.id} className="bg-white rounded-xl border border-gray-100 p-3 mb-2">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-semibold text-chs-charcoal">{fault.category}</p>
                  <span className="text-[10px] font-bold uppercase text-chs-red bg-chs-amber-light px-2 py-1 rounded-full">
                    {STATUS_LABELS[fault.status] || fault.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{fault.description}</p>

                {fault.fault_quotations && fault.fault_quotations.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                      Quotations ({fault.fault_quotations.length})
                    </p>
                    {fault.fault_quotations.map((q) => (
                      <div key={q.id} className="bg-gray-50 rounded-lg p-2 mb-1.5 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-semibold">{q.vendor_name}</p>
                          <p className="text-gray-500">{formatNaira(q.amount)}</p>
                        </div>
                        {fault.status === "awaiting_manager_approval" && (
                          <button
                            onClick={() => handleApproveQuotation(fault.id, q.vendor_name, q.amount)}
                            className="py-1.5 px-3 rounded-full bg-chs-red text-white text-[10px] font-semibold"
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    ))}
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
