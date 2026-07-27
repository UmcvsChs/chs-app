"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const NIGERIAN_STATES = ["Kaduna", "Abuja (FCT)", "Kano", "Lagos"];
type SimpleRole = "buyer" | "tenant" | "owner";

const ROLE_OPTIONS: { value: SimpleRole; label: string; desc: string }[] = [
  { value: "buyer", label: "Buyer", desc: "Searching to purchase, rent, lease or hire a property" },
  { value: "tenant", label: "Tenant", desc: "Already renting, or about to start renting, through CHS" },
  { value: "owner", label: "Property Owner", desc: "Listing a property to sell, rent, lease, or hire out" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<SimpleRole>("buyer");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nin, setNin] = useState("");
  const [state, setState] = useState("Kaduna");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deliberately matches the same real validation rules already tested
  // in the original app — an 11-digit NIN, a 6-digit PIN, confirmed
  // twice — rather than inventing different rules for this rebuild.
  function validate(): string | null {
    if (!name.trim() || !phone.trim()) return "Please enter your full name and phone number.";
    if (!/^\d{11}$/.test(nin.trim())) return "Please enter a valid 11-digit NIN.";
    if (!/^\d{6}$/.test(pin)) return "Please create a 6-digit PIN (numbers only).";
    if (pin !== pinConfirm) return "Your PIN and confirmation don't match.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      // Calls the exact same real, already-tested register-user Edge
      // Function the original app uses — this endpoint already handles
      // NIN duplicate-checking, account creation, and profile setup
      // correctly, so this rebuild reuses it rather than rebuilding
      // that same logic a second time.
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/register-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            pin,
            nin: nin.trim(),
            email: email.trim() || null,
            state,
            role,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok || result.error) {
        setError(result.error || "Registration failed. Please try again.");
        setSubmitting(false);
        return;
      }

      // Signs the newly-created account in immediately, matching the
      // original app's behaviour — no need to make someone log in again
      // right after they just registered.
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: result.email,
        password: pin,
      });

      if (loginError) {
        setError("Account created, but automatic sign-in failed. Please log in manually.");
        setSubmitting(false);
        return;
      }

      router.push("/");
    } catch {
      setError("Could not reach CHS servers. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">Join CHS</h1>
        <p className="text-sm text-gray-500 mb-6">Complete Housing Solutions — register your account</p>

        <div className="mb-5">
          <p className="text-xs font-semibold text-chs-charcoal mb-2">I am registering as a:</p>
          <div className="grid grid-cols-1 gap-2">
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                className={`text-left p-3 rounded-xl border-2 transition-colors ${
                  role === opt.value
                    ? "border-chs-red bg-chs-amber-light"
                    : "border-gray-200 bg-white"
                }`}
              >
                <p className="text-sm font-semibold text-chs-charcoal">{opt.label}</p>
                <p className="text-xs text-gray-500">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full legal name"
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08XXXXXXXXX"
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Email address (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">
              National Identification Number (NIN)
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={11}
              value={nin}
              onChange={(e) => setNin(e.target.value.replace(/\D/g, ""))}
              placeholder="11-digit NIN"
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">State</label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white"
            >
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Create PIN (6 digits)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="●●●●●●"
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Confirm PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
              placeholder="●●●●●●"
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
            />
          </div>

          {error && (
            <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? "Creating your account..." : "Create my CHS account"}
          </button>
        </form>
      </div>
    </div>
  );
}
