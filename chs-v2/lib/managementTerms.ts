import { SERVICE_TNC } from "@/types/serviceTnc";

// What an owner agrees to when handing a property to CHS. The full terms live in types/serviceTnc.ts and are shown in
// a scroll-to-the-end screen. The version is stored with each request. NOT yet reviewed by a lawyer.
export const MANAGEMENT_TERMS_VERSION = "2";

export const MANAGEMENT_PURPOSES = [
  { value: "rent", label: "Rent (long-term letting)", tnc: "Managed letting (rent)" },
  { value: "shortlet", label: "Shortlet", tnc: "Shortlet management" },
  { value: "sale", label: "Sale", tnc: "Managed sale" },
  { value: "hotel", label: "Hotel, lodge or other commercial operation", tnc: "Hotel & commercial management" },
] as const;

export type MgmtPurpose = (typeof MANAGEMENT_PURPOSES)[number]["value"];

export function tncKeyFor(purpose: string): string {
  return MANAGEMENT_PURPOSES.find((p) => p.value === purpose)?.tnc ?? "";
}
export function feeLineFor(purpose: string): string {
  return SERVICE_TNC[tncKeyFor(purpose)]?.fee ?? "";
}
export function feeTermsFor(purposes: string[]): string {
  return MANAGEMENT_PURPOSES.filter((p) => purposes.includes(p.value)).map((p) => `${p.label}: ${feeLineFor(p.value)}`).join("\n");
}

export const CAPACITIES = [
  { value: "owner", label: "I am the owner" },
  { value: "co_owned", label: "Family or co-owned property" },
  { value: "attorney", label: "I act for the owner (power of attorney)" },
  { value: "company", label: "The property belongs to a company" },
] as const;

// The documents CHS needs before it can take a property. One upload box per line.
export function requiredDocuments(capacity: string, purposes: string[]): string[] {
  const docs: string[] = ["Proof of ownership (title document, deed, or purchase agreement)"];
  if (capacity === "co_owned") docs.push("Written consent of all co-owners or family members");
  if (capacity === "attorney") docs.push("Power of attorney (notarised) in CHS's favour or the agent's", "Valid ID of the owner");
  if (capacity === "company") docs.push("CAC registration certificate", "Board resolution authorising CHS to manage or sell");
  if (purposes.includes("hotel")) docs.push("Operating licences and certificates (tourism, fire, business premises)");
  return docs;
}

export const COMPREHENSION = [
  { q: "Does the owner pay both the CHS management fee and the standard CHS service charge on the same rent, sale or booking?",
    options: ["Yes, both", "No: the management fee replaces the standard service charge", "Neither is ever charged"], correct: 1 },
  { q: "May the owner take a tenant, guest or buyer introduced by CHS off the platform and be paid directly?",
    options: ["Yes, if they agree", "Only after one year", "No, all money goes through CHS"], correct: 2 },
  { q: "Can CHS review and change these terms?",
    options: ["Never", "Yes, at any time with or without prior notice. A fee or term change for a running arrangement applies once CHS has told the owner, who may end it if they disagree", "Only once a year, with 6 months' notice"], correct: 1 },
];
