// Matches the real `referral_fee_settings` and `referral_fees_owed`
// tables exactly (see backend-v2/16_referral_fee_settings.sql) —
// deliberately admin-adjustable, never hardcoded, so the actual fee
// amounts can be tuned as real deals come in, without needing a new
// code deployment every time.
export interface ReferralFeeSetting {
  category: string;
  flat_fee_amount: number;
  updated_at: string;
}

export interface ReferralFeeOwed {
  id: string;
  quote_request_id: string;
  vendor_id: string;
  amount: number;
  status: "owed" | "invoiced" | "paid";
  created_at: string;
}
