"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Public. Type an agent's CHS agent ID and see whether CHS has approved that agent.
export default function VerifyAgentPage() {
  const router = useRouter();
  const [id, setId] = useState("");
  return (
    <div className="min-h-screen bg-[var(--zone-bg)]">
      <div className="bg-chs-charcoal text-white px-4 py-3"><Link href="/" className="text-sm">← Back</Link></div>
      <div className="px-4 py-6 max-w-md mx-auto">
        <h1 className="font-serif text-xl font-bold text-chs-charcoal mb-1">Is this agent approved by CHS?</h1>
        <p className="text-xs text-gray-600 mb-4">CHS-approved agents have a CHS agent ID like <span className="font-mono">CHS-AGT-20526</span>. Ask the agent for it and type it below. An agent without an ID that checks out is not approved by CHS.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (id.trim()) router.push(`/verify-agent/${encodeURIComponent(id.trim().toUpperCase())}`); }} className="space-y-3">
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="CHS-AGT-20526" maxLength={24} autoCapitalize="characters"
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm font-mono tracking-wide" />
          <button disabled={!id.trim()} className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-bold disabled:opacity-50">Check this agent</button>
        </form>
      </div>
    </div>
  );
}
