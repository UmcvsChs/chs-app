import type { MarketplaceCategory } from "@/types/marketplace";

// ONE list of what CHS's marketplace sells, split into the two things people actually are:
//   VENDOR            sells GOODS     — furniture, electronics, building materials …
//   SERVICE PROVIDER  does a SERVICE  — security, cleaning, fumigation, facilities maintenance …
// (A third path, ARTISAN — plumbers, electricians, carpenters — has its own registration.)
// Before, registration showed all ten in one flat list, so a company selling TVs saw "Security Services" and
// "Fumigation" beside "Furniture". Every screen now reads this file, so the two groups can never mix again.

export type MarketplaceKind = "vendor" | "service";

export interface CategoryDef { value: MarketplaceCategory; label: string; short: string; blurb: string }

export const VENDOR_CATEGORIES: CategoryDef[] = [
  { value: "interior_design", label: "Interior Design", short: "Interior Design", blurb: "Décor, lighting, wall finishes, flooring, custom design packages" },
  { value: "furniture", label: "Furniture", short: "Furniture", blurb: "Sofas, beds, tables, wardrobes, office and outdoor furniture" },
  { value: "bedding_textiles", label: "Bedding & Textiles", short: "Bedding & Textiles", blurb: "Bedsheets, duvets, pillows, curtains, rugs, towels" },
  { value: "home_equipment", label: "Electronics & Home Appliances", short: "Electronics & Appliances", blurb: "TVs, refrigerators, air conditioners, generators, washing machines" },
  { value: "kitchen_supplies", label: "Kitchen", short: "Kitchen", blurb: "Cookware, cutlery, dinnerware, kitchen appliances, storage" },
  { value: "building_materials", label: "Building Materials", short: "Building Materials", blurb: "Cement, blocks, roofing, tiles, pipes, paint, steel" },
];

export const SERVICE_CATEGORIES: CategoryDef[] = [
  { value: "security_services", label: "Security Services", short: "Security", blurb: "Guards, patrols, CCTV and alarm monitoring" },
  { value: "cleaning_services", label: "Cleaning Services", short: "Cleaning", blurb: "Home, office and post-construction cleaning" },
  { value: "fumigation_pest_control", label: "Fumigation & Pest Control", short: "Fumigation & Pest Control", blurb: "Fumigation, pest and rodent control" },
  { value: "facilities_maintenance", label: "Facilities Maintenance", short: "Facilities Maintenance", blurb: "Ongoing building, estate and plant maintenance" },
];

export const KIND_LABEL: Record<MarketplaceKind, string> = { vendor: "Vendor", service: "Service Provider" };

export function categoriesFor(kind: MarketplaceKind): CategoryDef[] {
  return kind === "service" ? SERVICE_CATEGORIES : VENDOR_CATEGORIES;
}

export function categoryKind(category: string): MarketplaceKind {
  return SERVICE_CATEGORIES.some((c) => c.value === category) ? "service" : "vendor";
}

export function categoryLabel(category: string): string {
  return [...VENDOR_CATEGORIES, ...SERVICE_CATEGORIES].find((c) => c.value === category)?.label || category;
}
