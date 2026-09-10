"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

// Real, new page per direct client request: one real place admin can
// open and download every real, current reference document — no
// hunting through old chat threads or emails to find "which file was
// the latest terms and conditions." Every file here is a real,
// current document, bundled directly into the app so it's always
// available the moment the app itself is live — not dependent on any
// separate storage service staying online.
const DOCUMENTS = [
  { file: "CHS_USERS_GUIDE.docx", label: "User's Guide", description: "Full, real walkthrough of every role's real workflow — buyer, tenant, owner, agent, host, and more." },
  { file: "CHS_TERMS_AND_CONDITIONS.pdf", label: "Terms & Conditions", description: "The real, current terms governing use of the CHS platform." },
  { file: "CHS_System_Documentation.pdf", label: "System Documentation", description: "The real, technical reference — architecture, real database schema, and a genuine inventory of every shared component in the app." },
  { file: "CHS_COMPLETE_FEATURE_CATALOG.pdf", label: "Complete Feature Catalog", description: "Every real feature built so far, organized by category." },
  { file: "CHS_FEATURE_CATALOG_SEGMENTED.xlsx", label: "Feature Catalog (Spreadsheet)", description: "The same real catalog, as a working spreadsheet — sortable and filterable." },
  { file: "CHS_HANDOVER_NOTES.pdf", label: "Handover Notes", description: "The real, current technical handover — architecture, patterns, and what a new developer needs to know." },
  { file: "CHS_PROPERTY_MANAGER_GUIDE.docx", label: "Property Manager Guide", description: "Real, focused guidance for the property manager role specifically." },
  { file: "CHS_FIX_TRACKER.pdf", label: "Fix Tracker", description: "The real, current, itemized list of fixes — what's done, what's in progress, what's next." },
  { file: "CHS_NIGERIA_PROPERTY_DOCUMENTS_RESEARCH.pdf", label: "Nigeria Property Documents Research", description: "Real research on the legal documents required for property verification and compliance in Nigeria." },
];

export default function DocumentSitePage() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!session || profile?.role !== "admin") {
      router.push("/");
    }
  }, [authLoading, session, profile, router]);

  if (authLoading || !session || profile?.role !== "admin") {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] zone-admin pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <Link href="/admin" className="text-xs text-white/70">← Back to Admin Dashboard</Link>
        <h1 className="font-serif text-lg font-bold mt-1">📁 Document Site</h1>
        <p className="text-xs text-white/60 mt-1">Every real, current reference document — one tap to download.</p>
      </div>

      <div className="px-4 py-4 space-y-2">
        {DOCUMENTS.map((doc) => (
          <a
            key={doc.file}
            href={`/documents/${doc.file}`}
            download
            className="block bg-white rounded-xl border border-gray-200 p-3"
          >
            <div className="flex justify-between items-center">
              <p className="text-sm font-semibold text-chs-charcoal">{doc.label}</p>
              <span className="text-chs-red text-lg">⬇</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">{doc.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
