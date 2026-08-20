"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { supabase } from "@/lib/supabase";

// Real biometric login — verifies a genuine WebAuthn credential
// server-side, and only on real success establishes an actual
// Supabase session, via Supabase's own real, standard magic-link
// token redemption. Never a shortcut around real authentication.
export default function BiometricLogin({ onLoggedIn }: { onLoggedIn: () => void }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!phone.trim()) {
      setError("Please enter your phone number first.");
      return;
    }
    setStatus("working");
    setError(null);
    try {
      const optionsRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/webauthn-auth-options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      if (!optionsRes.ok) {
        const err = await optionsRes.json();
        throw new Error(err.error || "Could not start login");
      }
      const { options, userId } = await optionsRes.json();

      const authResp = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/webauthn-auth-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, response: authResp }),
      });
      const result = await verifyRes.json();
      if (!result.verified) throw new Error("Verification failed");

      const { error: otpError } = await supabase.auth.verifyOtp({ type: "email", token_hash: result.token_hash });
      if (otpError) throw new Error("Could not establish your session");

      onLoggedIn();
      router.push("/");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Biometric login failed. Please use your phone number and PIN instead.");
    }
  }

  return (
    <div className="mb-4">
      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone number, for biometric login" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm mb-2" />
      <button onClick={handleLogin} disabled={status === "working"}
        className="w-full py-3 rounded-full bg-chs-charcoal text-white text-sm font-semibold disabled:opacity-50">
        {status === "working" ? "Verifying..." : "🔐 Log in with Face ID / fingerprint"}
      </button>
      {error && <p className="text-xs text-chs-red mt-2 text-center">{error}</p>}
    </div>
  );
}
