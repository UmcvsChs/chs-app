// Matches the real `condition_reports` table exactly (see
// backend/01_schema.sql) — a genuine, structured record of a property's
// condition at move-in, confirmed by the tenant, visible to the real
// landlord too. This is exactly the kind of real evidence the dispute
// system already built can actually be checked against later.

export interface RoomItem {
  item: string;
  condition: "good" | "fair" | "poor";
}

export interface ConditionRoom {
  name: string;
  items: RoomItem[];
  notes: string;
}

export interface ConditionReport {
  id: string;
  reference: string;
  tenancy_id: string;
  rooms: ConditionRoom[];
  tenant_confirmed: boolean;
  status: "draft" | "pending_review" | "approved";
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
}
