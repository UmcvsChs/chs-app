// The single place the app knows which version of the Terms & Conditions
// is current. It must match platform_settings.terms_current_version in the
// database: accept_terms() refuses any other number, so a mismatch can
// never silently record an acceptance of text the person did not see.
//
// To publish a changed set of Terms: edit components/TermsContent.tsx,
// raise CURRENT_TERMS_VERSION here, set TERMS_WHATS_NEW, and raise
// platform_settings.terms_current_version in a migration. Every user is
// then asked to read and accept the new version once, on their next visit.
//
//   Version 1 — the original 35 terms.
//   Version 2 — adds term 36, "Refunds when the other party defaults".
export const CURRENT_TERMS_VERSION = 2;
export const TERMS_UPDATED_LABEL = "October 2026";

// Shown to people who accepted an earlier version, so they know exactly
// what changed instead of being asked to re-read everything blind.
export const TERMS_WHATS_NEW =
  "Term 36 is new: if the other side of your deal (a seller, landlord, host or vendor) fails to deliver, you get your full payment back including CHS's own commission, less only a small real bank processing fee.";

type TermsFields = {
  terms_accepted_at: string | null;
  terms_version_accepted?: number | null;
};

// True when this person has never accepted, or accepted an older version.
// Someone who accepted before versioning existed has no recorded version
// and is treated as having accepted version 1.
export function termsAcceptanceRequired(profile: TermsFields | null | undefined): boolean {
  if (!profile) return false;
  if (!profile.terms_accepted_at) return true;
  return (profile.terms_version_accepted ?? 1) < CURRENT_TERMS_VERSION;
}
