"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import PropertyCard from "@/components/PropertyCard";
import { Property } from "@/types/property";

export default function SavedPropertiesPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
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
