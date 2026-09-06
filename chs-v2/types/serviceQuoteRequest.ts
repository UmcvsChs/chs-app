// Matches the real `service_quote_requests` table exactly (see
// backend-v2/15_marketplace_services_extension.sql) — a genuine,
// trackable request from a real property owner to a real service
// vendor (security, cleaning, fumigation), since real pricing for these
// depends on the specific property, not a fixed shelf price.
export interface ServiceQuoteRequest {
  id: string;
  product_id: string;
  requester_id: string;
  property_details: string;
  status: "pending" | "responded" | "paid" | "closed";
  vendor_response: string | null;
  quoted_amount: number | null;
  created_at: string;
  reference_number: string;
  moderation_status: "pending_review" | "approved" | "blocked";
  block_reason: string | null;
  response_moderation_status: "pending_review" | "approved" | "blocked" | null;
  response_block_reason: string | null;
  payment_status: "unpaid" | "held_escrow" | "released" | "refunded";
  buyer_commission_amount: number | null;
  vendor_commission_amount: number | null;
  escrow_reference: string | null;
}
