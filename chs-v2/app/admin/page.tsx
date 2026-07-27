"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { RentalApplication } from "@/types/rentalApplication";

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

type Tab = "registrations" | "applications" | "properties";

export default function AdminDashboard() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("registrations");
  const [pendingProfiles, setPendingProfiles] = useState<PendingProfile[]>([]);
  const [pendingApplications, setPendingApplications] = useState<RentalApplication[]>([]);
  const [pendingProperties, setPendingProperties] = useState<PendingProperty[]>([]);
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
    if (profile?.role === "admin") loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, profile]);

  async function loadData() {
    setLoading(true);
    const [profilesRes, applicationsRes, propertiesRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, role, state, created_at").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("rental_applications").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("properties").select("id, title, location_area, purpose, price").eq("verification_status", "pending").order("created_at", { ascending: false }),
    ]);
    setPendingProfiles(profilesRes.data || []);
    setPendingApplications(applicationsRes.data || []);
    setPendingProperties(propertiesRes.data || []);
    setLoading(false);
  }

  async function handleProfileDecision(profileId: string, status: "approved" | "rejected") {
    setActionError(null);
    const { error } = await supabase.from("profiles").update({ status }).eq("id", profileId);
    if (error) {
      setActionError("Could not update this registration. Please try again.");
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
    const { error } = await supabase.from("properties").update({ verification_status: status }).eq("id", propertyId);
    if (error) {
      setActionError("Could not update this property. Please try again.");
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
        <h1 className="font-serif text-lg font-bold mt-1">Admin</h1>
      </div>

      <div className="flex border-b border-gray-200 bg-white px-4">
        {([
          { key: "registrations", label: `Registrations (${pendingProfiles.length})` },
          { key: "applications", label: `Applications (${pendingApplications.length})` },
          { key: "properties", label: `Properties (${pendingProperties.length})` },
        ] as { key: Tab; label: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`text-xs font-semibold px-3 py-3 border-b-2 ${
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
        {activeTab === "registrations" &&
          (pendingProfiles.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No pending registrations.</p>
          ) : (
            pendingProfiles.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-3">
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
              <div key={app.id} className="bg-white rounded-xl border border-gray-100 p-3">
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
              <div key={prop.id} className="bg-white rounded-xl border border-gray-100 p-3">
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
      </div>
    </div>
  );
}
