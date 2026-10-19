"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Admin invite link. Valid for 10 minutes, once, for one phone number only.
// The account must already exist (normal sign-up); accepting upgrades it.
export default function AdminInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { session, loading: authLoading, refreshProfile } = useAuth();
  const [info, setInfo] = useState<{ valid: boolean; staff_role?: string; seconds_left?: number } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.rpc("peek_admin_invite", { p_token: token }).then(({ data }) => setInfo(data as typeof info));
  }, [supabase, token]);

  async function accept() {
    setBusy(true); setError("");
    const { error: e } = await supabase.rpc("redeem_admin_invite", { p_token: token });
    setBusy(false);
    if (e) { setError(e.message); return; }
    await refreshProfile();
    setDone(true);
  }

  const label = info?.staff_role?.replace(/_/g, " ");
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-chs-charcoal">
      <div className="max-w-sm w-full">
        <p className="text-4xl mb-3">✉️</p>
        {info === null || authLoading ? (
          <p className="text-white/60 text-sm">Checking this link...</p>
        ) : !info.valid ? (
          <>
            <p className="text-lg font-semibold text-white mb-2">This link is not valid</p>
            <p className="text-sm text-white/60">It has expired, was already used, or was replaced. Ask the super admin for a new one.</p>
          </>
        ) : done ? (
          <>
            <p className="text-lg font-semibold text-white mb-2">You are now a CHS admin ({label})</p>
            <p className="text-sm text-white/60 mb-4">Log out. From now on, log in only at the CHS Team address you were given. Each login needs a code from the super admin.</p>
            <button onClick={async () => { await supabase.auth.signOut(); router.push("/team-access"); }} className="px-5 py-2 rounded-full bg-white text-chs-charcoal text-sm font-semibold">Go to login</button>
          </>
        ) : !session ? (
          <>
            <p className="text-lg font-semibold text-white mb-2">CHS admin invitation: {label}</p>
            <p className="text-sm text-white/60 mb-4">Log in on the normal CHS login page with your own account (the phone number the invitation was made for), then open this link again. If you do not have an account yet, sign up first, then open this link again. It expires in about {Math.ceil((info.seconds_left ?? 0) / 60)} minutes.</p>
            <button onClick={() => router.push("/team-access")} className="px-5 py-2 rounded-full bg-white text-chs-charcoal text-sm font-semibold mr-2">Log in</button>
            <button onClick={() => router.push("/register")} className="px-5 py-2 rounded-full border border-white/40 text-white text-sm font-semibold">Sign up</button>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-white mb-2">Accept admin role: {label}</p>
            <p className="text-sm text-white/60 mb-4">Only the account with the invited phone number can accept. This link works once and expires in about {Math.ceil((info.seconds_left ?? 0) / 60)} minutes.</p>
            {error && <p className="text-xs text-red-300 mb-3">{error}</p>}
            <button onClick={accept} disabled={busy} className="px-6 py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">{busy ? "Please wait..." : "Accept"}</button>
          </>
        )}
      </div>
    </div>
  );
}
