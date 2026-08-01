"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import ChsLogo from "@/components/ChsLogo";

const ROLE_OPTIONS = [
  { value: "buyer", label: "Buyer" },
  { value: "tenant", label: "Tenant" },
  { value: "owner", label: "Owner" },
  { value: "agent", label: "Agent" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  buyer: "Buyer",
  tenant: "Tenant",
  owner: "Property Owner",
  agent: "Agent",
  manager: "Property Manager",
  admin: "Admin",
};

export default function LoginPage() {
  const router = useRouter();
  const { setActiveRole, refreshProfile } = useAuth();
  const [selectedRole, setSelectedRole] = useState("buyer");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || !pin.trim()) {
      setError("Please enter your phone number and PIN.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const syntheticEmail = "chsuser" + phone.replace(/\D/g, "") + "@chsplatform.app";
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password: pin,
    });

    if (loginError) {
      setError("Phone number or PIN is incorrect.");
      setSubmitting(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, secondary_roles")
      .eq("id", loginData.user.id)
      .single();

    if (profileError || !profile) {
      setError("Login succeeded but your profile could not be loaded. Please contact CHS support.");
      setSubmitting(false);
      return;
    }

    // The real fix already proven in the original app: confirm the
    // credentials genuinely belong to an account holding the SELECTED
    // role, not just any account with that phone/PIN — including
    // correctly supporting someone with more than one linked role.
    const allRoles = [profile.role, ...(profile.secondary_roles || [])];
    if (!allRoles.includes(selectedRole)) {
      const realRoleNames = allRoles.map((r) => ROLE_DISPLAY_NAMES[r] || r).join(" or ");
      setError(
        `Your account isn't registered as ${ROLE_DISPLAY_NAMES[selectedRole]} — it's registered as ${realRoleNames}. Please select that role instead.`
      );
      await supabase.auth.signOut(); // don't leave a session sitting around for a role that was never confirmed
      setSubmitting(false);
      return;
    }

    setActiveRole(selectedRole);
    await refreshProfile();

    // The actual bug just found and fixed: every successful login was
    // sending everyone to the plain homepage, regardless of which real
    // role they'd just confirmed — an admin logging in never actually
    // reached /admin at all, which is exactly why it looked like the
    // whole dashboard had vanished. Routes to the real, correct
    // dashboard for each role now.
    const roleToPath: Record<string, string> = {
      admin: "/admin",
      owner: "/owner",
      agent: "/agent",
      manager: "/manager",
      tenant: "/tenant",
      buyer: "/",
    };
    router.push(roleToPath[selectedRole] || "/");
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* The real, complete CHS logo — the same one used on the
            splash screen, built exactly to the full design
            specification, giving this page real, professional
            presence rather than a plain text heading. */}
        <div className="flex justify-center mb-6">
          <ChsLogo width={160} />
        </div>

        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1 text-center">Welcome back</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">Log in to your CHS account</p>

        <p className="text-xs font-semibold text-chs-charcoal mb-2">Log in as</p>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelectedRole(opt.value)}
              className={`text-xs font-semibold py-2.5 rounded-lg border-2 transition-colors ${
                selectedRole === opt.value
                  ? "border-chs-red bg-chs-amber-light text-chs-charcoal"
                  : "border-gray-200 bg-white text-gray-500"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
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
            <label className="text-xs font-semibold text-gray-600">PIN (6 digits)</label>
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

          {error && (
            <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          New to CHS?{" "}
          <Link href="/register" className="text-chs-red font-semibold">Create an account</Link>
        </p>

        <p className="text-xs text-gray-400 text-center mt-3">
          Need a role added to your existing account?{" "}
          <Link href="/link-account" className="text-chs-red font-semibold">Link it here</Link>
        </p>
      </div>
    </div>
  );
}
