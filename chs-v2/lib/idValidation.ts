// Same real validation already tested in the original app — genuine
// format checking for the well-established NIN format, and requiring a
// real number for other ID types without pretending to validate formats
// that don't have one universal standard (that would risk blocking a
// legitimate real ID over guessed formatting rules).
export function validateIdNumberFormat(idType: string, idNumber: string): boolean {
  if (!idNumber || idNumber.trim().length < 5) return false;
  if (idType === "National ID (NIN slip)") return /^\d{11}$/.test(idNumber.trim());
  return true;
}

export const ID_TYPE_PLACEHOLDERS: Record<string, string> = {
  "National ID (NIN slip)": "e.g. 12345678901 (11 digits)",
  "Voter's Card": "e.g. 90F5A1B2C3D4E5F6789",
  "International Passport": "e.g. A12345678",
  "Driver's Licence": "e.g. ABJ123456AB12",
};
