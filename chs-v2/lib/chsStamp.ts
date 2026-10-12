// The "Managed by CHS" identity. The status and the tag ID are issued by CHS admins in the database
// (see backend-v2/477_chs_managed_identity.sql); owners and agents cannot set them. The screens only draw
// what the database says, so the stamp cannot appear on a listing CHS has not stamped.

export type ChsService = "independent" | "chs_advertised" | "chs_managed";

export function isChsStamped(level?: string | null): level is "chs_advertised" | "chs_managed" {
  return level === "chs_advertised" || level === "chs_managed";
}

export function chsLabel(level?: string | null): string {
  if (level === "chs_managed") return "Managed & Advertised by CHS";
  if (level === "chs_advertised") return "Advertised by CHS";
  return "";
}

export function chsShortLabel(level?: string | null): string {
  if (level === "chs_managed") return "CHS MANAGED";
  if (level === "chs_advertised") return "CHS ADVERTISED";
  return "";
}

export const CHS_VERIFY_PATH = "/verify-chs";
