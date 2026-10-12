import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PropertyCard from "@/components/PropertyCard";
import { Property } from "@/types/property";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Properties managed by CHS | CHS",
  description: "Properties CHS manages and advertises itself: published fees, no hidden charges, every one with a CHS tag you can check.",
};

// The public home of "Managed by CHS": what it means, how to check a tag, and every stamped listing in one place.
export default async function ChsManagedPage() {
  const supabase = await createClient();
  const [{ data: list }, { data: counts }, { data: settings }] = await Promise.all([
    supabase.from("properties").select("*").neq("chs_service", "independent").eq("verification_status", "verified").in("status", ["active", "coming_soon"]).order("created_at", { ascending: false }).limit(60),
    supabase.rpc("get_chs_counts"),
    supabase.from("platform_settings").select("key, value").in("key", ["rental_commission_tenant_percentage", "rental_commission_landlord_percentage"]),
  ]);
  const properties = (list ?? []) as Property[];
  const c = (counts as { managed: number; advertised: number } | null) ?? { managed: 0, advertised: 0 };
  const tenantPct = settings?.find((s) => s.key === "rental_commission_tenant_percentage")?.value ?? "6";

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-3"><Link href="/" className="text-sm">← Back</Link></div>
      <div className="px-4 py-5">
        <h1 className="font-serif text-xl font-bold text-chs-charcoal">🛡️ Managed by CHS</h1>
        <p className="text-xs text-gray-600 mt-1">These are the properties CHS manages or advertises itself. Prices are published, fees are published, and every property has a CHS tag you can check yourself.</p>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="bg-chs-charcoal rounded-xl p-3 text-center"><p className="font-serif text-lg font-bold text-amber-300">{c.managed}</p><p className="text-[10px] text-white/70 uppercase">Managed &amp; Advertised</p></div>
          <div className="bg-white border border-chs-charcoal rounded-xl p-3 text-center"><p className="font-serif text-lg font-bold text-chs-charcoal">{c.advertised}</p><p className="text-[10px] text-gray-500 uppercase">Advertised by CHS</p></div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3 mt-4 text-xs text-gray-700 space-y-1.5">
          <p className="font-bold text-chs-charcoal">What the stamp means</p>
          <p><b>Managed &amp; Advertised by CHS:</b> CHS runs the property. A tenant pays the rent plus the published CHS agency fee ({tenantPct}%). No agent commission, no legal or agreement fee, no &quot;RCD&quot;, no inspection fee.</p>
          <p><b>Advertised by CHS:</b> CHS has checked the property and the owner and advertises it. The price and every fee are shown on the listing.</p>
          <p><b>No stamp:</b> a listing from another owner or agent. CHS still verifies it, but the lister sets their own fees, and the listing shows them.</p>
        </div>

        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mt-3 text-xs text-amber-900">
          <p className="font-bold">Seen a CHS badge somewhere else?</p>
          <p>A picture can be copied. A tag cannot be faked. <Link href="/verify-chs" className="underline font-bold">Check the tag here</Link> before you pay anyone.</p>
        </div>

        <h2 className="font-bold text-sm text-chs-charcoal mt-6 mb-2">All stamped properties ({properties.length})</h2>
        {properties.length === 0 ? (
          <p className="text-xs text-gray-500">No CHS-stamped properties are open right now. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{properties.map((p) => <PropertyCard key={p.id} property={p} />)}</div>
        )}
      </div>
    </div>
  );
}
