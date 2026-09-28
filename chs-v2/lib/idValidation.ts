// Kept for the screens that already call it. It now delegates to the
// single rulebook in lib/validators.ts, so every ID type — not just
// the NIN — is checked against its real format, and the rule is the
// same as everywhere else in the app and in the database.
import { validateIdNumber } from "@/lib/validators";

export function validateIdNumberFormat(idType: string, idNumber: string): boolean {
  return validateIdNumber(idType, idNumber).valid;
}

export const ID_TYPE_PLACEHOLDERS: Record<string, string> = {
  "National ID (NIN slip)": "e.g. 12345678901 (11 digits)",
  "Voter's Card": "e.g. 90F5A1B2C3D4E5F6789",
  "International Passport": "e.g. A12345678",
  "Driver's Licence": "e.g. ABJ123456AB12",
};
