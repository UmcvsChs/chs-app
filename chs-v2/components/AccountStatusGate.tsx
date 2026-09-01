"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// Real, serious gap found through direct client question: a
// "suspended" status already existed in the database, but nothing
// anywhere actually blocked a suspended account from using the app
// normally. This is the real, global enforcement point — wrapping
// every real page, not just one.
export default function AccountStatusGate({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const [appealText, setAppealText] = useState("");
  const [appealSubmitted, setAppealSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  if (!profile || (profile.status !== "suspended" && profile.status !== "deactivated")) {
    return <>{children}</>;
  }

  async function handleSubmitAppeal() {
    if (!appealText.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_account_appeal", { p_message: appealText.trim() });
    setSubmitting(false);
    if (!error) setAppealSubmitted(true);
  }

  async function handleReactivate() {
    setReactivating(true);
    await supabase.rpc("reactivate_my_account");
    window.location.reload();
  }

  if (profile.status === "deactivated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--zone-bg)] px-6">
        <div className="max-w-sm w-full bg-white rounded-xl border border-gray-200 p-6 text-center">
          <p className="text-2xl mb-2">💤</p>
          <p className="text-sm font-bold text-chs-charcoal mb-2">Your account is deactivated</p>
          <p className="text-xs text-gray-500 mb-4">You chose to deactivate your CHS account. Reactivate any time — nothing has been deleted.</p>
          <button onClick={handleReactivate} disabled={reactivating}
            className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
            {reactivating ? "Reactivating..." : "Reactivate my account"}
          </button>
          <button onClick={signOut} className="w-full mt-2 text-xs text-gray-400 underline">Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--zone-bg)] px-6">
      <div className="max-w-sm w-full bg-white rounded-xl border-2 border-chs-red p-6">
        <p className="text-2xl mb-2 text-center">⚠️</p>
        <p className="text-sm font-bold text-chs-charcoal mb-2 text-center">Your account has been suspended</p>
        <p className="text-xs text-gray-600 bg-[var(--zone-card)] rounded-lg p-3 mb-4">{profile.suspension_reason}</p>
        {appealSubmitted ? (
          <p className="text-xs text-green-700 font-semibold text-center py-2">✓ Your real appeal has been sent to CHS — you&apos;ll be notified once it&apos;s reviewed.</p>
        ) : (
          <>
            <p className="text-xs font-semibold text-gray-600 mb-1">If you believe this is a mistake, submit a real appeal:</p>
            <textarea rows={4} value={appealText} onChange={(e) => setAppealText(e.target.value)}
              placeholder="Explain why you believe this suspension should be reviewed..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs mb-2" />
            <button onClick={handleSubmitAppeal} disabled={submitting || !appealText.trim()}
              className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
              {submitting ? "Sending..." : "Submit real appeal"}
            </button>
          </>
        )}
        <button onClick={signOut} className="w-full mt-3 text-xs text-gray-400 underline">Sign out</button>
      </div>
    </div>
  );
}
