"use client";

import { useRouter } from "next/navigation";
import TermsContent from "@/components/TermsContent";

// Real Terms & Conditions content, restored exactly from the original
// app — the same real commission rates the client explicitly finalised
// (5%/5.5% rental, 6.5%/6% sale), not approximated from memory. The
// actual content now lives in components/TermsContent.tsx, shared with
// the scroll-to-accept gate at /accept-terms, so both stay identical.
export default function TermsPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen zone-buyer bg-[var(--zone-bg)] px-4 py-8">
      <div className="max-w-md mx-auto">
        <button onClick={() => router.back()} className="text-xs text-gray-400 mb-4 inline-block">← Back</button>
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">📜 Terms & Conditions</h1>
        <p className="text-xs text-gray-400 mb-6">Summary of key terms</p>
        <TermsContent />
      </div>
    </div>
  );
}
