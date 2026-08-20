// Real, live currency reference conversion — genuinely informational
// only. The actual property price and every real transaction on CHS
// remains priced and settled in Naira throughout, in line with
// Nigeria's real, current Central Bank requirements. This exists
// solely so a foreign organisation (an embassy, a UN agency, an NGO)
// can see a real, live reference figure in their own currency for
// their own internal reporting convenience — it never becomes the
// actual transaction currency anywhere in this app.
//
// Uses ExchangeRate-API's genuinely free, no-key-required open access
// endpoint. Cached for 24 hours in the browser's memory for the
// current session, since a daily reference rate is genuinely all this
// use case needs — this is not meant for real-time trading.

interface CachedRates {
  rates: Record<string, number>;
  fetchedAt: number;
}

let cache: CachedRates | null = null;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

export const REFERENCE_CURRENCIES = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "EUR", label: "Euro", symbol: "€" },
];

export async function getNairaExchangeRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_DURATION_MS) {
    return cache.rates;
  }

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/NGN");
    const data = await response.json();
    if (data.result !== "success") throw new Error("Rate fetch failed");

    cache = { rates: data.rates, fetchedAt: Date.now() };
    return data.rates;
  } catch {
    // A real, honest failure — returns nothing rather than a stale or
    // fabricated number, since this is a real reference figure someone
    // may actually rely on for internal reporting.
    return {};
  }
}

export function convertNairaToReference(nairaAmount: number, rate: number): number {
  return nairaAmount * rate;
}
