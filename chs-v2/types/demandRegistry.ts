// Matches the real `demand_registry` table exactly (see
// backend/01_schema.sql) — deliberately anonymous aggregate signal data,
// no user_id at all, by design.
export interface DemandEntry {
  id: string;
  search_summary: string;
  area_filter: string | null;
  min_price: number | null;
  max_price: number | null;
  created_at: string;
}
