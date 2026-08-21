"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// The real waiting screen a sub-admin sees after a correct password —
// their session exists, but genuinely can't be used for anything
// admin-scoped until a super admin approves this specific login. See
// backend-v2/50_wallet_fixes_and_admin_approval.sql for the real
// enforcement (has_approved_admin_login).
function AdminApprovalPendingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const code = searchParams.get("code") || "";

  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "expired">("pending");

  useEffect(() => {
    if (!session) return;

    const interval = setInterval(async () => {
      const { data: latestRequest } = await supabase
        .from("admin_login_requests")
        .select("status, expires_at")
        .eq("admin_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestRequest) return;

      if (latestRequest.status === "approved") {
        setStatus("approved");
        clearInterval(interval);
        setTimeout(() => router.push("/admin"), 1200);
      } else if (latestRequest.status === "rejected") {
        setStatus("rejected");
        clearInterval(interval);
      } else if (new Date(latestRequest.expires_at) < new Date()) {
        setStatus("expired");
        clearInterval(interval);
      }
    }, 3000); // real polling, every 3 seconds — no websocket needed for this

    return () => clearInterval(interval);
  }, [session, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-chs-charcoal">
      <div className="max-w-sm">
        {status === "pending" && (
          <>
            <p className="text-4xl mb-4">🔐</p>
            <p className="text-lg font-semibold text-white mb-2">Waiting for approval</p>
            <p className="text-sm text-white/60 mb-6">
              A super admin has been notified of your login attempt and needs to approve it before you can continue.
            </p>
            {code && (
              <div className="bg-white/10 rounded-xl px-6 py-4">
                <p className="text-[10px] text-white/50 uppercase mb-1">Your code</p>
                <p className="text-3xl font-bold text-white tracking-widest">{code}</p>
                <p className="text-[10px] text-white/40 mt-2">
                  If asked, read this code to the super admin to confirm it&apos;s really you.
                </p>
              </div>
            )}
          </>
        )}
        {status === "approved" && (
          <>
            <p className="text-4xl mb-4">✓</p>
            <p className="text-lg font-semibold text-white mb-2">Approved — taking you in...</p>
          </>
        )}
        {status === "rejected" && (
          <>
            <p className="text-4xl mb-4">✕</p>
            <p className="text-lg font-semibold text-white mb-2">Login rejected</p>
            <p className="text-sm text-white/60 mb-6">A super admin rejected this login attempt.</p>
            <button onClick={() => { supabase.auth.signOut(); router.push("/login"); }}
              className="text-sm font-semibold text-white underline">
              Back to login
            </button>
          </>
        )}
        {status === "expired" && (
          <>
            <p className="text-4xl mb-4">⏱</p>
            <p className="text-lg font-semibold text-white mb-2">This request expired</p>
            <p className="text-sm text-white/60 mb-6">Please try logging in again.</p>
            <button onClick={() => { supabase.auth.signOut(); router.push("/login"); }}
              className="text-sm font-semibold text-white underline">
              Back to login
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary for Next.js to
// prerender this route — this is the real, standard fix, not a
// workaround.
export default function AdminApprovalPendingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-chs-charcoal" />}>
      <AdminApprovalPendingContent />
    </Suspense>
  );
}
