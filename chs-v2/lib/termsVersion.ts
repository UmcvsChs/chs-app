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
//   Version 5 — Mortgage (Rent to Own) is held by CHS end to end: every instalment goes to CHS first and is released
//               to the owner by CHS; the final payment is held until the property documents are handed over, and
//               is released by hand by a CHS super admin (automatic release only when CHS switches it on).
//   Version 6 — adds term 37, "Records and timestamps": CHS keeps full date-and-time records (to the second, Nigerian time) of
//               documents, confirmations, payments, applications and staff actions, and they may be relied on as evidence in a dispute.
//   Version 7 — adds term 38, "Hospitality plans, team tools and operator data": paid plans billed from the wallet, lower
//               commission for subscribers, the free pilot, team roles, operator responsibility for guest and staff data,
//               imports and linked calendars, and voided (never erased) records.
//
//   Version 8 — adds term 39, "Complete and honest listings" (the required items, no hidden prices, honest and recorded price changes,
//               a private contact number, 30-day availability confirmation, reports and review, consequences) and term 40, "Food, drink and
//               extras paid to the operator" (room orders and event quotation extras are paid to the operator directly, an exception to
//               wallet-only payment, with no CHS hold or commission).
//
// Rolling out a new version is safe in either order: the database's accept_terms() records the
// version the person actually saw (anything from 1 up to the current one), so a page that is a
// version behind can never lock anyone out — they are simply asked again, once, afterwards.
export const CURRENT_TERMS_VERSION = 8;
export const TERMS_UPDATED_LABEL = "October 2026";

// Shown to people who accepted an earlier version, so they know exactly what changed instead of
// being asked to re-read everything blind. It covers every change since version 1, because some
// people last accepted that long ago.
export const TERMS_WHATS_NEW =
  "Two things are new. Term 36: if the other side of your deal (a seller, landlord, host or vendor) fails to deliver, you get your full payment back including CHS's own commission, less only a small real bank processing fee. Term 11: hotels, lodges, shortlets and event centres are now booked request-first — nothing is charged when you send a request, CHS passes it to the host, and you pay only after the host confirms, within a short window. Everything between a guest and a host goes through CHS: messages are reviewed before delivery until a booking is paid, and phone numbers and emails are blocked. New in Version 4: every payment on CHS is made through your CHS Wallet only — never pay a person or a bank account. Your wallet is now better protected (a transaction PIN, limits, a 24-hour pause before money received from another user or added by card can go to a bank, checks on unfamiliar devices, a Freeze button, and a way to report a transfer as fraud). If you still want a physical inspection after seeing the photos and videos, the transport cost is yours alone and is paid from your wallet. A seller can ask CHS to release sale money once the documents are delivered. Rent to Own requests go to CHS first, and the owner may decline. New in Version 5: on a Mortgage (Rent to Own) every instalment you pay is held by CHS and released to the owner by CHS, and the final payment stays with CHS until the property documents are in your hands and you have confirmed it in the app. CHS releases that final payment by hand. New in Version 6: term 37 explains that CHS keeps an exact date-and-time record of every important event (documents, confirmations, payments, applications) and that these records can be relied on as evidence if there is ever a dispute. New in Version 7: term 38 is for hotel, lodge and event-centre hosts. It explains the paid Pro and Business plans (paid from your wallet, a lower CHS commission, a 7-day grace if a renewal fails), the free pilot, team roles, who is responsible for guest and staff data, importing spreadsheets and linking calendars, and that a wrong entry is voided, never erased. New in Version 8: term 39 says every listing must show its real price, location, street address, at least five photos, a video, a description and a private contact number, that asking people to DM or call for the price is not allowed, that price changes are recorded and shown, that property listings must be confirmed as still available every 30 days or they are hidden, and that anyone can report a listing. Term 40 explains that food and drink ordered to a hotel room and extras in an event quotation are paid to the hotel or venue directly, not through your wallet, and CHS does not hold that money.";

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
