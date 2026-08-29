// Matches the real `shortlet_bookings` table exactly (see
// backend-v2/13_shortlet_bookings.sql) — protected by a genuine
// database-level exclusion constraint against double-booking, not just
// an application-side check.
export interface ShortletBooking {
  id: string;
  property_id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  total_price: number;
  guests: number;
  guest_full_name: string;
  guest_phone: string;
  guest_id_document_url: string | null;
  status: "confirmed" | "cancelled";
  payment_status: "unpaid" | "held_escrow" | "released" | "refunded";
  created_at: string;
}
