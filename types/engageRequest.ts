// Matches the real `engage_chs_requests` table exactly (see
// backend/01_schema.sql) — an owner requesting CHS take on full,
// professional management of a property.
export interface EngageRequest {
  id: string;
  reference: string;
  owner_id: string;
  property_id: string | null;
  service_type: string;
  description: string;
  location: string | null;
  category_details: Record<string, string>;
  budget: string | null;
  documents: string[];
  admin_note: string | null;
  status: "pending" | "accepted" | "rejected" | "more_info_requested" | "agreement_signed";
  created_at: string;
}
