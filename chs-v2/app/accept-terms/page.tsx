"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import TermsContent from "@/components/TermsContent";
import { CURRENT_TERMS_VERSION, TERMS_UPDATED_LABEL, TERMS_WHATS_NEW, termsAcceptanceRequired } from "@/lib/termsVersion";

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Only ever send the person on to a page inside CHS — never an
  // external address smuggled in through the redirect parameter.
  const rawRedirect = searchParams.get("redirect") || "/";
  const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  // Someone who accepted an earlier version is being asked to accept an
  // update — they should be told what changed, not asked blind.
  const isUpdate = !!profile?.terms_accepted_at;

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    // Already accepted the CURRENT version — nothing to do here. (An
    // older acceptance no longer counts once the Terms have changed.)
    if (profile && !termsAcceptanceRequired(profile)) {
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
    setErrorMessage(null);
    const { error } = await supabase.rpc("accept_terms", { p_version: CURRENT_TERMS_VERSION });
    setSubmitting(false);
    if (error) {
      setErrorMessage(
        error.message.startsWith("terms_version_outdated")
          ? "The Terms & Conditions were updated while this page was open. Please refresh the page, read the latest version, and accept again."
          : "Your acceptance could not be saved just now. Please check your connection and try again."
      );
      return;
    }
    await refreshProfile();
    router.push(redirectTo);
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen zone-buyer bg-[var(--zone-bg)] px-4 py-8 flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col flex-1">
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">📜 Terms & Conditions</h1>
        <p className="text-[10px] text-gray-400 mb-1">Version {CURRENT_TERMS_VERSION} · Updated {TERMS_UPDATED_LABEL}</p>
        {isUpdate ? (
          <div className="bg-amber-50 border border-chs-amber rounded-lg px-3 py-2 mb-3">
            <p className="text-[11px] font-bold text-chs-amber-dark mb-0.5">Our Terms & Conditions have been updated</p>
            <p className="text-[11px] text-gray-700 leading-relaxed">{TERMS_WHATS_NEW} Please read the updated Terms below and accept to continue — you will only be asked once.</p>
          </div>
        ) : (
          <p className="text-xs text-gray-400 mb-4">
            Please read through before continuing — scroll to the bottom to unlock the checkbox below.
          </p>
        )}
        {isUpdate && !hasScrolledToBottom && (
          <p className="text-[10px] text-gray-400 mb-2">Scroll to the bottom to unlock the checkbox below. Term 36 is the last one.</p>
        )}

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
          I have read and accept the CHS Terms &amp; Conditions and the{" "}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline text-chs-red">Privacy Policy</a>.
        </label>
        {!hasScrolledToBottom && (
          <p className="text-[10px] text-gray-400 mb-3">Scroll to the bottom of the terms above to continue.</p>
        )}
        {errorMessage && (
          <p className="text-[11px] text-chs-red bg-chs-amber-light rounded-lg px-3 py-2 mb-3">{errorMessage}</p>
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
