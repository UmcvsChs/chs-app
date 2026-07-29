// Matches the real `community_feedback` table exactly (see
// backend/01_schema.sql) — deliberately anonymous by design, no
// submitter is ever stored at all, not even privately. Admin-moderated
// before anything becomes publicly visible.
export interface CommunityFeedback {
  id: string;
  property_id: string;
  relation: string;
  note: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}
