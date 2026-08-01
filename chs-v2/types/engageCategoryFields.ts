// The exact real service categories and their category-specific fields
// from the original app, restored faithfully — matching what an
// architect, quantity surveyor, or project manager would actually need
// to scope and cost each kind of work.

export interface EngageField {
  id: string;
  label: string;
  type: "text" | "select";
  placeholder?: string;
  options?: string[];
}

export const ENGAGE_SERVICE_TYPES = [
  "Full property management",
  "Sale negotiation & marketing",
  "Construction monitoring",
  "Full construction / project management",
  "Renovation project management",
  "Other real estate service",
];

// The real, specific CHS remuneration for each service — restored,
// found completely missing during the systematic Service T&C
// comparison. This is genuine, important business transparency: what
// CHS actually charges, not a vague promise to "discuss fees later."
export const ENGAGE_SERVICE_FEES: Record<string, string> = {
  "Full property management": "10% of gross annual rent collected, billed annually or monthly at your preference. Minimum charge of ₦150,000/year per property.",
  "Sale negotiation & marketing": "Tiered by property value: 8% up to ₦50M, 6% for ₦50M–₦200M, 5% for ₦200M–₦500M, 4% for ₦500M–₦1B, 3% above ₦1B.",
  "Construction monitoring": "3% of total construction budget, minimum ₦2,000,000, paid in tranches tied to construction milestones.",
  "Full construction / project management": "10% of total construction budget, paid in tranches tied to construction stages.",
  "Renovation project management": "Tiered by renovation budget: 15% under ₦20M, 10% for ₦20M–₦100M, 7% above ₦100M. Minimum charge ₦500,000.",
  "Other real estate service": "To be agreed individually based on the scope you describe, and confirmed in writing before any work begins.",
};

export const ENGAGE_CATEGORY_FIELDS: Record<string, EngageField[]> = {
  "Full property management": [
    { id: "estimated_value", label: "Estimated property value (₦)", type: "text", placeholder: "e.g. 45,000,000 — helps us scope the right team" },
    { id: "units", label: "Number of units/properties to manage", type: "text", placeholder: "e.g. 1 flat, or 4 units in one compound" },
    { id: "tenant_count", label: "Current number of tenants", type: "text", placeholder: "e.g. 3 tenants, or 0 if fully vacant" },
    { id: "occupancy", label: "Current occupancy", type: "select", options: ["Fully occupied", "Partially occupied", "Fully vacant"] },
    { id: "existing_tenancy", label: "Existing tenant agreements to take over?", type: "select", options: ["Yes", "No"] },
    { id: "facilities", label: "On-site facilities (if any)", type: "text", placeholder: "e.g. Borehole, generator, security post, gated compound" },
    { id: "management_style", label: "How involved do you want to stay?", type: "select", options: ["Fully hands-off — CHS decides day to day", "Consulted on major decisions only", "Regular full reporting, CHS executes"] },
  ],
  "Sale negotiation & marketing": [
    { id: "asking_price", label: "Asking price (₦)", type: "text", placeholder: "e.g. 45,000,000" },
    { id: "title_status", label: "Title document status", type: "select", options: ["C of O", "Governor's Consent", "Family/customary land", "Deed of Assignment", "Not yet sure"] },
    { id: "existing_interest", label: "Any existing buyer interest already?", type: "select", options: ["Yes", "No"] },
  ],
  "Construction monitoring": [
    { id: "project_stage", label: "Current project stage", type: "select", options: ["Foundation", "Structure/blockwork", "Roofing", "Finishing", "Not yet started"] },
    { id: "visit_frequency", label: "Site visit frequency needed", type: "select", options: ["Weekly", "Bi-weekly", "Monthly"] },
    { id: "contractor", label: "Current contractor's name & phone (if any)", type: "text", placeholder: "e.g. Musa Builders, 080XXXXXXXX" },
  ],
  "Full construction / project management": [
    { id: "project_type", label: "Project type", type: "select", options: ["New build", "Extension", "Full renovation"] },
    { id: "has_drawings", label: "Do you have approved architectural drawings?", type: "select", options: ["Yes", "No, need CHS to arrange this"] },
    { id: "approval_status", label: "Government/planning approval status", type: "select", options: ["Fully approved", "Application in progress", "Not yet started", "Not sure — need CHS to advise"] },
    { id: "bill_of_quantities", label: "Do you have a Bill of Quantities?", type: "select", options: ["Yes, I have one", "No, need CHS to prepare one", "Not sure what this is"] },
    { id: "site_status", label: "Current site status", type: "select", options: ["Empty land, nothing started", "Foundation laid", "Structure in progress", "Structure complete, needs finishing"] },
    { id: "start_date", label: "Preferred start date", type: "text", placeholder: "e.g. Within 1 month, or a specific date" },
  ],
  "Renovation project management": [
    { id: "reno_areas", label: "Which rooms/areas need renovation?", type: "text", placeholder: "e.g. Kitchen, 2 bathrooms, roof repair" },
    { id: "occupied_during", label: "Is the property currently occupied?", type: "select", options: ["Yes, work must happen around occupants", "No, vacant during the work"] },
    { id: "timeline", label: "Preferred timeline", type: "text", placeholder: "e.g. Complete within 6 weeks" },
  ],
  "Other real estate service": [],
};

// The real, automatic "what happens next" response — shown the
// instant a real request is submitted, answering exactly the question
// the client specifically raised ("what is the process, how do I get
// started") without needing a human to type it out each time.
// Deliberately deterministic, not AI-generated — every word here is
// genuinely accurate and consistent, never a guess or a hallucination,
// which matters for a real financial/legal services business.
export const ENGAGE_NEXT_STEPS: Record<string, string[]> = {
  "Full property management": [
    "A CHS property assessor reviews your real submission within 2 business days.",
    "If your property qualifies, CHS schedules a real site visit to confirm condition and facilities.",
    "You'll receive a real management agreement to review, covering fees and terms — nothing is finalised until you've actually seen and accepted it.",
    "Once signed, CHS begins managing the property — tenant relations, maintenance, and rent collection, based on how involved you chose to stay.",
  ],
  "Sale negotiation & marketing": [
    "A CHS agent reviews your submission and confirms your property's real title status.",
    "CHS lists the property with real marketing (photos, description, and — where relevant — a Diaspora Mode listing for buyers abroad).",
    "Every real offer is verified and shared with you directly — CHS never accepts on your behalf.",
    "Once you accept an offer, CHS manages the real transaction through to completion, including escrow.",
  ],
  "Construction monitoring": [
    "CHS assigns a real site officer matching your project's genuine scale and location.",
    "The real visit schedule you chose above begins, with a real report after each visit.",
    "You're notified immediately of anything genuinely concerning found on site.",
  ],
  "Full construction / project management": [
    "A CHS project manager reviews your real submission, including drawings and approval status if provided.",
    "If you don't yet have a Bill of Quantities or approved drawings, CHS can arrange these — this becomes the real, itemised basis for your project budget.",
    "You'll receive a real project proposal with cost breakdown and timeline before any work begins.",
    "Once approved, CHS manages contractors and procurement, with regular real progress updates.",
  ],
  "Renovation project management": [
    "A CHS officer reviews your real submission and the areas needing work.",
    "CHS arranges a site visit to confirm scope and provide a real cost estimate.",
    "Once you approve the estimate, work is scheduled around your stated occupancy needs.",
  ],
  "Other real estate service": [
    "A CHS team member personally reviews your real request, since it doesn't fit a standard category.",
    "You'll be contacted directly to clarify scope before anything is quoted.",
  ],
};
