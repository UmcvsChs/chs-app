import { createClient } from "@/lib/supabase/server";
import MarketplaceClient from "@/components/MarketplaceClient";
import { MarketplaceProduct } from "@/types/marketplace";

// Always fetch fresh — same real reasoning as the property homepage: a
// new product or a sold-out status must never wait for a rebuild to
// show up.
export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("marketplace_products")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6">
        <p className="text-sm text-gray-500">Could not load the marketplace right now. Please try again shortly.</p>
      </div>
    );
  }

  return <MarketplaceClient products={(products ?? []) as MarketplaceProduct[]} />;
}
