"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import ChsLogo from "@/components/ChsLogo";

// The only login for CHS staff and admins. Customers use /login and never see
// this. Any account that is not an admin gets the same message as a wrong PIN.
export default function TeamAccessPage() {
  const router = useRouter();
  const { setActiveRole, refreshProfile } = useAuth();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || !pin.trim()) { setError("Please enter your phone number and PIN."); return; }
    setError(null); setSubmitting(true);
    const fail = async () => { await supabase.auth.signOut(); setError("Phone number or PIN is incorrect."); setSubmitting(false); };

    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: "chsuser" + phone.replace(/\D/g, "") + "@chsplatform.app",
      password: pin,
    });
    if (loginError || !loginData.user) { await fail(); return; }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", loginData.user.id).single();
    if (profile?.role !== "admin") { await fail(); return; }

    setActiveRole("admin");
    await refreshProfile();
    const { data: result, error: reqError } = await supabase.rpc("request_admin_login");
    if (reqError) { await fail(); return; }
    router.push(result === "super_admin" ? "/admin" : "/admin-approval-pending");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-chs-charcoal">
      <div className="max-w-sm w-full">
        <div className="flex justify-center mb-6"><ChsLogo width={130} /></div>
        <p className="text-center text-white font-serif text-xl font-bold mb-1">CHS Team</p>
        <p className="text-center text-xs text-white/50 mb-6">Authorised staff only</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number" className="w-full px-3 py-3 rounded-lg bg-white/10 text-white placeholder-white/40 text-sm" />
          <input type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="PIN"
            className="w-full px-3 py-3 rounded-lg bg-white/10 text-white placeholder-white/40 text-sm" />
          {error && <p className="text-xs text-red-300">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
            {submitting ? "Please wait..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
