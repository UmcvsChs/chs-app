// Matches the real `marketplace_bundles` table exactly (see
// backend-v2/28_marketplace_bundles.sql) — restored from a real,
// confirmed feature in the original app, genuinely separate from
// individual products.
export interface MarketplaceBundle {
  id: string;
  vendor_id: string;
  bundle_name: string;
  category: string;
  items_included: string;
  price: number;
  description: string | null;
  status: "active" | "delisted";
  created_at: string;
}
