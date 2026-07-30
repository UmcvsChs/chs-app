// Matches the real `agent_referrals_masked` VIEW exactly (see
// backend/01_schema.sql) — deliberately the masked version, never the
// underlying table directly, since the buyer's real identity is
// intentionally excluded from what an agent can see. This privacy
// design was already correctly built into the original schema; this
// rebuild respects it rather than accidentally widening access.

export interface AgentReferral {
  id: string;
  masked_reference: string;
  listing_agent_id: string | null;
  referring_agent_id: string | null;
  property_id: string;
  stage: "enquiry" | "inspection" | "offer" | "completed" | "lost";
  chs_commission: number | null;
  agent_share_pct: number | null;
  agent_payout: number | null;
  split_50_50: boolean;
  created_at: string;
}
