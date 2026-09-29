"use client";

import { useRouter } from "next/navigation";
import PrivacyContent from "@/components/PrivacyContent";

export default function PrivacyPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen zone-buyer bg-[var(--zone-bg)] px-4 py-8">
      <div className="max-w-md mx-auto">
        <button onClick={() => router.back()} className="text-xs text-gray-400 mb-4 inline-block">← Back</button>
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">🔒 Privacy Policy</h1>
        <p className="text-xs text-gray-400 mb-6">What CHS collects, and how it&apos;s used</p>
        <PrivacyContent />
      </div>
    </div>
  );
}
