// What a vendor must tell a buyer, by category — modelled on how established marketplaces (Jumia, Konga, Amazon)
// describe goods: the identity (brand, model, condition), the specification that decides the purchase (size,
// capacity, power, material, dimensions), the options the buyer chooses (colour, size), what is in stock, the
// warranty, and several photographs. A fixed set of questions per category means every listing of the same kind
// can be compared like-for-like, and a buyer is never left guessing.

export interface SpecField {
  key: string;
  label: string;
  type: "text" | "select" | "number";
  options?: string[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
}

export interface CategorySpecs {
  brandRequired: boolean;
  goods: SpecField[];
  service: SpecField[];
}

export const CONDITIONS: { value: "new" | "used" | "refurbished"; label: string }[] = [
  { value: "new", label: "Brand new" },
  { value: "refurbished", label: "Refurbished" },
  { value: "used", label: "Used" },
];

export const OPTION_PRESETS = ["Color", "Size", "Capacity", "Voltage", "Pack size"];

const DIMENSIONS: SpecField = { key: "Dimensions (L × W × H)", label: "Dimensions (L × W × H)", type: "text", placeholder: "e.g. 120 × 60 × 75 cm" };
const WEIGHT: SpecField = { key: "Weight", label: "Weight", type: "text", placeholder: "e.g. 18 kg" };
const IN_BOX: SpecField = { key: "What is in the box", label: "What is in the box", type: "text", placeholder: "e.g. TV, remote, wall bracket, manual" };

// Services: what a client needs to trust a provider before asking for a quote.
const SERVICE_COMMON = (licenceRequired: boolean, licenceHint: string): SpecField[] => [
  { key: "Licence / certification", label: "Licence / certification (name and number)", type: "text", required: licenceRequired, placeholder: licenceHint },
  { key: "Years in operation", label: "Years in operation", type: "number", required: true, placeholder: "e.g. 6" },
  { key: "Team size", label: "Team size (people)", type: "number", placeholder: "e.g. 25" },
  { key: "Response time", label: "How quickly you respond", type: "select", required: true, options: ["Within 2 hours", "Same day", "Within 24 hours", "2–3 days"] },
  { key: "Availability", label: "Availability", type: "select", required: true, options: ["24 hours, 7 days", "Weekdays only", "Weekdays and Saturdays", "By appointment"] },
  { key: "What is included", label: "What is included in your service", type: "text", required: true, placeholder: "e.g. uniformed guards, supervisor visits, incident reports" },
  { key: "Equipment / products used", label: "Equipment / products used", type: "text", placeholder: "e.g. approved chemicals, two-way radios, vehicles" },
];

export const SPECS: Record<string, CategorySpecs> = {
  home_equipment: {
    brandRequired: true,
    goods: [
      { key: "Product type", label: "Product type", type: "select", required: true, options: ["Television", "Refrigerator / Freezer", "Air conditioner", "Washing machine", "Generator", "Inverter / Solar", "Fan", "Microwave / Oven", "Cooker / Gas stove", "Water dispenser", "Sound system / Home theatre", "Laptop / Computer", "Phone / Tablet", "Other"] },
      { key: "Size / capacity", label: "Size / capacity", type: "text", required: true, placeholder: "e.g. 55 inch, 250 litres, 1.5 HP, 7 kg" },
      { key: "Key features", label: "Key features", type: "text", placeholder: "e.g. Smart TV, 4K, double door, no-frost, inverter" },
      { key: "Power rating", label: "Power rating", type: "text", placeholder: "e.g. 150 W, 2.5 kVA" },
      { key: "Voltage", label: "Voltage", type: "select", options: ["220–240 V", "110–120 V", "Dual voltage", "Battery / solar"] },
      { key: "Energy rating", label: "Energy rating", type: "select", options: ["A+++", "A++", "A+", "A", "B", "C", "Not rated"] },
      DIMENSIONS, WEIGHT, IN_BOX,
    ],
    service: [],
  },
  furniture: {
    brandRequired: false,
    goods: [
      { key: "Furniture type", label: "Furniture type", type: "select", required: true, options: ["Sofa / Couch", "Chair", "Dining set", "Table", "Bed / Bed frame", "Wardrobe", "TV stand", "Shelf / Cabinet", "Desk / Office furniture", "Outdoor furniture", "Other"] },
      { key: "Material", label: "Material", type: "select", required: true, options: ["Solid wood", "MDF / Board", "Metal", "Leather", "Fabric", "Glass", "Plastic", "Rattan / Cane", "Mixed materials"] },
      { ...DIMENSIONS, required: true },
      { key: "Seating capacity", label: "Seating capacity", type: "text", placeholder: "e.g. 3-seater (sofas, sets)" },
      { key: "Assembly", label: "Assembly", type: "select", options: ["Delivered assembled", "Assembly required", "Assembled on site by us"] },
      { key: "Style", label: "Style", type: "select", options: ["Modern", "Classic", "Minimalist", "Rustic", "Contemporary", "Other"] },
      WEIGHT,
    ],
    service: [],
  },
  bedding_textiles: {
    brandRequired: false,
    goods: [
      { key: "Item type", label: "Item type", type: "select", required: true, options: ["Bedsheet set", "Duvet / Comforter", "Pillow", "Mattress protector", "Curtains", "Rug / Carpet", "Towels", "Blanket", "Other"] },
      { key: "Material", label: "Material", type: "select", required: true, options: ["Cotton", "Silk", "Satin", "Linen", "Polyester", "Microfibre", "Wool", "Mixed materials"] },
      { key: "Pieces in the set", label: "Pieces in the set", type: "number", placeholder: "e.g. 4" },
      { key: "Thread count", label: "Thread count", type: "number", placeholder: "e.g. 300" },
      { key: "Dimensions", label: "Dimensions", type: "text", placeholder: "e.g. 180 × 200 cm" },
      { key: "Care instructions", label: "Care instructions", type: "text", placeholder: "e.g. machine wash at 30°C" },
    ],
    service: [],
  },
  kitchen_supplies: {
    brandRequired: true,
    goods: [
      { key: "Item type", label: "Item type", type: "select", required: true, options: ["Cookware", "Cutlery", "Dinnerware", "Small kitchen appliance", "Food storage", "Utensils", "Other"] },
      { key: "Material", label: "Material", type: "select", required: true, options: ["Stainless steel", "Non-stick", "Aluminium", "Cast iron", "Glass", "Ceramic", "Plastic", "Wood", "Mixed materials"] },
      { key: "Capacity", label: "Capacity / size", type: "text", placeholder: "e.g. 5 litres, 24 cm" },
      { key: "Pieces in the set", label: "Pieces in the set", type: "number", placeholder: "e.g. 12" },
      { key: "Power rating", label: "Power rating (appliances)", type: "text", placeholder: "e.g. 1200 W" },
      { key: "Dishwasher safe", label: "Dishwasher safe", type: "select", options: ["Yes", "No"] },
      { key: "Microwave safe", label: "Microwave safe", type: "select", options: ["Yes", "No"] },
    ],
    service: [],
  },
  building_materials: {
    brandRequired: true,
    goods: [
      { key: "Grade / specification", label: "Grade / specification", type: "text", required: true, placeholder: "e.g. 42.5R, 12 mm, 0.45 gauge, 4-inch" },
      { key: "Size / thickness", label: "Size / thickness", type: "text", placeholder: "e.g. 9 inch, 3 m length" },
      { key: "Standard / certification", label: "Standard / certification", type: "text", placeholder: "e.g. SON certified, NIS" },
      { key: "Minimum order", label: "Minimum order", type: "text", placeholder: "e.g. 50 bags" },
    ],
    service: [],
  },
  interior_design: {
    brandRequired: false,
    goods: [
      { key: "Item type", label: "Item type", type: "select", required: true, options: ["Décor piece", "Lighting", "Wall art", "Wallpaper / Wall panel", "Flooring", "Ceiling / POP", "Window blinds", "Custom design package", "Other"] },
      { key: "Style", label: "Style", type: "select", options: ["Modern", "Classic", "Minimalist", "Luxury", "Rustic", "Contemporary", "Other"] },
      { key: "Material", label: "Material", type: "text", placeholder: "e.g. gypsum, solid wood, glass" },
      { key: "Suitable room", label: "Suitable room", type: "select", options: ["Living room", "Bedroom", "Kitchen", "Bathroom", "Office", "Outdoor", "Any room"] },
      DIMENSIONS,
    ],
    service: [
      { key: "Service type", label: "What you design", type: "select", required: true, options: ["Residential interiors", "Office interiors", "Hospitality interiors", "Space planning only", "Full design and fit-out"] },
      { key: "Years in operation", label: "Years in operation", type: "number", required: true, placeholder: "e.g. 5" },
      { key: "What is included", label: "What is included", type: "text", required: true, placeholder: "e.g. concept, 3D renders, sourcing, supervision" },
      { key: "Typical turnaround", label: "Typical turnaround", type: "text", placeholder: "e.g. 3–6 weeks" },
    ],
  },
  security_services: { brandRequired: false, goods: [], service: SERVICE_COMMON(true, "e.g. Police / NSCDC licence number") },
  cleaning_services: { brandRequired: false, goods: [], service: SERVICE_COMMON(false, "e.g. trade or professional body certificate") },
  fumigation_pest_control: { brandRequired: false, goods: [], service: SERVICE_COMMON(true, "e.g. NAFDAC / environmental permit number") },
  facilities_maintenance: { brandRequired: false, goods: [], service: SERVICE_COMMON(false, "e.g. COREN / trade certificate") },
};

export function specFieldsFor(category: string, listingType: "product" | "service"): SpecField[] {
  const s = SPECS[category];
  if (!s) return [];
  return listingType === "service" ? s.service : s.goods;
}
