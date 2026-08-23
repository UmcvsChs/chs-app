// Matches the real, already-existing `inspections` table exactly (see
// backend/01_schema.sql) — this table already has real access rules and
// a genuine built-in safeguard (a minimum 12-hour notice period,
// enforced by the database itself, not just the UI), so this rebuild
// reuses it directly rather than building something new.

export interface Inspection {
  id: string;
  reference: string;
  property_id: string;
  requester_id: string;
  requested_date: string;
  requested_time: string;
  meeting_point: string;
  distance_km: number | null;
  transport_fee: number | null;
  video_call: boolean;
  verified_report_addon: boolean;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  created_at: string;
}
