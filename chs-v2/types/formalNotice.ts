// Matches the real `formal_notices` table exactly (see
// backend-v2/19_formal_notices.sql) — restored from a real, confirmed
// feature in the original app. Deliberately immutable once issued.
export interface FormalNotice {
  id: string;
  reference: string;
  tenancy_id: string;
  notice_type: "sale" | "renovation" | "rent_review" | "quit" | "warning" | "query";
  details: Record<string, string>;
  issued_by: string;
  issued_at: string;
  first_viewed_at: string | null;
  status: "issued" | "acknowledged";
  created_at: string;
}

export const NOTICE_TYPE_LABELS: Record<string, string> = {
  sale: "Sale / Disposal Notice",
  renovation: "Renovation Notice",
  rent_review: "Rent Review Notice",
  quit: "Notice to Quit",
  warning: "Formal Warning",
  query: "Query",
};

// The exact real per-category fields from the original app, restored
// faithfully rather than approximated from memory.
export interface NoticeField {
  id: string;
  label: string;
  type: "text" | "select" | "date";
  placeholder?: string;
  options?: string[];
}

export const NOTICE_CATEGORY_FIELDS: Record<string, NoticeField[]> = {
  sale: [
    { id: "effective_date", label: "Effective date of sale/disposal", type: "text", placeholder: "e.g. 1 September 2026" },
    { id: "tenancy_continues", label: "Does the existing tenancy continue under the new owner?", type: "select", options: ["Yes, tenancy continues as-is", "No, tenant must vacate by the effective date", "To be discussed with new owner"] },
  ],
  renovation: [
    { id: "scope", label: "Scope of renovation work", type: "text", placeholder: "e.g. Full re-roofing and second-storey addition" },
    { id: "legal_basis", label: "Legal basis, if government-mandated (optional)", type: "text", placeholder: "e.g. Kaduna State highway-frontage 2-storey requirement" },
    { id: "start_date", label: "Expected start date", type: "text", placeholder: "e.g. 1 October 2026" },
    { id: "vacate_required", label: "Will the tenant need to vacate during works?", type: "select", options: ["Yes, temporarily", "No, tenant can remain"] },
  ],
  rent_review: [
    { id: "old_amount", label: "Current rent (₦)", type: "text", placeholder: "e.g. 450,000/year" },
    { id: "new_amount", label: "New rent (₦)", type: "text", placeholder: "e.g. 550,000/year" },
    { id: "effective_date", label: "Effective from", type: "text", placeholder: "e.g. Next renewal date, 1 January 2027" },
  ],
  quit: [
    { id: "reason", label: "Stated reason for the notice to quit", type: "text", placeholder: "Required — e.g. owner requires property for personal use" },
    { id: "vacate_by", label: "Vacate by (real date)", type: "date", placeholder: "" },
  ],
  warning: [
    { id: "reason", label: "What is this warning about?", type: "text", placeholder: "Required — e.g. repeated late rent payment, property misuse" },
    { id: "action_required", label: "What must the tenant do to resolve this?", type: "text", placeholder: "e.g. Settle outstanding balance within 7 days" },
  ],
  query: [
    { id: "subject", label: "Subject of the query", type: "text", placeholder: "Required — e.g. unauthorized subletting suspected" },
    { id: "details", label: "Details — what needs a response?", type: "text", placeholder: "Describe what you need the tenant to explain or address" },
  ],
};
