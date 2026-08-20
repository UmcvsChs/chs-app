// Matches the real `artisans`, `artisan_ratings`, and
// `artisan_job_disputes` tables exactly (see
// backend-v2/30_maintenance_artisan_system.sql) — built from a real,
// detailed design conversation with the client on 30 July 2026.

export const ARTISAN_TRADES = [
  { value: "painter", label: "Painter" },
  { value: "plumber", label: "Plumber" },
  { value: "electrician", label: "Electrician" },
  { value: "carpenter", label: "Carpenter" },
  { value: "bricklayer", label: "Bricklayer / Mason" },
  { value: "tiler", label: "Tiler" },
  { value: "welder", label: "Welder / Metal fabricator" },
  { value: "roofer", label: "Roofer" },
  { value: "pop_ceiling", label: "POP / Ceiling installer" },
  { value: "ac_technician", label: "AC / Refrigeration technician" },
  { value: "generator_technician", label: "Generator technician" },
  { value: "aluminum_glazier", label: "Aluminium / Glazier" },
  { value: "interior_decorator", label: "Interior decorator" },
  { value: "landscaper", label: "Landscaper / Gardener" },
  { value: "borehole_driller", label: "Borehole driller" },
  { value: "cleaner", label: "Professional cleaner" },
  { value: "fumigator", label: "Fumigation / Pest control" },
  { value: "other", label: "Other" },
];

export const EQUIPMENT_TIERS = [
  { value: "basic", label: "Basic hand tools" },
  { value: "power_tools", label: "Power tools" },
  { value: "professional", label: "Professional-grade equipment" },
];

export interface Artisan {
  id: string;
  user_id: string;
  trades: string[];
  other_trade_description: string | null;
  years_experience: number;
  certification_body: string | null;
  certification_document_url: string | null;
  equipment_tier: "basic" | "power_tools" | "professional";
  equipment_photo_url: string | null;
  equipment_receipt_url: string | null;
  base_state: string;
  base_lga: string | null;
  willing_to_travel_interstate: boolean;
  artisan_type: "independent" | "chs_agent";
  verification_status: "pending" | "verified" | "rejected";
  created_at: string;
}

export interface ArtisanRating {
  id: string;
  fault_report_id: string;
  artisan_id: string;
  rated_by: string;
  quality_stars: number;
  reliability_stars: number;
  conduct_stars: number;
  comment: string | null;
  created_at: string;
}

export interface ArtisanJobDispute {
  id: string;
  fault_report_id: string;
  raised_by: string;
  against: string;
  description: string;
  status: "open" | "ruled_for_raiser" | "ruled_for_other" | "closed";
  ruling_notes: string | null;
  created_at: string;
}

// The real, agreed ranking weighting from the design conversation:
// rating/reliability weighted highest, experience next, equipment
// third, price shown but weighted least — a genuine starting point,
// meant to be tuned once real jobs and real ratings provide real data.
export function calculateArtisanScore(artisan: {
  avgRating: number; // 0-5, 0 if no ratings yet
  years_experience: number;
  equipment_tier: string;
}): number {
  const ratingScore = artisan.avgRating * 12; // 0-60 — deliberately the most dominant factor
  const experienceScore = Math.min(artisan.years_experience, 20) * 1; // 0-20, caps at 20yrs
  const equipmentScore = { basic: 5, power_tools: 12, professional: 20 }[artisan.equipment_tier] || 0; // 0-20
  return ratingScore + experienceScore + equipmentScore;
}
