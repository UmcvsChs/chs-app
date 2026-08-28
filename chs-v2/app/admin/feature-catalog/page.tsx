"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { FEATURE_CATALOG } from "@/types/featureCatalogData";

// The real, always-in-sync in-app version of CHS_COMPLETE_FEATURE_CATALOG.pdf
// — same real data, so admin never has to go find the downloaded file to
// answer "where do I find this" or "does this feature even have an admin
// screen." Admin only, matching every other /admin sub-page's real guard.
export default function FeatureCatalogPage() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!session || profile?.role !== "admin") {
      router.push("/");
    }
  }, [authLoading, session, profile, router]);

  if (authLoading || !session || profile?.role !== "admin") {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  const q = query.trim().toLowerCase();
  const filtered = FEATURE_CATALOG.map((section) => ({
    ...section,
    rows: q
      ? section.rows.filter((r) =>
          r.feature.toLowerCase().includes(q) ||
          r.how.toLowerCase().includes(q) ||
          r.destination.toLowerCase().includes(q) ||
          r.admin.toLowerCase().includes(q)
        )
      : section.rows,
  })).filter((section) => section.rows.length > 0);

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/admin" className="text-xs text-gray-400 mb-3 inline-block">← Back to Admin dashboard</Link>
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">📋 Feature Catalog</h1>
        <p className="text-xs text-gray-400 mb-4">
          Every real feature on CHS, where to find it, and where to trace or resolve it from admin — the same real
          content as the downloadable document, always current.
        </p>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Search — e.g. wallet, promotion, verification..."
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm mb-5"
        />

        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No features match &quot;{query}&quot;.</p>
        ) : (
          filtered.map((section) => (
            <div key={section.title} className="mb-6">
              <h2 className="text-sm font-bold text-chs-charcoal mb-2">{section.title}</h2>
              <div className="space-y-2">
                {section.rows.map((row, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 p-3">
                    <p className="text-xs font-bold text-chs-charcoal">{row.feature}</p>
                    <p className="text-[11px] text-gray-600 mt-1">{row.how}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-gray-100">
                      <p className="text-[10px] text-gray-500"><strong className="text-chs-charcoal">Destination:</strong> {row.destination}</p>
                      <p className="text-[10px] text-gray-500"><strong className="text-chs-charcoal">Admin:</strong> {row.admin}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
