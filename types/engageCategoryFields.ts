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

export const ENGAGE_CATEGORY_FIELDS: Record<string, EngageField[]> = {
  "Full property management": [
    { id: "units", label: "Number of units/properties to manage", type: "text", placeholder: "e.g. 1 flat, or 4 units in one compound" },
    { id: "occupancy", label: "Current occupancy", type: "select", options: ["Fully occupied", "Partially occupied", "Fully vacant"] },
    { id: "existing_tenancy", label: "Existing tenant agreements to take over?", type: "select", options: ["Yes", "No"] },
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
    { id: "start_date", label: "Preferred start date", type: "text", placeholder: "e.g. Within 1 month, or a specific date" },
  ],
  "Renovation project management": [
    { id: "reno_areas", label: "Which rooms/areas need renovation?", type: "text", placeholder: "e.g. Kitchen, 2 bathrooms, roof repair" },
    { id: "occupied_during", label: "Is the property currently occupied?", type: "select", options: ["Yes, work must happen around occupants", "No, vacant during the work"] },
    { id: "timeline", label: "Preferred timeline", type: "text", placeholder: "e.g. Complete within 6 weeks" },
  ],
  "Other real estate service": [],
};
