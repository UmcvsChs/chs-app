import { createClient } from "@/lib/supabase/server";
import MarketplaceClient from "@/components/MarketplaceClient";
import { MarketplaceProduct } from "@/types/marketplace";
import { MarketplaceBundle } from "@/types/marketplaceBundle";

// Always fetch fresh — same real reasoning as the property homepage: a
// new product or a sold-out status must never wait for a rebuild to
// show up.
export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const supabase = await createClient();
  const [productsRes, bundlesRes] = await Promise.all([
    supabase.from("marketplace_products").select("*").eq("status", "active").order("created_at", { ascending: false }),
    supabase.from("marketplace_bundles").select("*").eq("status", "active").order("created_at", { ascending: false }),
  ]);

  if (productsRes.error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6">
        <p className="text-sm text-gray-500">Could not load the marketplace right now. Please try again shortly.</p>
      </div>
    );
  }

  return (
    <MarketplaceClient
      products={(productsRes.data ?? []) as MarketplaceProduct[]}
      bundles={(bundlesRes.data ?? []) as MarketplaceBundle[]}
    />
  );
}
