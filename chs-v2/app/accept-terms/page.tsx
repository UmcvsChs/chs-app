"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import TermsContent from "@/components/TermsContent";

// The real, legally-meaningful gate: the checkbox only becomes
// clickable once the person has genuinely scrolled to the bottom of
// the actual terms — not a blind checkbox sitting there from the
// start. This is the well-established, defensible pattern for real
// assent, applied per direct instruction after a professional
// discussion on scope (this gates Terms specifically; the Users Guide
// is a separate, role-specific first-dashboard prompt, not a hard
// gate here — see GuidePrompt.tsx).
function AcceptTermsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, profile, loading: authLoading, refreshProfile } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    // Already accepted — nothing to do here, send them straight on.
    if (profile?.terms_accepted_at) {
      router.push(redirectTo);
    }
  }, [authLoading, session, profile, router, redirectTo]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    // A small tolerance (20px) — real devices rarely hit the exact
    // pixel-perfect bottom, and requiring that would make this
    // unintentionally impossible to satisfy on some screens.
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 20) {
      setHasScrolledToBottom(true);
    }
  }

  async function handleAccept() {
    setSubmitting(true);
    const { error } = await supabase.rpc("accept_terms");
    setSubmitting(false);
    if (!error) {
      await refreshProfile();
      router.push(redirectTo);
    }
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen zone-buyer bg-[var(--zone-bg)] px-4 py-8 flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col flex-1">
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">📜 Terms & Conditions</h1>
        <p className="text-xs text-gray-400 mb-4">
          Please read through before continuing — scroll to the bottom to unlock the checkbox below.
        </p>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto bg-white rounded-xl border-2 border-gray-200 p-4 mb-4"
          style={{ maxHeight: "55vh" }}
        >
          <TermsContent />
        </div>

        <label className={`flex items-start gap-2 text-xs mb-3 ${hasScrolledToBottom ? "text-gray-600" : "text-gray-300"}`}>
          <input
            type="checkbox"
            checked={checked}
            disabled={!hasScrolledToBottom}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          I have read and accept the CHS Terms &amp; Conditions.
        </label>
        {!hasScrolledToBottom && (
          <p className="text-[10px] text-gray-400 mb-3">Scroll to the bottom of the terms above to continue.</p>
        )}

        <button
          onClick={handleAccept}
          disabled={!checked || submitting}
          className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-40"
        >
          {submitting ? "Continuing..." : "Accept & Continue"}
        </button>
      </div>
    </div>
  );
}

export default function AcceptTermsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--zone-bg)]" />}>
      <AcceptTermsContent />
    </Suspense>
  );
}
