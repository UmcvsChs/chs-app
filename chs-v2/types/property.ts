// Matches the real `properties` table in Supabase exactly (see
// backend/01_schema.sql) — kept in sync with the actual database
// structure, not approximated, so TypeScript can genuinely catch a
// mistake (like referencing a field that doesn't exist, or forgetting
// one that's required) before the code ever runs.

export interface Property {
  id: string;
  owner_id: string;
  title: string;
  purpose: "rent" | "sale" | "lease" | "hire" | "shortlet" | "rent_to_own";
  property_type: string;
  location_area: string;
  location_lga: string | null;
  location_state: string;
  price: number;
  price_period: string | null;
  price_per_night: number | null;

  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor_area_sqm: number | null;
  fenced: boolean | null;
  gated: boolean | null;
  road_type: "tarred" | "untarred_motorable" | "untarred_difficult" | null;
  electricity_backup: string | null;
  water_source: string | null;
  estate_security: string | null;

  for_sale: boolean;
  acquisition_method: string | null;
  title_document_type: string | null;
  primary_document_type: string | null;
  payment_terms: string | null;
  owner_acceptable_amount: number | null;
  min_acceptable_amount: number | null;
  ownership_declared: boolean | null;
  deposit_percentage: number | null;
  balance_payment_deadline: string | null;

  rent_to_own_available: boolean;
  rent_to_own_monthly: number | null;
  rent_to_own_portion_pct: number | null;
  rent_to_own_years: number | null;
  rent_to_own_min_deposit: number | null;

  photos: string[];
  video_url: string | null;
  owner_identity_visible_to_tenant: boolean;
  managing_agent_id: string | null;
  agent_commission_pct: number | null;
  custom_fees: { label: string; percentage: number }[] | null;
  promoted_until: string | null;

  is_urgent_sale: boolean;
  urgent_sale_original_price: number | null;
  urgent_sale_reason: "relocation" | "medical" | "financial" | "other" | null;
  urgent_sale_deadline: string | null;
  urgent_sale_activated_at: string | null;

  verification_status: "pending" | "verified" | "rejected";
  verification_notes: string | null;

  status: "active" | "rented" | "sold" | "delisted" | "coming_soon";
  created_at: string;

  // Added this session — Estate Management and the extended commission model.
  estate_id: string | null;
  unit_label: string | null;
  hire_category: "shortlet" | "event_centre" | "hotel_lodge" | "car_park_casual" | "cinema_entertainment" | "recreational_sports" | null;
}

export type PropertyPurpose = Property["purpose"];
