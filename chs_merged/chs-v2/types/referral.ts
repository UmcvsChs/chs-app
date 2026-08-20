// Matches the real `agent_referrals_masked` VIEW exactly (see
// backend/01_schema.sql) — deliberately never the raw `agent_referrals`
// table. The original schema is explicit about this: the masked view
// exists specifically to keep a real buyer's identity private from the
// agent, while still letting the agent see their own commission
// tracking. Respecting that distinction here, not just querying
// whichever table is more convenient.

export interface ReferralMasked {
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
