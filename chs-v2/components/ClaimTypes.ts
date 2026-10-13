export interface Claim {
  id: string; booking_id: string; property: string; check_in: string; check_out: string; guest: string; covered: boolean; event: string | null;
  reason_type: string; reason: string; evidence_url: string | null; choice: "reschedule" | "refund"; new_check_in: string | null; new_check_out: string | null;
  status: "awaiting_host" | "awaiting_guest" | "admin_review" | "completed" | "rejected" | "withdrawn";
  host_costs: number; host_note: string | null; host_deadline: string | null; paid_amount: number; cap: number; venue_keeps: number | null; refund_amount: number | null;
  outcome: string | null; admin_note: string | null; created_at: string; completed_at: string | null;
}
export const CLAIM_STATUS: Record<string, string> = {
  awaiting_host: "Waiting for the venue", awaiting_guest: "Waiting for the guest", admin_review: "With CHS to decide", completed: "Done", rejected: "Not approved", withdrawn: "Withdrawn",
};
export const claimDay = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00+01:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
