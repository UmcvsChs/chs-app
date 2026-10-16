"use client";

import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

// Money never moves on a single tap. The first tap only opens "Please confirm your payment", showing exactly what
// will be taken from the wallet. When the admin switch "payment PIN required" is on, the buyer also types their 6-digit
// transaction PIN here; the server checks it and gives a 2-minute, single-use approval that the payment function
// demands (so the rule cannot be bypassed from the screen). The "Yes, pay" button stays off for a moment after it
// appears, so a stray or double tap on a phone cannot confirm it.
type PinStatus = { required: boolean; has_pin: boolean };

export default function ConfirmPay({ label, amountText, whatFor, onConfirm, busy = false, disabled = false, className = "", confirmLabel }: {
  label: ReactNode; amountText: string; whatFor: string; onConfirm: () => void | Promise<void>;
  busy?: boolean; disabled?: boolean; className?: string; confirmLabel?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<PinStatus | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!asking) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(false); setErr(null); setPin(""); setPin2("");
    const t = setTimeout(() => setReady(true), 1200);
    supabase.rpc("payment_pin_status").then(({ data }) => setStatus((data as PinStatus) || { required: false, has_pin: true }));
    return () => clearTimeout(t);
  }, [asking]);

  if (!asking) {
    return <button type="button" disabled={disabled || busy} onClick={() => setAsking(true)} className={className}>{label}</button>;
  }

  const needPin = !!status?.required;
  const needSetup = needPin && !status?.has_pin;
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  async function confirm() {
    setErr(null);
    if (needPin) {
      if (pin.length !== 6) { setErr("Please enter your 6-digit transaction PIN."); return; }
      setWorking(true);
      if (needSetup) {
        if (pin !== pin2) { setWorking(false); setErr("The two PINs do not match."); return; }
        const { data, error } = await supabase.rpc("set_transaction_pin", { p_pin: pin, p_current_pin: null });
        if (error || (data && (data as { ok?: boolean }).ok === false)) { setWorking(false); setErr(error?.message || (data as { error?: string }).error || "Could not set your PIN."); return; }
      }
      const { data: a, error: ae } = await supabase.rpc("authorize_payment", { p_pin: pin });
      setWorking(false);
      if (ae) { setErr(ae.message); return; }
      if (!(a as { ok?: boolean })?.ok) { setErr((a as { error?: string })?.error || "That PIN was not accepted."); setPin(""); return; }
    }
    setAsking(false); setPin(""); setPin2("");
    await onConfirm();
  }

  return (
    <div className="w-full mt-1.5 rounded-xl border-2 border-chs-red bg-white p-3" role="alertdialog" aria-label="Confirm payment">
      <p className="text-xs font-bold text-chs-charcoal">Please confirm your payment</p>
      <p className="text-[11px] text-gray-700 mt-1">
        <b>{amountText}</b> will be taken from your CHS wallet {whatFor}. Nothing is charged until you tap “Yes, pay”.
      </p>
      {status === null && <p className="text-[10px] text-gray-400 mt-1">Checking…</p>}
      {needPin && (
        <div className="mt-2 space-y-1.5">
          <p className="text-[11px] font-semibold text-chs-charcoal">{needSetup ? "First, create your 6-digit transaction PIN. You will use it to approve every payment." : "Enter your 6-digit transaction PIN"}</p>
          <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(digits(e.target.value))} placeholder="••••••"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-center tracking-[0.5em] text-base" aria-label="Transaction PIN" />
          {needSetup && <input type="password" inputMode="numeric" autoComplete="off" value={pin2} onChange={(e) => setPin2(digits(e.target.value))} placeholder="Repeat the PIN"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-center tracking-[0.5em] text-base" aria-label="Repeat PIN" />}
        </div>
      )}
      {err && <p className="text-[11px] text-chs-red mt-1.5">{err}</p>}
      <div className="flex gap-2 mt-2">
        <button type="button" onClick={() => setAsking(false)} className="flex-1 py-2 rounded-full border border-gray-300 text-gray-700 text-xs font-semibold">Not now</button>
        <button type="button" disabled={!ready || busy || working || disabled || status === null}
          onClick={confirm}
          className="flex-1 py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-40">
          {!ready ? "Wait…" : working ? "Checking…" : (confirmLabel || `Yes, pay ${amountText}`)}
        </button>
      </div>
    </div>
  );
}
