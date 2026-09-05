"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import RoleBadge from "@/components/RoleBadge";

// Real, new dashboard completing a real, confirmed gap: a real
// account could register as a Developer, but there was no way to log
// back in under that role, and — checked directly — no dedicated
// dashboard existed for it at all, the same category of gap already
// fixed for Buyer, Guest, and Host.
interface DeveloperApplication {
  company_name: string;
  cac_number: string;
  status: string;
  offers_instalments: boolean;
  accepts_investment_capital: boolean;
  portfolio_url: string | null;
}

interface DeveloperProperty {
  id: string;
  title: string;
  status: string;
  price: number;
  location_area: string;
  location_state: string;
}

export default function DeveloperDashboardPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [application, setApplication] = useState<DeveloperApplication | null>(null);
  const [properties, setProperties] = useState<DeveloperProperty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    Promise.all([
      supabase.from("developer_applications")
        .select("company_name, cac_number, status, offers_instalments, accepts_investment_capital, portfolio_url")
        .eq("user_id", session.user.id)
        .maybeSingle(),
      supabase.from("properties")
        .select("id, title, status, price, location_area, location_state")
        .eq("owner_id", session.user.id)
        .order("created_at", { ascending: false }),
    ]).then(([appRes, propsRes]) => {
      setApplication(appRes.data);
      setProperties(propsRes.data || []);
      setLoading(false);
    });
  }, [authLoading, session, router]);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] pb-10 zone-developer">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <RoleBadge label="Commercial Developer" />
        <h1 className="font-serif text-lg font-bold mt-1">My Developer Dashboard</h1>
        {application && (
          <p className="text-xs text-white/60 mt-1">{application.company_name} — {application.status}</p>
        )}
      </div>

      <div className="px-4 py-4 space-y-2">
        {application && (
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-sm font-semibold text-chs-charcoal mb-1">My real application</p>
            <p className="text-xs text-gray-500">CAC: {application.cac_number}</p>
            <p className="text-xs text-gray-500">
              {application.offers_instalments ? "✓ Offers instalment plans" : "No instalment plans"} ·{" "}
              {application.accepts_investment_capital ? "✓ Accepts investment capital" : "No investment capital"}
            </p>
            {application.portfolio_url && (
              <a href={application.portfolio_url} target="_blank" rel="noreferrer" className="text-[11px] text-chs-red underline block mt-1">View my real portfolio</a>
            )}
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full inline-block mt-2 ${application.status === "approved" ? "bg-green-100 text-green-700" : "bg-chs-amber-light text-chs-red"}`}>
              {application.status}
            </span>
          </div>
        )}

        <Link href="/list-property" className="block bg-white rounded-xl border border-gray-200 p-4 text-sm font-bold text-chs-charcoal text-center">
          + List a new real estate/development →
        </Link>

        <p className="text-xs font-bold text-chs-charcoal mt-4">🏗️ My Real Listings ({properties.length})</p>
        {properties.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">No real listings yet.</p>
        ) : (
          properties.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
              <div className="flex justify-between items-start">
                <p className="text-sm font-semibold text-chs-charcoal">{p.title}</p>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full text-gray-500 bg-gray-100">{p.status}</span>
              </div>
              <p className="text-xs text-gray-500">{p.location_area}, {p.location_state}</p>
              <p className="text-sm font-bold text-chs-charcoal mt-1">{formatNaira(p.price)}</p>
            </div>
          ))
        )}

        <Link href="/wallet" className="block bg-white rounded-xl border border-gray-200 p-4 text-sm font-bold text-chs-charcoal text-center mt-4">
          💰 My Real Wallet →
        </Link>
      </div>
    </div>
  );
}
