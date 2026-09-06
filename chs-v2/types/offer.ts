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
  payment_status?: "unpaid" | "paid";
  chs_cleared: boolean;
  created_at: string;
  buyer_full_name?: string | null;
  buyer_phone?: string | null;
  buyer_occupation?: string | null;
  buyer_source_of_funds?: string | null;
  buyer?: { full_name: string; phone: string; valid_id_verified: boolean; residential_address: string | null } | null;
}
