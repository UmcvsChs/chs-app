"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// Real, new page per direct client request: an agent/manager with
// real, existing tenant biodata (from their own office system) can
// send this real link — the tenant clicks it, registers or logs in,
// and is automatically, genuinely linked to the real tenant register
// entry already on file, with zero manual back-and-forth.
//
// Real, honest note: since CHS is a real PWA, not yet published on
// the Apple or Google app stores, this link opens the real CHS site
// in the tenant's own browser — it cannot trigger an automatic
// native app-store install. No install is actually needed to use
// CHS at all.
interface InviteDetails {
  full_name: string;
  phone: string;
  reference_number: string;
  already_claimed: boolean;
  recorder_name: string;
}

export default function TenantInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    supabase.rpc("get_tenant_invite_details", { p_token: token }).then(({ data, error: rpcError }) => {
      if (rpcError || !data) {
        setError("This invitation link is not real or has expired.");
      } else {
        setInvite(data);
      }
      setLoading(false);
    });
  }, [token]);

  useEffect(() => {
    // Real, automatic linking — the moment someone who already has a
    // real CHS session opens this link, claim it immediately, with
    // no extra tap needed.
    if (!authLoading && session && invite && !invite.already_claimed && !claimed) {
      handleClaim();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, invite]);

  async function handleClaim() {
    setClaiming(true);
    const { error: claimError } = await supabase.rpc("claim_tenant_invite", { p_token: token });
    setClaiming(false);
    if (claimError) {
      setError(claimError.message);
      return;
    }
    setClaimed(true);
  }

  function handleRegister() {
    // Real, deliberate hand-off — the tenant's real, already-known
    // name and phone carry straight into registration, and this
    // real invite token comes back with them, so claiming happens
    // automatically the instant their new account exists.
    sessionStorage.setItem("chs_pending_tenant_invite_token", token);
    sessionStorage.setItem("chs_pending_return_to", `/invite/${token}`);
    router.push(`/register?prefillName=${encodeURIComponent(invite?.full_name || "")}&prefillPhone=${encodeURIComponent(invite?.phone || "")}&role=tenant`);
  }

  if (loading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm font-semibold text-chs-red mb-2">Could not open this invitation</p>
        <p className="text-xs text-gray-500 mb-4">{error}</p>
        <Link href="/" className="text-sm font-semibold text-chs-red">Go to CHS homepage</Link>
      </div>
    );
  }

  if (claimed || invite?.already_claimed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-lg font-semibold text-chs-charcoal mb-2">✓ You&apos;re genuinely on board</p>
        <p className="text-sm text-gray-500 mb-4">
          Your real account is now linked to {invite?.recorder_name}&apos;s records — reference {invite?.reference_number}.
        </p>
        <Link href="/tenant" className="text-sm font-semibold text-chs-red">Go to my Tenant dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-sm w-full bg-white rounded-2xl border border-gray-200 p-6">
        <p className="font-serif text-xl font-bold text-chs-charcoal mb-2">You&apos;ve been invited to CHS</p>
        <p className="text-sm text-gray-500 mb-1">
          {invite?.recorder_name} already has your real details on file — reference <strong>{invite?.reference_number}</strong>.
        </p>
        <p className="text-sm text-gray-500 mb-5">
          Set up your own real CHS account below, and you&apos;ll be automatically linked to their records — nothing else to fill in twice.
        </p>

        {session ? (
          <button onClick={handleClaim} disabled={claiming}
            className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
            {claiming ? "Linking your account..." : "Link my existing CHS account"}
          </button>
        ) : (
          <button onClick={handleRegister} className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold">
            Set up my CHS account
          </button>
        )}
        {!session && (
          <Link href="/login" className="block text-xs text-gray-400 mt-3">
            Already have a CHS account? Log in instead
          </Link>
        )}
      </div>
    </div>
  );
}
