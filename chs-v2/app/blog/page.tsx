"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ARTICLES } from "@/types/blogArticles";

export default function BlogPage() {
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    // Genuinely external-system sync — restoring which article was open
    // from the real browser URL hash on load, so a shared link opens
    // directly to the right article. No pure alternative exists here.
    const hash = window.location.hash.replace("#", "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hash && ARTICLES.some((a) => a.key === hash)) setOpenKey(hash);
  }, []);

  const openArticle = ARTICLES.find((a) => a.key === openKey);

  return (
    <div className="min-h-screen zone-buyer bg-[var(--zone-bg)] px-4 py-8">
      <div className="max-w-md mx-auto">
        <Link href="/" className="text-xs text-gray-400 mb-4 inline-block">← Back to homepage</Link>
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-6">CHS Insights</h1>

        {!openArticle ? (
          <div className="space-y-2">
            {ARTICLES.map((a) => (
              <button
                key={a.key}
                onClick={() => setOpenKey(a.key)}
                className="w-full text-left bg-[var(--zone-card)] rounded-xl p-4 flex items-center gap-3"
              >
                <span className="text-2xl">{a.icon}</span>
                <span className="text-sm font-semibold text-chs-charcoal">{a.title}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-[var(--zone-card)] rounded-xl p-5">
            <button onClick={() => setOpenKey(null)} className="text-xs text-gray-400 mb-3">← All articles</button>
            <p className="text-4xl mb-2">{openArticle.icon}</p>
            <h2 className="font-serif text-xl font-bold text-chs-charcoal mb-1">{openArticle.title}</h2>
            <p className="text-[10px] text-gray-400 mb-4">CHS Insights</p>
            <div className="space-y-3">
              {openArticle.body.map((p, i) => (
                <p key={i} className="text-sm text-gray-600 leading-relaxed">{p}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
