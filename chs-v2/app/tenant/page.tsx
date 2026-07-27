"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import RaiseDisputeForm from "@/components/RaiseDisputeForm";

interface ApplicationWithProperty {
  id: string;
  status: string;
  move_in_date: string;
  created_at: string;
  properties: { title: string; location_area: string } | null;
}

interface TenancyWithProperty {
  id: string;
  landlord_id: string;
  lease_start: string;
  lease_end: string;
  annual_rent: number;
  status: string;
  properties: { title: string; location_area: string } | null;
}

interface InspectionWithProperty {
  id: string;
  requested_date: string;
  requested_time: string;
  status: string;
  properties: { title: string; location_area: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Under review by CHS",
  awaiting_owner_decision: "Awaiting the owner's decision",
  approved: "Approved",
  owner_declined: "Declined by the owner",
};

export default function TenantDashboard() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState<ApplicationWithProperty[]>([]);
  const [tenancies, setTenancies] = useState<TenancyWithProperty[]>([]);
  const [inspections, setInspections] = useState<InspectionWithProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [disputingTenancy, setDisputingTenancy] = useState<TenancyWithProperty | null>(null);
  const [disputeSubmitted, setDisputeSubmitted] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    const allRoles = profile ? [profile.role, ...(profile.secondary_roles || [])] : [];
    if (profile && !allRoles.includes("tenant")) {
      router.push("/");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, profile]);

  async function loadData() {
    if (!session) return;
    setLoading(true);

    const [applicationsRes, tenanciesRes, inspectionsRes] = await Promise.all([
      supabase
        .from("rental_applications")
        .select("id, status, move_in_date, created_at, properties(title, location_area)")
        .eq("tenant_id", session.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("tenancies")
        .select("id, landlord_id, lease_start, lease_end, annual_rent, status, properties(title, location_area)")
        .eq("tenant_id", session.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("inspections")
        .select("id, requested_date, requested_time, status, properties(title, location_area)")
        .eq("requester_id", session.user.id)
        .order("created_at", { ascending: false }),
    ]);

    setApplications((applicationsRes.data as unknown as ApplicationWithProperty[]) || []);
    setTenancies((tenanciesRes.data as unknown as TenancyWithProperty[]) || []);
    setInspections((inspectionsRes.data as unknown as InspectionWithProperty[]) || []);
    setLoading(false);
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <h1 className="font-serif text-lg font-bold mt-1">My Rentals</h1>
      </div>

      <div className="px-4 py-4 space-y-5">
        {tenancies.length > 0 && (
          <div>
            <p className="text-xs font-bold text-chs-charcoal mb-2">Active tenancy</p>
            {tenancies.map((t) => (
              <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-3 mb-2">
                <p className="text-sm font-semibold text-chs-charcoal">{t.properties?.title}</p>
                <p className="text-xs text-gray-500">{t.properties?.location_area}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {t.lease_start} → {t.lease_end}
                </p>
                <p className="text-sm font-bold text-chs-charcoal mt-1">{formatNaira(t.annual_rent)}/year</p>
                <span className="inline-block mt-1 text-[10px] font-bold uppercase text-chs-red bg-chs-amber-light px-2 py-1 rounded-full capitalize">
                  {t.status.replace(/_/g, " ")}
                </span>
                <button
                  onClick={() => { setDisputingTenancy(t); setDisputeSubmitted(false); }}
                  className="block mt-2 text-[10px] font-semibold text-chs-red underline"
                >
                  Raise a dispute about this tenancy
                </button>
              </div>
            ))}
          </div>
        )}

        {disputingTenancy && session && (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            {disputeSubmitted ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-chs-charcoal mb-1">✓ Dispute submitted</p>
                <p className="text-xs text-gray-500 mb-3">CHS will review this and reach out to both parties.</p>
                <button onClick={() => setDisputingTenancy(null)} className="text-xs font-semibold text-chs-red">
                  Close
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold text-chs-charcoal mb-3">
                  Raise a dispute — {disputingTenancy.properties?.title}
                </p>
                <RaiseDisputeForm
                  session={session}
                  tenancyId={disputingTenancy.id}
                  againstUserId={disputingTenancy.landlord_id}
                  onSuccess={() => setDisputeSubmitted(true)}
                  onCancel={() => setDisputingTenancy(null)}
                />
              </>
            )}
          </div>
        )}

        <div>
          <p className="text-xs font-bold text-chs-charcoal mb-2">My applications</p>
          {applications.length === 0 ? (
            <p className="text-sm text-gray-400">No rental applications yet.</p>
          ) : (
            applications.map((app) => (
              <div key={app.id} className="bg-white rounded-xl border border-gray-100 p-3 mb-2">
                <p className="text-sm font-semibold text-chs-charcoal">{app.properties?.title}</p>
                <p className="text-xs text-gray-500">{app.properties?.location_area}</p>
                <p className="text-xs text-gray-500 mt-1">Move-in: {app.move_in_date}</p>
                <span
                  className={`inline-block mt-1 text-[10px] font-bold px-2 py-1 rounded-full ${
                    app.status === "approved"
                      ? "text-white bg-chs-red"
                      : app.status === "owner_declined"
                      ? "text-gray-500 bg-gray-100"
                      : "text-chs-amber-dark bg-chs-amber-light"
                  }`}
                >
                  {STATUS_LABELS[app.status] || app.status}
                </span>
              </div>
            ))
          )}
        </div>

        <div>
          <p className="text-xs font-bold text-chs-charcoal mb-2">My inspection requests</p>
          {inspections.length === 0 ? (
            <p className="text-sm text-gray-400">No inspection requests yet.</p>
          ) : (
            inspections.map((insp) => (
              <div key={insp.id} className="bg-white rounded-xl border border-gray-100 p-3 mb-2">
                <p className="text-sm font-semibold text-chs-charcoal">{insp.properties?.title}</p>
                <p className="text-xs text-gray-500">
                  {insp.requested_date} at {insp.requested_time}
                </p>
                <span className="inline-block mt-1 text-[10px] font-bold uppercase text-gray-500 bg-gray-100 px-2 py-1 rounded-full capitalize">
                  {insp.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
