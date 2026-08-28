"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ROLE_GUIDES } from "@/types/guideContent";

// The role-specific, first-dashboard-visit guide prompt — the actual
// build of the professional recommendation: not a full-document hard
// gate (that risked becoming theater — people scrolling fast just to
// get through it — and hurting registration completion for content
// that mostly isn't about their own role), but a short, genuinely
// relevant prompt shown once per role, dismissible, with the option to
// read further always available afterward.
export default function GuidePrompt({ role, onDismiss }: { role: string; onDismiss: () => void }) {
  const [dismissing, setDismissing] = useState(false);
  const guide = ROLE_GUIDES[role];
  if (!guide) return null;

  async function handleDismiss() {
    setDismissing(true);
    await supabase.rpc("mark_guide_seen", { p_role: role });
    setDismissing(false);
    onDismiss();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto p-5">
        <p className="font-serif text-xl font-bold text-chs-charcoal mb-1">👋 {guide.title}</p>
        <p className="text-xs text-gray-400 mb-4">
          A quick guide to get you started —{" "}
          <Link href="/guide" className="text-chs-red underline">the full Users Guide</Link> is always available from the More menu.
        </p>
        <div className="space-y-3">
          {guide.sections.map((s) => (
            <div key={s.title}>
              <p className="text-sm font-bold text-chs-charcoal">{s.title}</p>
              <p className="text-xs text-gray-600 mt-0.5">{s.body}</p>
            </div>
          ))}
        </div>
        <button
          onClick={handleDismiss}
          disabled={dismissing}
          className="w-full mt-5 py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50"
        >
          {dismissing ? "..." : "Got it, let's go"}
        </button>
      </div>
    </div>
  );
}
