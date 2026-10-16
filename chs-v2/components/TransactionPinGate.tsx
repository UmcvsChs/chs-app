"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// Every account sets a transaction PIN as soon as it comes on board (and existing accounts the next time they sign in),
// separate from the login PIN. The server refuses a transaction PIN that equals the login PIN, so someone who learns
// your login PIN still cannot spend your money. Public, sign-in and recovery pages are left alone so nobody is locked out.
const EXEMPT = ["/login", "/register", "/forgot-pin", "/terms", "/privacy", "/accept-terms", "/guarantor-confirm", "/invite", "/link-account", "/about", "/contact", "/faq", "/blog", "/guide", "/receipt", "/verify"];

export default function TransactionPinGate() {
  const { session, signOut } = useAuth();
  const pathname = usePathname() || "/";
  const [needs, setNeeds] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const uid = session?.user.id;

  useEffect(() => {
    if (!uid) { setNeeds(false); return; }
    let alive = true;
    supabase.rpc("payment_pin_status").then(({ data, error }) => {
      if (!alive || error || !data) return;
      setNeeds(!(data as { has_pin?: boolean }).has_pin);
    });
    return () => { alive = false; };
  }, [uid]);

  if (!uid || !needs || EXEMPT.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  async function save() {
    setErr(null);
    if (pin.length !== 6) { setErr("Your transaction PIN must be 6 digits."); return; }
    if (pin !== pin2) { setErr("The two PINs do not match."); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("set_transaction_pin", { p_pin: pin, p_current_pin: null });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if ((data as { ok?: boolean } | null)?.ok === false) { setErr((data as { error?: string }).error || "Could not set your PIN."); return; }
    setDone(true); setPin(""); setPin2("");
    setTimeout(() => setNeeds(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5">
        {done ? (
          <p className="text-sm font-bold text-green-700 text-center py-6">✓ Your transaction PIN is set.</p>
        ) : (
          <>
            <p className="font-serif text-base font-bold text-chs-charcoal">🔐 Set your transaction PIN</p>
            <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
              This 6-digit PIN protects your money: you type it every time you pay from your wallet. It must be <b>different from your login PIN</b>, so that if someone learns your login PIN they still cannot pay with your money. Do not share it with anyone, not even CHS staff.
            </p>
            <label className="text-[11px] font-semibold text-gray-600 mt-3 block">New transaction PIN</label>
            <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(e) => setPin(digits(e.target.value))}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm tracking-[0.4em] text-center" placeholder="••••••" />
            <label className="text-[11px] font-semibold text-gray-600 mt-2 block">Type it again</label>
            <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin2} onChange={(e) => setPin2(digits(e.target.value))}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm tracking-[0.4em] text-center" placeholder="••••••" />
            {err && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2 mt-2">{err}</p>}
            <button type="button" onClick={save} disabled={busy} className="w-full mt-3 py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">{busy ? "Saving…" : "Save my transaction PIN"}</button>
            <button type="button" onClick={() => signOut()} className="w-full mt-2 text-[11px] text-gray-400 underline">Sign out</button>
          </>
        )}
      </div>
    </div>
  );
}
