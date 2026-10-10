// Listing rules shared by the listing form, the edit page and the vendor form. The database enforces the
// same rules independently (detect_price_evasion and the enforce_listing_basics trigger), so a screen that
// forgets to check still cannot publish a listing that hides its price.

const EVASION =
  /(\b(dm|inbox|pm|call|whatsapp|text|message|msg|contact|ask|chat|enquire|inquire)\b[^.\n]{0,25}\b(for|to know|to get|to see|about)\b[^.\n]{0,12}\b(price|prices|pricing|amount|cost|rate|rates|how much)\b)|(\bprice\b[^.\n]{0,15}\b(on|upon)\s+(request|enquiry|inquiry|inbox|dm)\b)|(\bprice\b\s*[:-]?\s*\b(dm|inbox|tbd|tba|call|hidden|undisclosed|confidential)\b)|(\bcall\s+for\s+price)|(\b(dm|inbox|pm|whatsapp)\b\s+(me\s+|us\s+)?(for\s+)?(details|info|information|more)\b)|(\bhow\s+much\b\s*\??\s*\b(dm|inbox|pm|call|whatsapp)\b)|(\bprice\b[^.\n]{0,10}\b(will be|to be)\b[^.\n]{0,12}\b(disclosed|given|sent|shared|told)\b)/i;

export const PRICE_EVASION_MESSAGE =
  "Please state the real price in the price field. Listings that ask people to message, call or DM for the price are not allowed on CHS.";

/** Returns a plain-language message when the text hides the price behind a message or call, otherwise null. */
export function priceEvasionError(text: string | null | undefined): string | null {
  return text && EVASION.test(text) ? PRICE_EVASION_MESSAGE : null;
}
