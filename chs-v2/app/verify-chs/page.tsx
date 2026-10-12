"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Public. Type the CHS tag from a signboard, flyer, WhatsApp forward or listing, and see whether CHS really issued it.
export default function VerifyChsPage() {
  const router = useRouter();
  const [tag, setTag] = useState("");
  return (
    <div className="min-h-screen bg-[var(--zone-bg)]">
      <div className="bg-chs-charcoal text-white px-4 py-3"><Link href="/" className="text-sm">← Back</Link></div>
      <div className="px-4 py-6 max-w-md mx-auto">
        <h1 className="font-serif text-xl font-bold text-chs-charcoal mb-1">Is this really a CHS property?</h1>
        <p className="text-xs text-gray-600 mb-4">Every property CHS manages or advertises has a CHS tag, like <span className="font-mono">CHS-100002-3</span>. Anyone can copy a badge picture. Nobody can fake a tag that CHS has not issued. Type the tag below to check.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (tag.trim()) router.push(`/verify-chs/${encodeURIComponent(tag.trim().toUpperCase())}`); }} className="space-y-3">
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="CHS-100002-3" maxLength={20} autoCapitalize="characters"
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm font-mono tracking-wide" />
          <button disabled={!tag.trim()} className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-bold disabled:opacity-50">Check this tag</button>
        </form>
        <p className="text-[11px] text-gray-500 mt-4">Dealing with an agent? <Link href="/verify-agent" className="underline">Check whether CHS approved them</Link>.</p>
        <p className="text-[11px] text-gray-500 mt-2">No tag on the advert? Then it is not a CHS-managed property, whatever the picture says. See <Link href="/chs-managed" className="underline">what &quot;Managed by CHS&quot; means</Link>.</p>
      </div>
    </div>
  );
}
