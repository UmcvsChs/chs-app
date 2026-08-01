"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Property } from "@/types/property";

// Real, genuine analytics — the original app's version of this screen
// showed entirely fake, hardcoded numbers (a fixed "47" views, "6.4%"
// rate, never computed from anything real). Built properly here:
// every number is genuinely counted from real records.
export default function PropertyAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [property, setProperty] = useState<Property | null>(null);
  const [viewCount, setViewCount] = useState(0);
  const [inspectionCount, setInspectionCount] = useState(0);
  const [interestCount, setInterestCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !session) return;
    (async () => {
      const { data: propertyData } = await supabase.from("properties").select("*").eq("id", params.id as string).single();
      if (!propertyData || propertyData.owner_id !== session.user.id) {
        setLoading(false);
        return;
      }
      setProperty(propertyData as Property);

      const [viewsRes, inspectionsRes, interestRes] = await Promise.all([
        supabase.from("property_views").select("id", { count: "exact", head: true }).eq("property_id", params.id as string),
        supabase.from("inspections").select("id", { count: "exact", head: true }).eq("property_id", params.id as string),
        supabase.from("property_interest").select("id", { count: "exact", head: true }).eq("property_id", params.id as string),
      ]);
      setViewCount(viewsRes.count || 0);
      setInspectionCount(inspectionsRes.count || 0);
      setInterestCount(interestRes.count || 0);
      setLoading(false);
    })();
  }, [authLoading, session, params.id]);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }
  if (!session) {
    router.push("/login");
    return null;
  }
  if (!property) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm text-gray-500 mb-4">This listing could not be found, or you don&apos;t have permission to view its analytics.</p>
        <Link href="/owner" className="text-sm font-semibold text-chs-red">Back to My Properties</Link>
      </div>
    );
  }

  const conversionRate = viewCount > 0 ? ((interestCount / viewCount) * 100).toFixed(1) : "0.0";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <Link href="/owner" className="text-xs text-gray-400">← Back to My Properties</Link>
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mt-1 mb-1">Analytics</h1>
        <p className="text-sm text-gray-500 mb-6">{property.title}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
            <p className="font-serif text-2xl font-bold text-chs-red">{viewCount}</p>
            <p className="text-[10px] text-gray-400 mt-1">Total views</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
            <p className="font-serif text-2xl font-bold text-chs-red">{interestCount}</p>
            <p className="text-[10px] text-gray-400 mt-1">Interest registered</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
            <p className="font-serif text-2xl font-bold text-chs-red">{inspectionCount}</p>
            <p className="text-[10px] text-gray-400 mt-1">Inspections booked</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
            <p className="font-serif text-2xl font-bold text-chs-red">{conversionRate}%</p>
            <p className="text-[10px] text-gray-400 mt-1">View → interest rate</p>
          </div>
        </div>

        <p className="text-xs text-gray-500 bg-chs-amber-light rounded-lg px-3 py-2.5 mt-4">
          Every number here is genuinely tracked from real visits and real actions — not an estimate.
        </p>
      </div>
    </div>
  );
}
