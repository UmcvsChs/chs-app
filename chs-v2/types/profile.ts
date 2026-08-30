// Matches the real `profiles` table exactly, as it stands after every
// migration applied so far (base schema + 05 through 10) — kept
// genuinely in sync with the actual database, not approximated.

export interface Profile {
  id: string;
  role: "buyer" | "tenant" | "owner" | "agent" | "manager" | "developer" | "admin";  full_name: string;
  phone: string;
  email: string | null;
  state: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  nin: string | null;

  trust_score: number;
  deals_completed: number;
  badges: string[];
  listed_since: string;

  // Multi-role support (item #17) — every additional role this account
  // has genuinely linked, beyond its primary `role`.
  secondary_roles: string[];

  // Real sub-admin infrastructure (backend-v2/50_wallet_fixes_and_admin_approval.sql)
  // — true only for the one genuine super admin; every other
  // role='admin' account is a sub-admin, subject to login approval.
  is_super_admin: boolean;

  // Agent-specific
  agent_type: "independent" | "chs_official" | null;
  agent_tier: number;
  association_name: string | null;
  membership_id: string | null;
  membership_verified: boolean;
  chs_agent_id: string | null;
  operating_lgas: string | null;
  years_experience: string | null;
  application_motivation: string | null;
  reference_1: string | null;
  reference_2: string | null;

  // Shared identity verification (agents and managers both use this)
  valid_id_type: string | null;
  valid_id_number: string | null;
  valid_id_document_url: string | null;
  valid_id_verified: boolean;

  // Property Manager-specific
  pm_qualification: string | null;
  pm_registration_number: string | null;
  profession: string | null;
  professional_registration_number: string | null;
  operating_states: string | null;
  certificate_document_url: string | null;
  professional_credentials_verified: boolean;

  // Commercial Developer-specific
  company_name: string | null;
  cac_number: string | null;
  developer_projects: string | null;
  offers_instalment: boolean;
  offers_investment: boolean;

  created_at: string;
}
