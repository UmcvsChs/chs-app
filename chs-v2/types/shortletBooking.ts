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
  status: "confirmed" | "cancelled";
  created_at: string;
}
