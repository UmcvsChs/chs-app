// Matches the real `fault_reports` and `fault_quotations` tables exactly
// (see backend/01_schema.sql and backend/06_fault_reports_backend.sql) —
// this system already has real, shared, cross-device backing; it was
// specifically fixed in the original app after being found to only ever
// exist in one browser's local memory. This rebuild reuses it directly.

export interface FaultQuotation {
  id: string;
  fault_report_id: string;
  vendor_name: string;
  amount: number;
  submitted_by: "chs_vendor" | "owner" | "tenant";
  note: string | null;
  flag: "good" | "caution" | null;
  created_at: string;
}

export interface FaultReport {
  id: string;
  ticket_ref: string | null;
  tenancy_id: string | null;
  property_id: string | null;
  category: string;
  urgency: "low" | "medium" | "high";
  location_in_property: string | null;
  description: string;
  status:
    | "reported"
    | "assigned"
    | "converted_to_quote"
    | "gathering_quotes"
    | "awaiting_owner_approval"
    | "awaiting_manager_approval"
    | "approved_by_owner"
    | "approved_by_manager"
    | "resolved";
  approved_vendor: string | null;
  approved_amount: number | null;
  min_quotes_required: number;
  created_at: string;
}
