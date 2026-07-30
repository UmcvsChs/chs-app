"use client";

// A real, working currency input from the start — the original app had
// a genuine, confirmed bug here: an offer amount field that not only
// never showed comma formatting, but whose underlying value would have
// been silently truncated at the first comma if formatting had simply
// been bolted on without also fixing the parsing. Both the display and
// the actual numeric value returned to the parent are handled correctly
// here together, not as two separate, easy-to-desync concerns.

interface CurrencyInputProps {
  value: number | "";
  onChange: (value: number | "") => void;
  placeholder?: string;
}

export default function CurrencyInput({ value, onChange, placeholder }: CurrencyInputProps) {
  const displayValue = value === "" ? "" : value.toLocaleString("en-NG");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digitsOnly = e.target.value.replace(/\D/g, "");
    onChange(digitsOnly === "" ? "" : parseInt(digitsOnly, 10));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
    />
  );
}
