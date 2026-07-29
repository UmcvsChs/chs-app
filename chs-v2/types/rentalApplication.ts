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
  move_in_date: string;
  status: "pending" | "awaiting_owner_decision" | "approved" | "owner_declined";
  created_at: string;
}
