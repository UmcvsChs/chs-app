// Matches the real `engage_chs_requests` table exactly (see
// backend/01_schema.sql) — an owner requesting CHS take on full,
// professional management of a property.
export interface EngageRequest {
  id: string;
  reference: string;
  owner_id: string;
  service_type: string;
  description: string;
  location: string | null;
  status: "pending" | "contacted" | "agreement_signed";
  created_at: string;
}
