// Matches the real `rental_applications` table (see
// backend-v2/12_rental_applications.sql) — built with the owner-decision
// fix already in place from the start, rather than needing a second pass
// to correct it later the way the original app did.

export interface RentalApplication {
  id: string;
  property_id: string;
  tenant_id: string;
  guarantor_name: string;
  guarantor_phone: string;
  guarantor_relationship: string | null;
  guarantor_address: string | null;
  guarantor_occupation: string | null;
  guarantor_consented: boolean;
  move_in_date: string;
  status: "pending" | "awaiting_owner_decision" | "owner_decided_pending_relay" | "approved" | "owner_declined";
  owner_decision: "approved" | "owner_declined" | null;
  applicant_occupation: string | null;
  applicant_present_address: string | null;
  applicant_income_source: string | null;
  applicant_id_type: string | null;
  applicant_id_number: string | null;
  applicant_id_document_url: string | null;
  created_at: string;
  properties: { title: string; street_address: string | null; location_area: string; owner_id: string; profiles: { full_name: string; phone: string } | null } | null;
  tenant: { full_name: string; phone: string } | null;
}
