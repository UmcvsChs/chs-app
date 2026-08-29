// Matches the real `wallets` and `wallet_transactions` tables exactly
// (see backend/01_schema.sql) — a genuinely more sophisticated real
// system than a single balance: separate main, rent-savings,
// maintenance-reserve, and agent-earnings tracking, each with its own
// real transaction history.

export interface Wallet {
  user_id: string;
  main_balance: number;
  rent_savings: number;
  maintenance_reserve: number;
  agent_earnings_paid: number;
  agent_earnings_pending: number;
  frozen: boolean;
  frozen_reason: string | null;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  wallet_type: "main" | "rent_savings" | "maintenance_reserve" | "agent_earnings";
  amount: number;
  direction: "credit" | "debit";
  description: string | null;
  reference: string | null;
  created_at: string;
}
