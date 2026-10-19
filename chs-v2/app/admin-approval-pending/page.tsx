"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// Every staff admin needs a one-time code from the super admin for each login.
// The code is shown only to the super admin, who reads it out. It works once
// and expires after 5 minutes. Three wrong tries lock the account. The
// database enforces all of it: without a valid session no admin power exists.
export default function AdminCodePage() {
  const router = useRouter();
  const { session } = useAuth();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase.rpc("admin_session_status").then(({ data }) => {
      if (data === "active" || data === "super") router.push("/admin");
    });
    supabase.rpc("request_admin_code").then(() => setRequested(true));
  }, [session, router]);

  async function submit() {
    setBusy(true); setMsg("");
    const { data } = await supabase.rpc("admin_enter_code", { p_code: code.trim() });
    setBusy(false);
    if (data === true) { router.push("/admin"); return; }
    setCode("");
    setMsg("Wrong code.");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-chs-charcoal">
      <div className="max-w-sm w-full">
        <p className="text-4xl mb-4">🔐</p>
        <p className="text-lg font-semibold text-white mb-2">Enter your login code</p>
        <p className="text-sm text-white/60 mb-5">
          {requested ? "The super admin has been told you are logging in. " : ""}Ask the super admin for your one-time code. It works once and for 5 minutes.
        </p>
        <input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="6-digit code" className="w-full text-center text-2xl tracking-[0.4em] px-4 py-3 rounded-xl bg-white/10 text-white placeholder-white/30 mb-3" />
        {msg && <p className="text-sm text-red-300 mb-3">{msg}</p>}
        <button onClick={submit} disabled={busy || code.length !== 6} className="w-full py-3 rounded-full bg-chs-red text-white font-semibold disabled:opacity-40">
          {busy ? "Checking..." : "Continue"}
        </button>
        <button onClick={async () => { await supabase.auth.signOut(); router.push("/team-access"); }} className="mt-5 text-xs text-white/50 underline">
          Back to login
        </button>
      </div>
    </div>
  );
}
