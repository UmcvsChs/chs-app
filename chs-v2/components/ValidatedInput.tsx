"use client";

import { useState } from "react";
import {
  validatePhone,
  validateNin,
  validateAccountNumber,
  validateIdNumber,
  idRuleFor,
} from "@/lib/validators";

export type ValidatedKind = "phone" | "phoneIntl" | "nin" | "account" | "idNumber";

// An input that prevents a malformed number instead of reporting it
// later. As the person types it:
//  - refuses characters that can never be valid (letters in a NIN or
//    account number), and stops at the maximum length;
//  - shows a live count ("7 of 11 digits") while the number is
//    incomplete, so they can see exactly how far they are;
//  - turns green with a tick only when the number is genuinely valid,
//    and shows the exact reason in red if it isn't.
// The same rulebook (lib/validators.ts) is checked again when the form
// is submitted, and once more by the database, so this is help for the
// person — never the only guard.
export default function ValidatedInput({
  kind,
  idType,
  value,
  onChange,
  placeholder,
  className = "",
  id,
  disabled,
  highlighted,
}: {
  kind: ValidatedKind;
  /** Required for kind="idNumber": which ID this number belongs to. */
  idType?: string;
  value: string;
  onChange: (cleaned: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  /** Set by the form when submission stopped on this field. */
  highlighted?: boolean;
}) {
  const [touched, setTouched] = useState(false);
  const rule = kind === "idNumber" ? idRuleFor(idType || "") : null;

  function sanitize(raw: string): string {
    if (kind === "nin") return raw.replace(/\D/g, "").slice(0, 11);
    if (kind === "account") return raw.replace(/\D/g, "").slice(0, 10);
    if (kind === "phone" || kind === "phoneIntl") {
      // digits, plus a single leading "+"; spaces and dashes are tidied away
      const cleaned = raw.replace(/[^\d+]/g, "");
      const plus = cleaned.startsWith("+") ? "+" : "";
      return (plus + cleaned.replace(/\+/g, "")).slice(0, kind === "phoneIntl" ? 16 : 14);
    }
    // idNumber
    if (!rule) return raw.slice(0, 30);
    const base = rule.numericOnly ? raw.replace(/\D/g, "") : raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return base.slice(0, rule.max);
  }

  const result =
    kind === "phone" ? validatePhone(value) :
    kind === "phoneIntl" ? validatePhone(value, { international: true }) :
    kind === "nin" ? validateNin(value) :
    kind === "account" ? validateAccountNumber(value) :
    validateIdNumber(idType || "", value);

  // What "complete" means, for the live counter.
  const target =
    kind === "nin" ? 11 :
    kind === "account" ? 10 :
    (kind === "phone" || kind === "phoneIntl") ? 11 :
    rule ? rule.max : 0;
  const unit = (kind === "idNumber" && rule && !rule.numericOnly) ? "characters" : "digits";
  const typed = (kind === "phone" || kind === "phoneIntl") ? value.replace(/\D/g, "").length : value.length;
  const isIntlNumber = (kind === "phoneIntl") && value.startsWith("+") && !value.startsWith("+234");

  const hint =
    kind === "nin" ? "11 digits" :
    kind === "account" ? "10 digits" :
    kind === "phone" ? "11 digits, like 08012345678" :
    kind === "phoneIntl" ? "11 digits like 08012345678 — or start with + for a number abroad" :
    rule ? `${rule.hint}, like ${rule.example}` : "as it appears on your ID";

  let status: "empty" | "progress" | "valid" | "invalid" = "empty";
  if (value) {
    if (result.valid) status = "valid";
    else if (target && typed < target && !isIntlNumber && !/[^0-9A-Za-z+]/.test(value)) status = "progress";
    else status = "invalid";
  }
  // Don't shout in red while they're still mid-way: show progress until
  // they leave the field or have typed the full length.
  const showRed = status === "invalid" && (touched || (target > 0 && typed >= target));

  const border =
    highlighted ? "border-chs-red border-2" :
    status === "valid" ? "border-green-500" :
    showRed ? "border-chs-red" :
    status === "progress" ? "border-chs-amber-dark/60" : "border-gray-200";

  return (
    <div>
      <input
        id={id}
        type="text"
        inputMode={kind === "idNumber" && rule && !rule.numericOnly ? "text" : "numeric"}
        autoComplete="off"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(sanitize(e.target.value))}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        className={`${className} border ${border}`}
      />
      <p className={`text-[10px] mt-1 ${
        status === "valid" ? "text-green-700" : showRed ? "text-chs-red" : status === "progress" ? "text-chs-amber-dark" : "text-gray-400"
      }`}>
        {status === "empty" && hint}
        {status === "progress" && `${typed} of ${target} ${unit} — ${hint}`}
        {status === "valid" && "✓ Looks right"}
        {status === "invalid" && (showRed ? result.message : `${typed} ${unit} so far`)}
      </p>
    </div>
  );
}
