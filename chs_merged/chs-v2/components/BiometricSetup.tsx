"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { supabase } from "@/lib/supabase";

// Real biometric login setup — uses WebAuthn, the actual standard
// browser API for Face ID, fingerprint, and Windows Hello, the same
// real mechanism used by major real sites for this. No biometric data
// itself is ever sent anywhere, including to CHS — only a real
// cryptographic credential.
export default function BiometricSetup() {
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSetup() {
    setStatus("working");
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const optionsRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/webauthn-register-options`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!optionsRes.ok) throw new Error("Could not start setup");
      const options = await optionsRes.json();

      const attResp = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/webauthn-register-verify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ response: attResp, deviceLabel: navigator.userAgent.includes("iPhone") ? "iPhone" : "This device" }),
      });
      const result = await verifyRes.json();
      if (!result.verified) throw new Error("Verification failed");

      setStatus("done");
    } catch {
      setStatus("error");
      setError("Could not set up biometric login on this device. Your device may not support it, or you cancelled the prompt.");
    }
  }

  if (status === "done") {
    return <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2.5 text-center">✓ Biometric login is now set up on this device</p>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3">
      <p className="text-xs font-bold text-chs-charcoal mb-1">🔐 Biometric login</p>
      <p className="text-[10px] text-gray-500 mb-2">Use Face ID, fingerprint, or your device's own screen lock to log in faster, without your PIN.</p>
      {error && <p className="text-[10px] text-chs-red mb-2">{error}</p>}
      <button onClick={handleSetup} disabled={status === "working"}
        className="w-full py-2.5 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
        {status === "working" ? "Setting up..." : "Set up on this device"}
      </button>
    </div>
  );
}
