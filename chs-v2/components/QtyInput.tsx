"use client";

import { useEffect, useRef, useState } from "react";

// A quantity box that can be typed into: tap or highlight the number, type 200, done. The - and + buttons beside
// it still work for small changes. The box may be empty while typing; it goes back to the last good number if left empty.
export default function QtyInput({ value, max = 1000, onChange, size = "md" }: { value: number; max?: number; onChange: (n: number) => void; size?: "sm" | "md" }) {
  const [txt, setTxt] = useState(String(value));
  const focused = useRef(false);
  // While the person is typing, never overwrite the box: a slow price refresh must not undo their typing.
  useEffect(() => { if (!focused.current) setTxt(String(value)); }, [value]);
  const cls = size === "sm" ? "w-14 h-6 text-xs" : "w-16 h-8 text-sm";
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label="Quantity"
      value={txt}
      onFocus={(e) => { focused.current = true; e.currentTarget.select(); }}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
        if (digits === "") { setTxt(""); return; }
        const n = Math.min(Math.max(parseInt(digits, 10), 1), max);
        setTxt(String(n));
        if (n !== value) onChange(n);
      }}
      onBlur={() => { focused.current = false; setTxt(txt === "" ? String(value) : String(Math.min(Math.max(parseInt(txt, 10) || 1, 1), max))); }}
      className={`${cls} text-center font-bold border border-gray-300 rounded-md bg-white`}
    />
  );
}
