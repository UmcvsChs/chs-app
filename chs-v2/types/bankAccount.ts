// Matches the real `linked_bank_accounts` and
// `pending_bank_account_changes` tables exactly (see
// backend-v2/24_bank_account_security.sql) — restored from a real,
// confirmed feature in the original app.
export interface LinkedBankAccount {
  id: string;
  user_id: string;
  bank_name: string;
  bank_code: string | null;
  account_number: string;
  account_name: string;
  updated_at: string;
  is_active_for_withdrawal: boolean;
}

export interface PendingBankAccountChange {
  id: string;
  user_id: string;
  bank_name: string;
  bank_code: string | null;
  account_number: string;
  account_name: string;
  requested_at: string;
  effective_at: string;
  status: "pending" | "cancelled" | "applied";
}
