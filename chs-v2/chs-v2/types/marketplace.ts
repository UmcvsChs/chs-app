// Matches the real `marketplace_vendors` and `marketplace_products`
// tables exactly (see backend/03_marketplace_schema.sql) — a vendor's
// verification is genuinely separate from a real-estate owner's NIN/
// liveness check, using CAC registration instead, matching how these
// are two different kinds of businesses with different real proof.

export type MarketplaceCategory =
  | "interior_design"
  | "furniture"
  | "bedding_textiles"
  | "home_equipment"
  | "building_materials";

export interface MarketplaceProduct {
  id: string;
  vendor_id: string;
  name: string;
  category: MarketplaceCategory;
  price: number;
  price_unit: string | null;
  description: string | null;
  photos: string[];
  status: "active" | "sold_out" | "delisted";
  created_at: string;
}

export interface MarketplaceVendor {
  id: string;
  user_id: string;
  business_name: string;
  category: MarketplaceCategory;
  cac_number: string | null;
  description: string | null;
  phone: string | null;
  location_state: string | null;
  location_lga: string | null;
  verification_status: "pending" | "verified" | "rejected";
}
