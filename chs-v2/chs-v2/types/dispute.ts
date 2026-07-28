// Matches the real `disputes` table exactly (see backend/01_schema.sql).
export interface Dispute {
  id: string;
  tenancy_id: string | null;
  raised_by: string;
  against: string | null;
  description: string;
  amount_in_dispute: number | null;
  status: "open" | "ruled_for_tenant" | "ruled_for_owner" | "closed";
  ruling_notes: string | null;
  created_at: string;
}
