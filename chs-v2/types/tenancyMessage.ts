// Matches the real `tenancy_messages` table exactly (see
// backend-v2/20_tenancy_messaging.sql) — restored from a real,
// confirmed feature in the original app.
export interface TenancyMessage {
  id: string;
  tenancy_id: string;
  sender_id: string;
  text: string;
  created_at: string;
}
