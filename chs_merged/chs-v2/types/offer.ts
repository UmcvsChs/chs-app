// Matches the real `offers` table (see backend/11_offers_table.sql) —
// a genuine, shared database table from day one, unlike the original
// app's version of this feature, which only ever lived in one browser's
// local memory.

export interface Offer {
  id: string;
  property_id: string;
  buyer_id: string;
  amount: number;
  note: string | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  chs_cleared: boolean;
  created_at: string;
}
