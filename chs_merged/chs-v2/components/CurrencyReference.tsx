"use client";

import { useEffect, useState } from "react";
import { getNairaExchangeRates, convertNairaToReference, REFERENCE_CURRENCIES } from "@/lib/currencyReference";

// A real, live, but deliberately informational-only currency reference
// — genuinely useful for a foreign organisation's own internal
// reporting, while the real transaction on CHS always stays priced and
// settled in Naira, exactly as Nigeria's current financial regulations
// require.
export default function CurrencyReference({ nairaAmount }: { nairaAmount: number }) {
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!show) return;
    getNairaExchangeRates().then((r) => {
      setRates(r);
      setLoading(false);
    });
  }, [show]);

  if (!show) {
    return (
      <button onClick={() => setShow(true)} className="text-[10px] text-gray-400 underline mt-1">
        Show foreign currency reference
      </button>
    );
  }

  const rate = rates[selectedCurrency];
  const currency = REFERENCE_CURRENCIES.find((c) => c.code === selectedCurrency);

  return (
    <div className="mt-1.5 bg-gray-50 rounded-lg px-2.5 py-2 inline-block">
      <div className="flex items-center gap-2">
        <select
          value={selectedCurrency}
          onChange={(e) => setSelectedCurrency(e.target.value)}
          className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5"
        >
          {REFERENCE_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
        {loading ? (
          <span className="text-[10px] text-gray-400">Loading rate...</span>
        ) : rate ? (
          <span className="text-xs font-semibold text-gray-600">
            ≈ {currency?.symbol}{convertNairaToReference(nairaAmount, rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        ) : (
          <span className="text-[10px] text-gray-400">Rate unavailable right now</span>
        )}
      </div>
      <p className="text-[9px] text-gray-400 mt-1">
        Reference only — the actual price and transaction remain in Naira.
      </p>
    </div>
  );
}
