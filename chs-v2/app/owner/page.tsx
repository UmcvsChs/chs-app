"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Property } from "@/types/property";
import { Offer } from "@/types/offer";
import { Inspection } from "@/types/inspection";
import { RentalApplication } from "@/types/rentalApplication";
import { formatNaira, purposeLabel } from "@/lib/format";

interface PropertyWithActivity extends Property {
  offers: Offer[];
  inspections: Inspection[];
  rentalApplications: RentalApplication[];
}

export default function OwnerDashboard() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [properties, setProperties] = useState<PropertyWithActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // A real access check — not just a UI nicety, since row-level security
  // on the actual database is the true protection here, but this stops
  // someone who genuinely isn't an owner from even seeing a confusing
  // empty dashboard.
  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    const allRoles = profile ? [profile.role, ...(profile.secondary_roles || [])] : [];
    if (profile && !allRoles.includes("owner")) {
      router.push("/");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, profile]);

  async function loadData() {
    if (!session) return;
    setLoading(true);

    const { data: ownedProperties } = await supabase
      .from("properties")
      .select("*")
      .eq("owner_id", session.user.id)
      .order("created_at", { ascending: false });

    if (!ownedProperties) {
      setProperties([]);
      setLoading(false);
      return;
    }

    // Real activity for each real property — offers, inspection
    // requests, and rental applications actually made on it, not just
    // the property's own details.
    const withActivity = await Promise.all(
      ownedProperties.map(async (property) => {
        const [offersRes, inspectionsRes, applicationsRes] = await Promise.all([
          supabase.from("offers").select("*").eq("property_id", property.id).order("created_at", { ascending: false }),
          supabase.from("inspections").select("*").eq("property_id", property.id).order("created_at", { ascending: false }),
          supabase.from("rental_applications").select("*").eq("property_id", property.id).order("created_at", { ascending: false }),
        ]);
        return {
          ...property,
          offers: offersRes.data || [],
          inspections: inspectionsRes.data || [],
          rentalApplications: applicationsRes.data || [],
        } as PropertyWithActivity;
      })
    );

    setProperties(withActivity);
    setLoading(false);
  }

  async function handleOfferDecision(offerId: string, status: "accepted" | "rejected") {
    setActionError(null);
    const { error } = await supabase.from("offers").update({ status }).eq("id", offerId);
    if (error) {
      setActionError("Could not update this offer. Please try again.");
      return;
    }
    loadData();
  }

  async function handleApplicationDecision(applicationId: string, status: "approved" | "owner_declined") {
    setActionError(null);
    const { error } = await supabase.from("rental_applications").update({ status }).eq("id", applicationId);
    if (error) {
      setActionError("Could not update this application. Please try again.");
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
        <div className="flex justify-between items-center mt-1">
          <h1 className="font-serif text-lg font-bold">My Properties</h1>
          <Link href="/list-property" className="bg-chs-red text-xs font-semibold px-3 py-1.5 rounded-full">
            + List a property
          </Link>
        </div>
      </div>

      {actionError && (
        <p className="text-xs text-chs-red bg-chs-amber-light mx-4 mt-3 rounded-lg px-3 py-2">{actionError}</p>
      )}

      {properties.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-12 px-4">
          You don&apos;t have any properties listed yet.
        </p>
      ) : (
        <div className="px-4 py-4 space-y-4">
          {properties.map((property) => (
            <div key={property.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex justify-between items-start mb-2">
                <h2 className="font-semibold text-sm text-chs-charcoal">{property.title}</h2>
                <span className="text-[10px] font-bold uppercase text-chs-red bg-chs-amber-light px-2 py-1 rounded-full">
                  {purposeLabel(property.purpose)}
                </span>
              </div>

              {property.offers.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-chs-charcoal mb-1">Offers ({property.offers.length})</p>
                  {property.offers.map((offer) => (
                    <div key={offer.id} className="bg-gray-50 rounded-lg p-2.5 mb-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">{formatNaira(offer.amount)}</span>
                        <span className="text-gray-400 capitalize">{offer.status}</span>
                      </div>
                      {offer.note && <p className="text-gray-500 mt-1">{offer.note}</p>}
                      {offer.status === "pending" && (
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleOfferDecision(offer.id, "accepted")}
                            className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                            Accept
                          </button>
                          <button onClick={() => handleOfferDecision(offer.id, "rejected")}
                            className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {property.rentalApplications.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-chs-charcoal mb-1">
                    Rental applications ({property.rentalApplications.length})
                  </p>
                  {property.rentalApplications.map((app) => (
                    <div key={app.id} className="bg-gray-50 rounded-lg p-2.5 mb-2 text-xs">
                      <p>Guarantor: {app.guarantor_name} — {app.guarantor_phone}</p>
                      <p className="text-gray-500">Move-in: {app.move_in_date}</p>
                      <p className="text-gray-400 capitalize mt-1">Status: {app.status.replace(/_/g, " ")}</p>
                      {app.status === "awaiting_owner_decision" && (
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleApplicationDecision(app.id, "approved")}
                            className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                            Approve
                          </button>
                          <button onClick={() => handleApplicationDecision(app.id, "owner_declined")}
                            className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {property.inspections.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-chs-charcoal mb-1">
                    Inspection requests ({property.inspections.length})
                  </p>
                  {property.inspections.map((insp) => (
                    <div key={insp.id} className="bg-gray-50 rounded-lg p-2.5 mb-2 text-xs">
                      <p>{insp.requested_date} at {insp.requested_time}</p>
                      <p className="text-gray-500">{insp.meeting_point}</p>
                    </div>
                  ))}
                </div>
              )}

              {property.offers.length === 0 && property.rentalApplications.length === 0 && property.inspections.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">No activity on this property yet.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
