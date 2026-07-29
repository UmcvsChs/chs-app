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
  status: "pending" | "responded" | "closed";
  vendor_response: string | null;
  quoted_amount: number | null;
  created_at: string;
}
