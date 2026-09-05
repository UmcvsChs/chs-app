"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { uploadDocument } from "@/lib/storage";
import { validateIdNumberFormat, ID_TYPE_PLACEHOLDERS } from "@/lib/idValidation";

const ID_TYPES = ["National ID (NIN slip)", "Voter's Card", "International Passport", "Driver's Licence"];
const PROFESSIONS = [
  "Estate Surveyor & Valuer", "Property Manager", "Quantity Surveyor",
  "Structural Engineer", "Facility Manager", "Real Estate Consultant", "Other professional",
];
type NewRole = "owner" | "host" | "agent" | "manager" | "tenant";
const ROLE_OPTIONS: { value: NewRole; label: string }[] = [
  { value: "owner", label: "Property Owner" },
  { value: "host", label: "Host (Shortlet/Hotel/Hire)" },
  { value: "tenant", label: "Tenant" },
  { value: "agent", label: "Agent" },
  { value: "manager", label: "Property Manager" },
];

type Step = "lookup" | "confirm" | "pin" | "role_details" | "success";

// The real, complete account-linking flow, restored from the original
// app — lets someone who already has a real CHS account add a genuinely
// new role to it, rather than accidentally creating a second, separate
// account. Uses the same real, already-deployed Edge Functions from
// earlier work (lookup-account-for-linking, add-role-to-account), which
// needed no changes at all — only this real frontend flow was missing.
export default function LinkAccountPage() {
  const [step, setStep] = useState<Step>("lookup");
  const [phone, setPhone] = useState("");
  const [foundAccount, setFoundAccount] = useState<{ id: string; full_name: string; all_roles: string[] } | null>(null);
  const [pin, setPin] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<NewRole>("owner");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Agent-specific
  const [agentType, setAgentType] = useState<"independent" | "chs_official">("independent");
  const [lgas, setLgas] = useState("");
  const [experience, setExperience] = useState("Less than 1 year");
  const [association, setAssociation] = useState("");
  const [membershipId, setMembershipId] = useState("");
  // Shared (agent + manager)
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  // Manager-specific
  const [profession, setProfession] = useState(PROFESSIONS[0]);
  const [regNumber, setRegNumber] = useState("");
  const [operatingStates, setOperatingStates] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/lookup-account-for-linking`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: phone.trim() }) }
    );
    const result = await response.json();
    setSubmitting(false);

    if (!result.found) {
      setError("No CHS account found with that phone number.");
      return;
    }
    setFoundAccount(result);
    setStep("confirm");
  }

  async function handlePinVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Real, critical bug fix — confirmed directly against the real
    // authentication pattern used everywhere else in the app: this
    // was calling Supabase's native phone-based sign-in, but every
    // real account on this platform is actually authenticated by a
    // synthetic email derived from the phone number. Native phone
    // auth was never set up, so this would fail for every single
    // PIN, correct or not — exactly matching a real, repeated client
    // complaint that no PIN ever worked here.
    const syntheticEmail = "chsuser" + phone.replace(/\D/g, "") + "@chsplatform.app";
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password: pin,
    });
    setSubmitting(false);

    if (signInError || !data.session) {
      setError("That PIN doesn't match this account. Please try again.");
      return;
    }
    setAccessToken(data.session.access_token);
    setStep("role_details");
  }

  async function handleSubmitNewRole(e: React.FormEvent) {
    e.preventDefault();
    if (!foundAccount || !accessToken) return;

    if ((newRole === "agent" || newRole === "manager") && (!idType || !idNumber.trim())) {
      setError("Please complete your ID verification details.");
      return;
    }
    if ((newRole === "agent" || newRole === "manager") && idType && !validateIdNumberFormat(idType, idNumber)) {
      setError("Please enter a valid ID number for the selected ID type.");
      return;
    }

    setError(null);
    setSubmitting(true);

    let validIdDocumentUrl: string | null = null;
    if (idFile) validIdDocumentUrl = await uploadDocument(idFile, foundAccount.id, "linked-role-id");
    let certificateDocumentUrl: string | null = null;
    if (certFile) certificateDocumentUrl = await uploadDocument(certFile, foundAccount.id, "linked-role-cert");

    const body: Record<string, unknown> = {
      existingProfileId: foundAccount.id,
      newRole,
    };
    if (newRole === "agent") {
      body.agentType = agentType;
      body.associationName = association.trim() || null;
      body.membershipId = membershipId.trim() || null;
      body.operatingLgas = lgas.trim() || null;
      body.yearsExperience = experience;
      body.validIdType = idType;
      body.validIdNumber = idNumber.trim();
      body.validIdDocumentUrl = validIdDocumentUrl;
    } else if (newRole === "manager") {
      body.profession = profession;
      body.professionalRegistrationNumber = regNumber.trim() || null;
      body.operatingStates = operatingStates.trim() || null;
      body.certificateDocumentUrl = certificateDocumentUrl;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/add-role-to-account`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      }
    );
    const result = await response.json();
    setSubmitting(false);

    if (!result.success) {
      setError(result.error || "Could not add this role. Please try again.");
      return;
    }
    setStep("success");
  }

  if (step === "success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-lg font-semibold text-chs-charcoal mb-2">✓ Role added to your account</p>
        <p className="text-sm text-gray-500 mb-4">
          {newRole === "agent" || newRole === "manager"
            ? "CHS will review your credentials before this role is fully active."
            : "You can now log in and select this role."}
        </p>
        <Link href="/login" className="text-sm font-semibold text-chs-red">Go to login</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* Real, critical fix — confirmed directly: this page had no
            real way out at all. Someone stuck here had to force-close
            the entire app, exactly as reported. A real step-back
            action now exists at every stage, plus a genuine exit. */}
        <div className="flex justify-between items-center mb-4">
          {step !== "lookup" ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                if (step === "confirm") setStep("lookup");
                else if (step === "pin") setStep("confirm");
                else if (step === "role_details") setStep("pin");
              }}
              className="text-xs text-gray-400"
            >
              ← Back
            </button>
          ) : <span />}
          <Link href="/login" className="text-xs text-gray-400">✕ Cancel</Link>
        </div>
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">Link a new role to your account</h1>
        <p className="text-sm text-gray-500 mb-6">
          Already have a CHS account? Add another role to it instead of creating a new one.
        </p>

        {step === "lookup" && (
          <form onSubmit={handleLookup} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">Your registered phone number</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="080XXXXXXXX" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
            </div>
            {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={submitting}
              className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
              {submitting ? "Looking up..." : "Find my account"}
            </button>
          </form>
        )}

        {step === "confirm" && foundAccount && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-sm font-semibold text-chs-charcoal">{foundAccount.full_name}</p>
              <p className="text-xs text-gray-500 mt-1">Current roles: {foundAccount.all_roles.join(", ")}</p>
            </div>
            <p className="text-xs text-gray-500">Is this your account?</p>
            <div className="flex gap-2">
              <button onClick={() => { setStep("lookup"); setFoundAccount(null); }}
                className="flex-1 py-2.5 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold">
                No, go back
              </button>
              <button onClick={() => setStep("pin")}
                className="flex-1 py-2.5 rounded-full bg-chs-red text-white text-xs font-semibold">
                Yes, this is me
              </button>
            </div>
          </div>
        )}

        {step === "pin" && (
          <form onSubmit={handlePinVerify} className="space-y-3">
            <p className="text-xs text-gray-500">Enter your PIN to confirm this is genuinely your account.</p>
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)}
              placeholder="Your PIN" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
            {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={submitting}
              className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
              {submitting ? "Verifying..." : "Verify"}
            </button>
          </form>
        )}

        {step === "role_details" && (
          <form onSubmit={handleSubmitNewRole} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">New role to add</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as NewRole)}
                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                {ROLE_OPTIONS.filter((r) => !foundAccount?.all_roles.includes(r.value)).map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {newRole === "agent" && (
              <>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Agent type</label>
                  <select value={agentType} onChange={(e) => setAgentType(e.target.value as typeof agentType)}
                    className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                    <option value="independent">Independent</option>
                    <option value="chs_official">CHS Official</option>
                  </select>
                </div>
                <input type="text" value={lgas} onChange={(e) => setLgas(e.target.value)}
                  placeholder="Operating LGAs" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                <div>
                  <label className="text-xs font-semibold text-gray-600">Years of real estate experience</label>
                  <select value={experience} onChange={(e) => setExperience(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                    {["Less than 1 year", "1–3 years", "3–5 years", "5–10 years", "10+ years"].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <input type="text" value={association} onChange={(e) => setAssociation(e.target.value)}
                  placeholder="Association (e.g. NIESV), if any" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                {association.trim() && (
                  <input type="text" value={membershipId} onChange={(e) => setMembershipId(e.target.value)}
                    placeholder="Membership ID" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                )}
              </>
            )}

            {newRole === "manager" && (
              <>
                <select value={profession} onChange={(e) => setProfession(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                  {PROFESSIONS.map((p) => <option key={p}>{p}</option>)}
                </select>
                <input type="text" value={regNumber} onChange={(e) => setRegNumber(e.target.value)}
                  placeholder="Professional registration number" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                <input type="text" value={operatingStates} onChange={(e) => setOperatingStates(e.target.value)}
                  placeholder="States of operation (e.g. Kaduna, Abuja, Kano)" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                <div>
                  <label className="text-xs font-semibold text-gray-600">Upload professional certificate / licence</label>
                  <input type="file" accept="image/*,application/pdf"
                    onChange={(e) => setCertFile(e.target.files?.[0] || null)} className="w-full mt-1 text-xs" />
                </div>
              </>
            )}

            {(newRole === "agent" || newRole === "manager") && (
              <>
                <select value={idType} onChange={(e) => setIdType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                  <option value="">Select valid ID type</option>
                  {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                <input type="text" value={idNumber} onChange={(e) => setIdNumber(e.target.value)}
                  placeholder={idType ? ID_TYPE_PLACEHOLDERS[idType] : "ID number"}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                <input type="file" accept="image/*,application/pdf"
                  onChange={(e) => setIdFile(e.target.files?.[0] || null)} className="w-full text-xs" />
              </>
            )}

            {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={submitting}
              className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
              {submitting ? "Submitting..." : "Add this role"}
            </button>
          </form>
        )}

        <p className="text-xs text-gray-400 text-center mt-6">
          Don&apos;t have an account yet? <Link href="/register" className="text-chs-red font-semibold">Register fresh instead</Link>
        </p>
      </div>
    </div>
  );
}
