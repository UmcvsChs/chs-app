"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import PropertyCard from "@/components/PropertyCard";
import { Property } from "@/types/property";
import { formatNaira } from "@/lib/format";

interface Negotiation {
  id: string;
  amount: number;
  status: string;
  properties: { id: string; title: string } | null;
}

export default function SavedPropertiesPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    supabase
      .from("saved_properties")
      .select("properties(*)")
      .eq("user_id", session.user.id)
      .then(({ data }) => {
        setProperties((data || []).map((r) => r.properties).filter(Boolean) as unknown as Property[]);
        setLoading(false);
      });

    // Real, new fix per direct client request: a dedicated, automatic
    // list of every property with a genuine, unresolved negotiation —
    // no need to remember to "save" a property first. Anything still
    // pending, or declined but not yet paid for, shows up here on its
    // own, with a direct link straight back to the real chat.
    supabase
      .from("offers")
      .select("id, amount, status, properties(id, title)")
      .eq("buyer_id", session.user.id)
      .eq("payment_status", "unpaid")
      .neq("status", "withdrawn")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setNegotiations((data as unknown as Negotiation[]) || []);
      });
  }, [authLoading, session, router]);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen zone-buyer bg-[var(--zone-bg)] pb-20">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <h1 className="font-serif text-lg font-bold mt-1">❤️ Saved Properties</h1>
      </div>

      {negotiations.length > 0 && (
        <div className="px-4 pt-4">
          <p className="text-xs font-bold text-chs-charcoal mb-2">💬 My Active Negotiations</p>
          <div className="space-y-2 mb-4">
            {negotiations.map((n) => (
              <Link key={n.id} href={`/property/${n.properties?.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold text-chs-charcoal">{n.properties?.title}</p>
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                    n.status === "accepted" ? "text-green-700 bg-green-50" :
                    n.status === "rejected" ? "text-chs-amber-dark bg-chs-amber-light" : "text-gray-500 bg-gray-100"
                  }`}>
                    {n.status === "accepted" ? "Accepted — pay now" : n.status === "rejected" ? "Declined — reply" : "Pending"}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">Your offer: {formatNaira(n.amount)} · Tap to continue the chat</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-4 grid grid-cols-2 gap-3">
        {properties.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <p className="text-3xl mb-2">🤍</p>
            <p className="text-sm font-semibold text-chs-charcoal">No saved properties yet</p>
            <p className="text-xs text-gray-400 mt-1">Tap the heart icon on any property to save it here.</p>
          </div>
        ) : (
          properties.map((p) => <PropertyCard key={p.id} property={p} />)
        )}
      </div>
    </div>
  );
}

