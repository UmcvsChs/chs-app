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
//   Version 3 — rewrites term 11: hotels, lodges, shortlets and event centres are booked
//               request-first (nothing is charged until the host confirms, then a short window
//               to pay), everything between guest and host goes through CHS, messages are
//               reviewed before delivery until a booking is paid, and hosts never see a
//               guest's phone number.
//
//   Version 4 — every payment is made through the CHS Wallet only; the wallet is protected (transaction PIN, limits,
//               a 24-hour pause on money received from another user or added by card, unfamiliar-device and SMS-code
//               checks, self-freeze, fraud reports and reversal); the cost of a physical inspection is the requester's alone
//               and paid through the wallet; sale proceeds are released exactly, including when the seller asks and CHS
//               verifies delivery; Rent to Own requests go to CHS first and the owner may decline.
//
// Rolling out a new version is safe in either order: the database's accept_terms() records the
// version the person actually saw (anything from 1 up to the current one), so a page that is a
// version behind can never lock anyone out — they are simply asked again, once, afterwards.
export const CURRENT_TERMS_VERSION = 4;
export const TERMS_UPDATED_LABEL = "October 2026";

// Shown to people who accepted an earlier version, so they know exactly what changed instead of
// being asked to re-read everything blind. It covers every change since version 1, because some
// people last accepted that long ago.
export const TERMS_WHATS_NEW =
  "Two things are new. Term 36: if the other side of your deal (a seller, landlord, host or vendor) fails to deliver, you get your full payment back including CHS's own commission, less only a small real bank processing fee. Term 11: hotels, lodges, shortlets and event centres are now booked request-first — nothing is charged when you send a request, CHS passes it to the host, and you pay only after the host confirms, within a short window. Everything between a guest and a host goes through CHS: messages are reviewed before delivery until a booking is paid, and phone numbers and emails are blocked. New in Version 4: every payment on CHS is made through your CHS Wallet only — never pay a person or a bank account. Your wallet is now better protected (a transaction PIN, limits, a 24-hour pause before money received from another user or added by card can go to a bank, checks on unfamiliar devices, a Freeze button, and a way to report a transfer as fraud). If you still want a physical inspection after seeing the photos and videos, the transport cost is yours alone and is paid from your wallet. A seller can ask CHS to release sale money once the documents are delivered. Rent to Own requests go to CHS first, and the owner may decline."; 

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
