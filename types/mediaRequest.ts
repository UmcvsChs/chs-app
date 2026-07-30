// Matches the real `media_requests` table exactly (see
// backend/01_schema.sql) — deliberately anonymous by design, same as
// community_feedback: no requester is ever stored, even privately.
export interface MediaRequest {
  id: string;
  property_id: string;
  request_type: string | null;
  description: string;
  status: "pending" | "answered";
  answer: string | null;
  answered_at: string | null;
  created_at: string;
}
