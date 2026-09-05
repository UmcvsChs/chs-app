"use client";

import { useState } from "react";
import { getFreshDocumentUrl } from "@/lib/storage";

// Real, new component fixing a genuine, confirmed bug — a stored
// document link going nowhere with a real 403. Generates a fresh,
// live signed URL at the exact moment someone clicks, using their
// own real, authenticated session, rather than trusting a URL that
// was signed once and stored permanently.
export default function DocumentViewLink({ url, label }: { url: string; label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick() {
    setLoading(true);
    setError(false);
    const freshUrl = await getFreshDocumentUrl(url);
    setLoading(false);
    if (!freshUrl) {
      setError(true);
      return;
    }
    window.open(freshUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="inline-block">
      <button onClick={handleClick} disabled={loading} className="text-[10px] text-chs-red underline disabled:opacity-50">
        {loading ? "Opening real document..." : label}
      </button>
      {error && <p className="text-[9px] text-chs-red mt-0.5">Could not open this real document — it may have been removed.</p>}
    </div>
  );
}
