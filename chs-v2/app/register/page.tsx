"use client";

import { useState } from "react";
import ComprehensionCheck from "@/components/ComprehensionCheck";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { uploadDocument } from "@/lib/storage";
import { validateIdNumberFormat, ID_TYPE_PLACEHOLDERS } from "@/lib/idValidation";

import { NIGERIAN_STATES } from "@/lib/geoData";
const ID_TYPES = ["National ID (NIN slip)", "Voter's Card", "International Passport", "Driver's Licence"];
const PROFESSIONS = [
  "Estate Surveyor & Valuer", "Property Manager", "Quantity Surveyor",
  "Structural Engineer", "Facility Manager", "Real Estate Consultant", "Other professional",
];

type Role = "buyer" | "tenant" | "owner" | "agent" | "manager" | "developer";

const ROLE_OPTIONS: { value: Role; label: string; desc: string }[] = [
  { value: "buyer", label: "Buyer", desc: "Searching to purchase, rent, lease or hire a property" },
  { value: "tenant", label: "Tenant", desc: "Already renting, or about to start renting, through CHS" },
  { value: "owner", label: "Property Owner", desc: "Listing a property to sell, rent, lease, or hire out" },
  { value: "agent", label: "Agent", desc: "Marketing properties and earning referral commission" },
  { value: "manager", label: "Property Manager", desc: "Managing properties professionally on behalf of owners" },
  { value: "developer", label: "Commercial Developer", desc: "Sell estates, offer instalment/investment plans" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("buyer");
  const [comprehensionPassed, setComprehensionPassed] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nin, setNin] = useState("");
  const [state, setState] = useState("Kaduna");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

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
  const [professionalNumber, setProfessionalNumber] = useState("");
  const [operatingStates, setOperatingStates] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);

  // Commercial Developer-specific
  const [companyName, setCompanyName] = useState("");
  const [cacNumber, setCacNumber] = useState("");
  const [currentProjects, setCurrentProjects] = useState("");
  const [offersInstalments, setOffersInstalments] = useState<"" | "yes" | "no">("");
  const [acceptsInvestment, setAcceptsInvestment] = useState<"" | "yes" | "no">("");
  const [devExperience, setDevExperience] = useState("Less than 2 years");
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!name.trim() || !phone.trim()) return "Please enter your full name and phone number.";
    if (!/^\d{11}$/.test(nin.trim())) return "Please enter a valid 11-digit NIN.";
    if (!/^\d{6}$/.test(pin)) return "Please create a 6-digit PIN (numbers only).";
    if (pin !== pinConfirm) return "Your PIN and confirmation don't match.";

    if (role === "agent") {
      const associationNamed = association.trim() && association.trim().toLowerCase() !== "none";
      if (associationNamed && !membershipId.trim()) {
        return `Please enter your ${association} membership ID/registration number.`;
      }
      if (!idType) return "Please select which type of ID you're providing.";
      if (!validateIdNumberFormat(idType, idNumber)) {
        return idType === "National ID (NIN slip)" ? "Please enter a valid 11-digit NIN." : `Please enter your ${idType} number.`;
      }
      if (!idFile) return `Please upload a photo or scan of your ${idType}.`;
    }

    if (role === "manager") {
      if (!operatingStates.trim()) return "Please enter which states you operate in.";
      if (!certFile) return "Please upload your professional certificate or licence.";
    }

    if (role === "developer") {
      if (!companyName.trim()) return "Please enter your company or development name.";
      if (!cacNumber.trim()) return "Please enter your CAC registration number.";
      if (offersInstalments === "") return "Please let us know whether you offer instalment purchase plans.";
      if (acceptsInvestment === "") return "Please let us know whether you accept investment capital from buyers.";
    }

    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comprehensionPassed) {
      setError("Please complete the comprehension check correctly before continuing.");
      return;
    }
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      // Step 1: create the real account — same shared endpoint every
      // role uses, matching the original app's approach.
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/register-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            name: name.trim(), phone: phone.trim(), pin, nin: nin.trim(),
            email: email.trim() || null, state, role,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok || result.error) {
        setError(result.error || "Registration failed. Please try again.");
        setSubmitting(false);
        return;
      }

      const { error: loginError, data: loginData } = await supabase.auth.signInWithPassword({
        email: result.email,
        password: pin,
      });

      if (loginError || !loginData.user) {
        setError("Account created, but automatic sign-in failed. Please log in manually.");
        setSubmitting(false);
        return;
      }

      const userId = loginData.user.id;

      // Step 2: role-specific extras — a real file upload, then a real
      // update with everything collected, matching exactly what the
      // original app's now-fixed Agent/Manager registration does.
      if (role === "agent") {
        const idDocumentUrl = idFile ? await uploadDocument(idFile, userId, "agent-valid-id") : null;
        await supabase
          .from("profiles")
          .update({
            agent_type: agentType,
            association_name: association.trim() || null,
            membership_id: membershipId.trim() || null,
            membership_verified: false,
            operating_lgas: lgas.trim() || null,
            years_experience: experience,
            valid_id_type: idType,
            valid_id_number: idNumber.trim(),
            valid_id_document_url: idDocumentUrl,
            valid_id_verified: false,
          })
          .eq("id", userId);
      } else if (role === "manager") {
        const certificateUrl = certFile ? await uploadDocument(certFile, userId, "manager-certificate") : null;
        await supabase
          .from("profiles")
          .update({
            profession,
            professional_registration_number: professionalNumber.trim() || null,
            operating_states: operatingStates.trim(),
            certificate_document_url: certificateUrl,
            professional_credentials_verified: false,
          })
          .eq("id", userId);
      } else if (role === "developer") {
        const portfolioUrl = portfolioFile ? await uploadDocument(portfolioFile, userId, "developer-portfolio") : null;
        await supabase.from("developer_applications").insert({
          user_id: userId,
          company_name: companyName.trim(),
          cac_number: cacNumber.trim(),
          current_projects: currentProjects.trim() || null,
          offers_instalments: offersInstalments === "yes",
          accepts_investment_capital: acceptsInvestment === "yes",
          years_experience: devExperience,
          portfolio_url: portfolioUrl,
        });
      }

      router.push(getReturnPath());
    } catch {
      setError("Could not reach CHS servers. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  // Resumes exactly where someone came from — e.g. a property page they
  // were trying to make an offer on — rather than dropping them on a
  // generic homepage after going through the trouble of registering.
  function getReturnPath(): string {
    const pending = sessionStorage.getItem("chs_pending_return_to");
    if (pending) {
      sessionStorage.removeItem("chs_pending_return_to");
      return pending;
    }
    return "/";
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
                  role === opt.value ? "border-chs-red bg-chs-amber-light" : "border-gray-200 bg-white"
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
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Your full legal name" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Phone number</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="08XXXXXXXXX" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Email address (optional)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">National Identification Number (NIN)</label>
            <input type="text" inputMode="numeric" maxLength={11} value={nin}
              onChange={(e) => setNin(e.target.value.replace(/\D/g, ""))}
              placeholder="11-digit NIN" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">State</label>
            <select value={state} onChange={(e) => setState(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
              {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Create PIN (6 digits)</label>
            <input type="password" inputMode="numeric" maxLength={6} value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="●●●●●●" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Confirm PIN</label>
            <input type="password" inputMode="numeric" maxLength={6} value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
              placeholder="●●●●●●" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>

          {role === "agent" && (
            <div className="border-t border-gray-200 pt-4 mt-2 space-y-3">
              <p className="text-xs font-bold text-chs-charcoal">Agent details</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setAgentType("independent")}
                  className={`p-2.5 rounded-xl border-2 text-xs font-semibold text-center ${agentType === "independent" ? "border-chs-red bg-chs-amber-light" : "border-gray-200 bg-white"}`}>
                  Independent Agent
                </button>
                <button type="button" onClick={() => setAgentType("chs_official")}
                  className={`p-2.5 rounded-xl border-2 text-xs font-semibold text-center ${agentType === "chs_official" ? "border-chs-red bg-chs-amber-light" : "border-gray-200 bg-white"}`}>
                  Apply as CHS Agent
                </button>
              </div>

              {/* Real explanatory context for each path — restored,
                  found missing during the systematic Register view
                  comparison. The toggle and data fields already
                  existed, but the important context helping someone
                  make an informed choice did not. */}
              {agentType === "independent" ? (
                <p className="text-[11px] text-chs-red bg-chs-amber-light rounded-lg px-3 py-2 leading-relaxed">
                  You are registering as an <strong>Independent Agent</strong>. You operate under your own name/business, market properties on CHS, and earn the standard 5% referral commission. Upload your documents below and submit for CHS review.
                </p>
              ) : (
                <p className="text-[11px] text-gray-600 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
                  You are applying to become an <strong>official CHS Agent</strong>. This is a closer working relationship — you represent the CHS brand directly, receive priority property assignments, and are held to a stricter code of conduct. Additional vetting, an interview, and a signed CHS Agent Agreement are required before approval.
                </p>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-600">LGA coverage areas</label>
                <input type="text" value={lgas} onChange={(e) => setLgas(e.target.value)}
                  placeholder="e.g. Kaduna North, Chikun, Igabi" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Years of real estate experience</label>
                <select value={experience} onChange={(e) => setExperience(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                  {["Less than 1 year", "1–3 years", "3–5 years", "5–10 years", "10+ years"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Current association membership (if any)</label>
                <input type="text" value={association} onChange={(e) => setAssociation(e.target.value)}
                  placeholder="e.g. NIESV, REDAN, or None" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
              {association.trim() && association.trim().toLowerCase() !== "none" && (
                <div>
                  <label className="text-xs font-semibold text-gray-600">Membership ID / registration number</label>
                  <input type="text" value={membershipId} onChange={(e) => setMembershipId(e.target.value)}
                    placeholder="e.g. NIESV/VS/2847" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                  <p className="text-[10px] text-gray-400 mt-1">CHS verifies this before your Official Agent badge activates.</p>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-600">Valid ID type</label>
                <select value={idType} onChange={(e) => setIdType(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                  <option value="">Select an ID type</option>
                  {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">ID number</label>
                <input type="text" value={idNumber} onChange={(e) => setIdNumber(e.target.value)}
                  placeholder={ID_TYPE_PLACEHOLDERS[idType] || "Select an ID type above first"}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Upload the ID selected above</label>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setIdFile(e.target.files?.[0] || null)}
                  className="w-full mt-1 text-xs" />
              </div>
            </div>
          )}

          {role === "manager" && (
            <div className="border-t border-gray-200 pt-4 mt-2 space-y-3">
              <p className="text-xs font-bold text-chs-charcoal">Property Manager details</p>
              <div>
                <label className="text-xs font-semibold text-gray-600">Profession / qualification</label>
                <select value={profession} onChange={(e) => setProfession(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                  {PROFESSIONS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Professional registration number (if applicable)</label>
                <input type="text" value={professionalNumber} onChange={(e) => setProfessionalNumber(e.target.value)}
                  placeholder="e.g. NIESV/VS/1234" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">States of operation</label>
                <input type="text" value={operatingStates} onChange={(e) => setOperatingStates(e.target.value)}
                  placeholder="e.g. Kaduna, Abuja, Kano" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Upload professional certificate / licence</label>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                  className="w-full mt-1 text-xs" />
              </div>
            </div>
          )}

          {role === "developer" && (
            <div className="border-t border-gray-200 pt-4 mt-2 space-y-3">
              <p className="text-xs font-bold text-chs-charcoal">🏗️ Commercial Developer details</p>
              <div>
                <label className="text-xs font-semibold text-gray-600">Company / development name</label>
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Millennium Homes Ltd" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">CAC registration number</label>
                <input type="text" value={cacNumber} onChange={(e) => setCacNumber(e.target.value)}
                  placeholder="RC number" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Current or planned project(s)</label>
                <textarea value={currentProjects} onChange={(e) => setCurrentProjects(e.target.value)} rows={2}
                  placeholder="e.g. 40-unit estate, Millennium City, Phase 2" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Do you offer instalment purchase plans?</label>
                <select value={offersInstalments} onChange={(e) => setOffersInstalments(e.target.value as "yes" | "no")}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No — outright payment only</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Do you accept investment capital from buyers (co-investment)?</label>
                <select value={acceptsInvestment} onChange={(e) => setAcceptsInvestment(e.target.value as "yes" | "no")}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Years in real estate development</label>
                <select value={devExperience} onChange={(e) => setDevExperience(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                  <option>Less than 2 years</option>
                  <option>2–5 years</option>
                  <option>5–10 years</option>
                  <option>10+ years</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Upload company profile / portfolio (optional)</label>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setPortfolioFile(e.target.files?.[0] || null)}
                  className="w-full mt-1 text-xs" />
              </div>
              <p className="text-[10px] text-gray-400 bg-chs-amber-light rounded-lg px-3 py-2">
                Commercial Developer partnerships are governed by a separate Developer Partnership Agreement in addition to the standard CHS Terms &amp; Conditions. CHS will review your submission and contact you to finalise terms before any project goes live.
              </p>
            </div>
          )}

          {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}

          <ComprehensionCheck onPassed={setComprehensionPassed} />

          <button type="submit" disabled={submitting || !comprehensionPassed}
            className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
            {submitting ? "Creating your account..." : comprehensionPassed ? "Create my CHS account" : "Complete the check above to continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
