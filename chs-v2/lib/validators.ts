// ONE rulebook for every phone, ID and account number the platform
// collects. Every form uses this file, and the database enforces the
// same rules independently (migration 407), so a rule can never differ
// from one screen to the next — and a screen that forgets to check
// still cannot store a malformed number.
//
// Adjust a rule HERE and in the matching database function
// (chs_phone_error / chs_id_number_error / chs_nin_error /
// chs_account_error) together.
//
// Built after a direct client test: a guarantor's 10-digit NIN was
// accepted because the form only checked the field wasn't empty.

export interface Validation {
  valid: boolean;
  /** The cleaned, standard form to store (spaces removed, +234 → 0…). */
  value: string;
  /** Plain-language reason when not valid, otherwise null. */
  message: string | null;
}

// ---------- Phone ----------

/** Standard stored form: 11 digits starting 0. +234… and 234… are converted. */
export function normalizePhone(raw: string): string {
  const v = (raw || "").replace(/[\s\-().]/g, "");
  if (/^\+234\d{10}$/.test(v)) return "0" + v.slice(4);
  if (/^234\d{10}$/.test(v)) return "0" + v.slice(3);
  return v;
}

export function validatePhone(raw: string, opts: { international?: boolean } = {}): Validation {
  const value = normalizePhone(raw);
  if (/^0[789][01]\d{8}$/.test(value)) return { valid: true, value, message: null };
  if (opts.international && /^\+[1-9]\d{7,14}$/.test(value)) return { valid: true, value, message: null };

  const digits = value.replace(/\D/g, "").length;
  let message: string;
  if (/[^0-9+]/.test(value)) message = "A phone number may only contain digits.";
  else if (opts.international && value.startsWith("+")) message = "That international number looks incomplete or too long — include the country code, for example +447911123456.";
  else if (digits !== 11) message = `A Nigerian mobile number has exactly 11 digits, like 08012345678 — you entered ${digits}.`;
  else message = "That doesn't look like a real Nigerian mobile number — it should start with 070, 080, 081, 090 or 091.";
  return { valid: false, value, message };
}

// ---------- NIN, account number ----------

export function validateNin(raw: string): Validation {
  const value = (raw || "").replace(/[\s\-]/g, "");
  if (/^\d{11}$/.test(value)) return { valid: true, value, message: null };
  if (/\D/.test(value)) return { valid: false, value, message: "A NIN contains digits only." };
  return { valid: false, value, message: `A National ID (NIN) number is exactly 11 digits — you entered ${value.length}.` };
}

export function validateAccountNumber(raw: string): Validation {
  const value = (raw || "").replace(/[\s\-]/g, "");
  if (/^\d{10}$/.test(value)) return { valid: true, value, message: null };
  if (/\D/.test(value)) return { valid: false, value, message: "A bank account number contains digits only." };
  return { valid: false, value, message: `A bank account number is exactly 10 digits — you entered ${value.length}.` };
}

// ---------- ID numbers, by type ----------

export interface IdRule {
  key: "nin" | "passport" | "voter" | "driver";
  min: number;
  max: number;
  numericOnly: boolean;
  example: string;
  /** Short description shown under the field. */
  hint: string;
}

const ID_RULES: Record<IdRule["key"], IdRule> = {
  nin: { key: "nin", min: 11, max: 11, numericOnly: true, example: "12345678901", hint: "11 digits" },
  passport: { key: "passport", min: 9, max: 9, numericOnly: false, example: "A12345678", hint: "1 letter followed by 8 digits" },
  voter: { key: "voter", min: 19, max: 19, numericOnly: false, example: "90F5A1B2C3D4E5F6789", hint: "19 letters and digits" },
  driver: { key: "driver", min: 10, max: 15, numericOnly: false, example: "ABJ123456AB12", hint: "10 to 15 letters and digits" },
};

/** Which rule applies to an ID type name; null when the type isn't recognised. */
export function idRuleFor(idType: string): IdRule | null {
  const t = (idType || "").toLowerCase();
  if (t.startsWith("national id") || t.includes("nin slip")) return ID_RULES.nin;
  if (t.includes("passport")) return ID_RULES.passport;
  if (t.includes("voter")) return ID_RULES.voter;
  if (t.includes("driver") || t.includes("licen")) return ID_RULES.driver;
  return null;
}

export function validateIdNumber(idType: string, raw: string): Validation {
  const rule = idRuleFor(idType);
  const value = (raw || "").replace(/[\s\-]/g, "").toUpperCase();
  if (!rule) {
    // Not a recognised ID type: only insist that something real was typed.
    return value.length >= 5
      ? { valid: true, value, message: null }
      : { valid: false, value, message: "Please enter the ID number exactly as it appears on your document." };
  }
  if (rule.key === "nin") return validateNin(value);
  if (rule.key === "passport") {
    return /^[A-Z]\d{8}$/.test(value)
      ? { valid: true, value, message: null }
      : { valid: false, value, message: "A Nigerian international passport number is one letter followed by 8 digits, like A12345678." };
  }
  if (rule.key === "voter") {
    return /^[A-Z0-9]{19}$/.test(value)
      ? { valid: true, value, message: null }
      : { valid: false, value, message: `A voter's card number (VIN) is 19 letters and digits — you entered ${value.length}.` };
  }
  return /^[A-Z0-9]{10,15}$/.test(value)
    ? { valid: true, value, message: null }
    : { valid: false, value, message: `A driver's licence number is 10 to 15 letters and digits — you entered ${value.length}.` };
}

// ---------- Names, email ----------

/** A real person's name: at least two words, letters (and . - ') only. */
export function validateFullName(raw: string, label = "full name"): Validation {
  const value = (raw || "").trim().replace(/\s+/g, " ");
  if (value.split(" ").filter(Boolean).length < 2) {
    return { valid: false, value, message: `Please enter the ${label} — first name and surname at least.` };
  }
  if (/[^A-Za-z\u00C0-\u024F.\-'\s]/.test(value)) {
    return { valid: false, value, message: `A name should contain letters only — please check the ${label}.` };
  }
  return { valid: true, value, message: null };
}

export function validateEmail(raw: string): Validation {
  const value = (raw || "").trim().toLowerCase();
  return /^\S+@\S+\.\S{2,}$/.test(value)
    ? { valid: true, value, message: null }
    : { valid: false, value, message: "Please enter a valid email address." };
}
