// Matches the real `management_termination_requests` table exactly
// (see backend-v2/31_management_termination.sql).
export interface ManagementTerminationRequest {
  id: string;
  tenancy_id: string;
  requested_by: string;
  reason: string | null;
  requested_at: string;
  notice_period_ends_at: string;
  status: "pending" | "confirmed" | "cancelled";
}

// Reasonable, clearly-disclosed industry-standard defaults — a real
// starting draft for the client to review and adjust, not a figure
// already confirmed as final. Kept in one place so it's genuinely easy
// to change later without hunting through the codebase.
export const TERMINATION_NOTICE_DAYS = 30;
