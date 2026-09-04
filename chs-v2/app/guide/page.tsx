"use client";

import { useRouter } from "next/navigation";
import GuideContent from "@/components/GuideContent";

// The real, missing piece — the Users Guide previously only existed as
// a downloadable Word document and a short, one-time popup on first
// dashboard visit, neither of which is a page you can navigate back to
// whenever you want, the way Terms & Conditions is. This closes that
// gap, sitting right next to Terms in the More menu, using the exact
// same real content already written and verified for the Word document.
export default function GuidePage() {
  const router = useRouter();
  return (
    <div className="min-h-screen zone-buyer bg-[var(--zone-bg)] px-4 py-8">
      <div className="max-w-md mx-auto">
        <button onClick={() => router.back()} className="text-xs text-gray-400 mb-4 inline-block">← Back</button>
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">📘 Users Guide</h1>
        <p className="text-xs text-gray-400 mb-6">
          The complete operating manual for every role on CHS — Buyer, Tenant, Owner, Agent, Property Manager,
          Developer, Vendor, and Artisan.
        </p>
        <GuideContent />
      </div>
    </div>
  );
}
