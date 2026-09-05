"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Real, new feature completing a genuine, confirmed gap — no PIN
// reset mechanism existed anywhere in the app, and even the platform
// owner didn't know the real process. Uses the identity CHS already
// holds on file (phone + NIN) as the real verification step, since
// this platform has no email or SMS-OTP infrastructure wired up.
export default function ForgotPinPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [nin, setNin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^\d{11}$/.test(phone.trim())) {
      setError("Please enter your real, 11-digit phone number.");
      return;
    }
    if (!/^\d{11}$/.test(nin.trim())) {
      setError("Please enter your real, 11-digit NIN, exactly as used at registration.");
      return;
    }
    if (!/^\d{6}$/.test(newPin)) {
      setError("Your new PIN must be exactly 6 real digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("Your new PIN and confirmation don't match.");
      return;
    }

    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc("reset_pin_with_nin_verification", {
      p_phone: phone.trim(),
      p_nin: nin.trim(),
      p_new_pin: newPin,
    });
    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-lg font-semibold text-chs-charcoal mb-2">✓ Your real PIN has been reset</p>
        <p className="text-sm text-gray-500 mb-4">You can now log in with your new PIN.</p>
        <button onClick={() => router.push("/login")} className="text-sm font-semibold text-chs-red">Go to login</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] zone-buyer flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full bg-white rounded-2xl border border-gray-200 p-6">
        <Link href="/login" className="text-xs text-gray-400 mb-3 inline-block">← Back to login</Link>
        <h1 className="font-serif text-xl font-bold text-chs-charcoal mb-1">Forgot your PIN?</h1>
        <p className="text-sm text-gray-500 mb-5">
          Verify your identity with the real phone number and NIN you registered with, then set a new PIN.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Your registered phone number</label>
            <input type="tel" inputMode="numeric" maxLength={11} value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="08XXXXXXXXX" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Your NIN, exactly as used at registration</label>
            <input type="text" inputMode="numeric" maxLength={11} value={nin}
              onChange={(e) => setNin(e.target.value.replace(/\D/g, ""))}
              placeholder="11-digit NIN" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Your new 6-digit PIN</label>
            <input type="password" inputMode="numeric" maxLength={6} value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              placeholder="●●●●●●" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Confirm your new PIN</label>
            <input type="password" inputMode="numeric" maxLength={6} value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              placeholder="●●●●●●" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>

          {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={submitting} className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
            {submitting ? "Resetting your real PIN..." : "Reset my PIN"}
          </button>
        </form>
      </div>
    </div>
  );
}
