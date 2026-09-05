"use client";

import { useState, Suspense } from "react";
import ComprehensionCheck from "@/components/ComprehensionCheck";
import TermsContent from "@/components/TermsContent";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { uploadDocument } from "@/lib/storage";
import { validateIdNumberFormat, ID_TYPE_PLACEHOLDERS } from "@/lib/idValidation";

import { NIGERIAN_STATES, LGA_BY_STATE } from "@/lib/geoData";
const ID_TYPES = ["National ID (NIN slip)", "Voter's Card", "International Passport", "Driver's Licence"];
const PROFESSIONS = [
  "Estate Surveyor & Valuer", "Property Manager", "Quantity Surveyor",
  "Structural Engineer", "Facility Manager", "Real Estate Consultant", "Other professional",
];

type Role = "buyer" | "guest" | "tenant" | "owner" | "agent" | "manager" | "developer" | "staff" | "others";

const ROLE_OPTIONS: { value: Role; label: string; desc: string }[] = [
  { value: "buyer", label: "Buyer", desc: "Searching to purchase, rent, lease, or hire a property" },
  { value: "guest", label: "Guest", desc: "Booking a shortlet apartment or a hotel/lodge stay" },
  { value: "tenant", label: "Tenant", desc: "Already renting, or about to start renting, through CHS" },
  { value: "owner", label: "Property Owner", desc: "Listing a property to sell, rent, lease, or hire out" },
  { value: "agent", label: "Agent", desc: "Marketing properties and earning referral commission" },
  { value: "manager", label: "Property Manager", desc: "Managing properties professionally on behalf of owners" },
  { value: "developer", label: "Commercial Developer", desc: "Sell estates, offer instalment/investment plans" },
  { value: "staff", label: "Staff / Employee", desc: "Invited by an agent or property manager to join their real team — register here, then ask them to add your phone number" },
  { value: "others", label: "Others (Artisan / Market Seller / Service Provider)", desc: "Fixing, building, selling home items, or offering another real service — register here, then choose your specific category next" },
];

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentInviteToken = searchParams.get("agent_invite");
  const prefillName = searchParams.get("prefillName");
  const prefillPhone = searchParams.get("prefillPhone");
  const prefillRole = searchParams.get("role");
  const [role, setRole] = useState<Role>((prefillRole as Role) || "buyer");
  const [comprehensionPassed, setComprehensionPassed] = useState(false);
  const [name, setName] = useState(prefillName || "");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState(prefillPhone || "");
  const [email, setEmail] = useState("");
  const [nin, setNin] = useState("");
  const [state, setState] = useState("Kaduna");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

  // Agent-specific
  const [agentType, setAgentType] = useState<"independent" | "chs_official">("independent");
  const [lgaList, setLgaList] = useState<string[]>([]);
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
  const [invalidFieldId, setInvalidFieldId] = useState<string | null>(null);

  function validate(): { message: string; fieldId: string } | null {
    if (!name.trim()) return { message: "Please enter your full name.", fieldId: "field-name" };
    if (!/^\d{11}$/.test(phone.trim())) return { message: "Please enter a valid 11-digit Nigerian phone number.", fieldId: "field-phone" };
    if (!/^\d{11}$/.test(nin.trim())) return { message: "Please enter a valid 11-digit NIN.", fieldId: "field-nin" };

    // Real, critical fix — a typed NIN number alone proves nothing; a
    // real, uploaded ID document is what's actually checked.
    if (role !== "agent" && role !== "manager") {
      if (!idType) return { message: "Please select which type of ID you're uploading.", fieldId: "field-reg-id-type" };
      if (!idFile) return { message: "Please upload a real photo or scan of your ID — a typed NIN number alone cannot be verified.", fieldId: "field-reg-id-file" };
    }
    if (!/^\d{6}$/.test(pin)) return { message: "Please create a 6-digit PIN (numbers only).", fieldId: "field-pin" };
    if (pin !== pinConfirm) return { message: "Your PIN and confirmation don't match.", fieldId: "field-pin-confirm" };

    if (role === "agent") {
      const associationNamed = association.trim() && association.trim().toLowerCase() !== "none";
      if (associationNamed && !membershipId.trim()) {
        return { message: `Please enter your ${association} membership ID/registration number.`, fieldId: "field-membership-id" };
      }
      if (!idType) return { message: "Please select which type of ID you're providing.", fieldId: "field-id-type" };
      if (!validateIdNumberFormat(idType, idNumber)) {
        return { message: idType === "National ID (NIN slip)" ? "Please enter a valid 11-digit NIN." : `Please enter your ${idType} number.`, fieldId: "field-id-number" };
      }
      if (!idFile) return { message: `Please upload a photo or scan of your ${idType}.`, fieldId: "field-id-file" };
    }

    if (role === "manager") {
      if (!operatingStates.trim()) return { message: "Please enter which states you operate in.", fieldId: "field-operating-states" };
      if (!certFile) return { message: "Please upload your professional certificate or licence.", fieldId: "field-cert-file" };
    }

    if (role === "developer") {
      if (!companyName.trim()) return { message: "Please enter your company or development name.", fieldId: "field-company-name" };
      if (!cacNumber.trim()) return { message: "Please enter your CAC registration number.", fieldId: "field-cac-number" };
      if (offersInstalments === "") return { message: "Please let us know whether you offer instalment purchase plans.", fieldId: "field-offers-instalments" };
      if (acceptsInvestment === "") return { message: "Please let us know whether you accept investment capital from buyers.", fieldId: "field-accepts-investment" };
    }

    return null;
  }

  // Real, new fix per direct client request: instead of leaving
  // someone to hunt for whichever field they missed, the exact real
  // field is scrolled into view and highlighted in red, the same way
  // banking apps handle this.
  function scrollToField(fieldId: string) {
    setInvalidFieldId(fieldId);
    requestAnimationFrame(() => {
      const el = document.getElementById(fieldId);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  // Real, reusable helper — a genuinely highlighted red border on
  // whichever exact field was actually missed, not a generic page-top
  // error message the user has to go hunting for.
  function fieldClass(fieldId: string, base: string) {
    return invalidFieldId === fieldId ? `${base} border-chs-red border-2` : base;
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comprehensionPassed) {
      setError("Please complete the comprehension check correctly before continuing.");
      return;
    }
    const validationError = validate();
    if (validationError) {
      setError(validationError.message);
      scrollToField(validationError.fieldId);
      return;
    }
    setError(null);
    setInvalidFieldId(null);
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
            // Real fix — "others" is a real, meaningful choice for the
            // person registering, but not a real database role; their
            // artisan/vendor status is tracked in its own real table
            // once they pick a specific category next, so their base
            // account is simply a buyer-equivalent account.
            email: email.trim() || null, state, role: role === "others" ? "buyer" : role,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok || result.error) {
        // Real, critical fix — the actual, live root cause of a
        // real, repeated, five-times-reported complaint: the
        // system's real internal account email is generated from
        // the phone number, not the visible email field. When
        // someone tries to register a second time with a phone
        // number that already has a real account, the raw technical
        // error from the authentication system happens to mention
        // "email" — and every real person reading it reasonably
        // assumes it's about the email field they just typed, not a
        // hidden, internal one tied to their phone number. Confirmed
        // this directly against the real, live database before
        // writing this fix — changing the visible email field could
        // never have solved it, because it was never the real cause.
        const rawError = (result.error || "").toLowerCase();
        if (rawError.includes("already registered") || rawError.includes("already exists") || rawError.includes("email")) {
          setError(
            "This phone number already has a real CHS account. Changing your email will not fix this — the conflict is your phone number, not your email. " +
            "If this is genuinely your account, log in and use \"Need a role added to your existing account? Link it here\" instead of registering again. " +
            "If this isn't your phone number, please double-check it."
          );
        } else {
          setError(result.error || "Registration failed. Please try again.");
        }
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

      // Real, new feature per direct client request: a real gender
      // field, so the app can genuinely greet someone respectfully
      // ("Hi Mr. Samson" / "Hi Miss Jennifer") instead of a bare
      // first name — applies to every real role, not just one.
      if (gender) {
        await supabase.from("profiles").update({ gender }).eq("id", userId);
      }

      // Real, new feature: if this new agent registered through a
      // real owner-generated invite link, automatically grant them
      // full management authority on that specific property — no
      // extra step needed from either the agent or the owner.
      if (role === "agent" && agentInviteToken) {
        await supabase.rpc("link_agent_via_invite", { p_agent_id: userId, p_invite_token: agentInviteToken });
      }

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
            operating_lgas: lgaList.length > 0 ? lgaList.join(", ") : null,
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
      } else if (idFile && idType) {
        // Real, critical fix — every other role (Buyer, Guest, Tenant,
        // Owner, Staff, Others) now genuinely uploads and submits a
        // real ID document at registration, feeding directly into
        // the same real admin review screen already built for this —
        // rather than an account reaching "pending approval" having
        // only ever had a self-typed NIN number with nothing to
        // actually check it against.
        const idDocumentUrl = await uploadDocument(idFile, userId, "registration-id");
        await supabase.from("buyer_id_verifications").insert({
          user_id: userId,
          id_type: idType,
          id_number: nin.trim(),
          id_document_url: idDocumentUrl,
          status: "pending",
        });
      }

      // Real, automatic linking per direct client request — if this
      // registration came from a real tenant invitation link, claim
      // it immediately, with zero extra step for the tenant.
      const pendingInviteToken = sessionStorage.getItem("chs_pending_tenant_invite_token");
      if (pendingInviteToken) {
        sessionStorage.removeItem("chs_pending_tenant_invite_token");
        await supabase.rpc("claim_tenant_invite", { p_token: pendingInviteToken });
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
    // Real, confirmed bug fix — this always fell back to the
    // homepage regardless of which real role someone just registered
    // as, completely ignoring the same role-aware routing that
    // already existed correctly on the login page. A brand new
    // owner/agent/manager/tenant account should land on their own
    // real dashboard immediately, not the generic homepage.
    const roleToPath: Record<string, string> = {
      admin: "/admin",
      owner: "/owner",
      agent: "/agent",
      manager: "/manager",
      tenant: "/tenant",
      buyer: "/",
      guest: "/",
      staff: "/staff",
      others: "/choose-category",
    };
    return roleToPath[role] || "/";
  }

  return (
    <div className="min-h-screen zone-buyer bg-[var(--zone-bg)] px-4 py-8">
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
            <label className="text-xs font-semibold text-gray-600">Full name <span className="text-chs-red">*</span></label>
            <input id="field-name" type="text" value={name} onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder="Your full legal name" className={fieldClass("field-name", "w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm")} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Gender</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {[{ value: "male", label: "Male" }, { value: "female", label: "Female" }].map((g) => (
                <button key={g.value} type="button" onClick={() => setGender(g.value)}
                  className={`py-2.5 rounded-lg border-2 text-sm font-semibold ${gender === g.value ? "border-chs-red bg-chs-amber-light" : "border-gray-200 bg-white"}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Phone number <span className="text-chs-red">*</span></label>
            <input id="field-phone" type="tel" inputMode="numeric" autoComplete="tel" name="phone" maxLength={11} value={phone}
              onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); setError(null); }}
              placeholder="08XXXXXXXXX" className={fieldClass("field-phone", "w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm")} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Email address (optional)</label>
            <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder="your@email.com" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">National Identification Number (NIN) <span className="text-chs-red">*</span></label>
            <input id="field-nin" type="text" inputMode="numeric" autoComplete="off" name="nin-not-a-real-autofill-category" maxLength={11} value={nin}
              onChange={(e) => { setNin(e.target.value.replace(/\D/g, "")); setError(null); }}
              placeholder="11-digit NIN" className={fieldClass("field-nin", "w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm")} />
          </div>

          {/* Real, critical fix per direct client complaint — a real
              account (Agnes Bala) got all the way to "pending
              approval" having only ever typed in an NIN number, with
              no real, uploaded ID document to actually verify it
              against. A typed number alone proves nothing — anyone
              can type any 11 digits. Agent and Manager already
              correctly required a real uploaded document; every other
              role now does too, feeding into the same real admin
              review screen that already exists for buyer IDs. */}
          {role !== "agent" && role !== "manager" && (
            <>
              <div>
                <label className="text-xs font-semibold text-gray-600">Type of ID you&apos;re uploading <span className="text-chs-red">*</span></label>
                <select id="field-reg-id-type" value={idType} onChange={(e) => setIdType(e.target.value)}
                  className={fieldClass("field-reg-id-type", "w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white")}>
                  <option value="">Select ID type</option>
                  {ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Upload a real photo or scan of this ID <span className="text-chs-red">*</span></label>
                <input id="field-reg-id-file" type="file" accept="image/*,application/pdf" onChange={(e) => setIdFile(e.target.files?.[0] || null)}
                  className={fieldClass("field-reg-id-file", "w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white")} />
                <p className="text-[10px] text-gray-400 mt-1">A real, verifiable document — not just typing your NIN number in — is what CHS actually checks before approving your account.</p>
              </div>
            </>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-600">State <span className="text-chs-red">*</span></label>
            <select value={state} onChange={(e) => setState(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
              {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Create PIN (6 digits) <span className="text-chs-red">*</span></label>
            <input id="field-pin" type="password" inputMode="numeric" autoComplete="new-password" name="new-pin" maxLength={6} value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="●●●●●●" className={fieldClass("field-pin", "w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm")} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Confirm PIN <span className="text-chs-red">*</span></label>
            <input id="field-pin-confirm" type="password" inputMode="numeric" autoComplete="new-password" name="confirm-pin" maxLength={6} value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
              placeholder="●●●●●●" className={fieldClass("field-pin-confirm", "w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm")} />
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
                <label className="text-xs font-semibold text-gray-600">LGA coverage areas in {state}</label>
                <p className="text-[10px] text-gray-400 mb-1">Select every real LGA you cover, or choose statewide.</p>
                <label className="flex items-center gap-2 text-xs text-chs-charcoal mb-2">
                  <input type="checkbox" checked={lgaList.length > 0 && lgaList.length === (LGA_BY_STATE[state] || []).length}
                    onChange={(e) => setLgaList(e.target.checked ? [...(LGA_BY_STATE[state] || [])] : [])} />
                  <span className="font-semibold">Statewide (all LGAs in {state})</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {(LGA_BY_STATE[state] || []).map((lga) => (
                    <label key={lga} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                      <input type="checkbox" checked={lgaList.includes(lga)}
                        onChange={(e) => setLgaList(e.target.checked ? [...lgaList, lga] : lgaList.filter((l) => l !== lga))} />
                      {lga}
                    </label>
                  ))}
                </div>
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
                  <input id="field-membership-id" type="text" value={membershipId} onChange={(e) => setMembershipId(e.target.value)}
                    placeholder="e.g. NIESV/VS/2847" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                  <p className="text-[10px] text-gray-400 mt-1">CHS verifies this before your Official Agent badge activates.</p>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-600">Valid ID type</label>
                <select id="field-id-type" value={idType} onChange={(e) => setIdType(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                  <option value="">Select an ID type</option>
                  {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">ID number</label>
                <input id="field-id-number" type="text" value={idNumber} onChange={(e) => setIdNumber(e.target.value)}
                  placeholder={ID_TYPE_PLACEHOLDERS[idType] || "Select an ID type above first"}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Upload the ID selected above</label>
                <input id="field-id-file" type="file" accept="image/*,application/pdf" onChange={(e) => setIdFile(e.target.files?.[0] || null)}
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
                <input id="field-operating-states" type="text" value={operatingStates} onChange={(e) => setOperatingStates(e.target.value)}
                  placeholder="e.g. Kaduna, Abuja, Kano" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Upload professional certificate / licence</label>
                <input id="field-cert-file" type="file" accept="image/*,application/pdf" onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                  className="w-full mt-1 text-xs" />
              </div>
            </div>
          )}

          {role === "developer" && (
            <div className="border-t border-gray-200 pt-4 mt-2 space-y-3">
              <p className="text-xs font-bold text-chs-charcoal">🏗️ Commercial Developer details</p>
              <div>
                <label className="text-xs font-semibold text-gray-600">Company / development name</label>
                <input id="field-company-name" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Millennium Homes Ltd" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">CAC registration number</label>
                <input id="field-cac-number" type="text" value={cacNumber} onChange={(e) => setCacNumber(e.target.value)}
                  placeholder="RC number" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Current or planned project(s)</label>
                <textarea value={currentProjects} onChange={(e) => setCurrentProjects(e.target.value)} rows={2}
                  placeholder="e.g. 40-unit estate, Millennium City, Phase 2" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Do you offer instalment purchase plans?</label>
                <select id="field-offers-instalments" value={offersInstalments} onChange={(e) => setOffersInstalments(e.target.value as "yes" | "no")}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No — outright payment only</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Do you accept investment capital from buyers (co-investment)?</label>
                <select id="field-accepts-investment" value={acceptsInvestment} onChange={(e) => setAcceptsInvestment(e.target.value as "yes" | "no")}
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

          {/* Real, serious gap found through direct client testing: the
              comprehension check below asked genuine questions about
              escrow, fees, and payment release — but nothing on this
              page ever showed the actual real terms those questions
              were about. A new user had no honest way to answer
              correctly except guessing. Fixed by showing the real,
              complete Terms & Conditions in a genuinely readable,
              scrollable panel directly above the quiz. */}
          <div>
            <p className="text-xs font-bold text-chs-charcoal mb-1">Please read before continuing</p>
            <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-xl p-3 bg-white text-[11px] leading-relaxed">
              <TermsContent />
            </div>
          </div>

          <ComprehensionCheck role={role} onPassed={setComprehensionPassed} />

          <button type="submit" disabled={submitting || !comprehensionPassed}
            className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
            {submitting ? "Creating your account..." : comprehensionPassed ? "Create my CHS account" : "Complete the check above to continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

// Real, required Suspense boundary — useSearchParams (needed to read
// a real agent invite token from the URL) forces this during static
// generation; without it, the production build genuinely fails.
export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>}>
      <RegisterPageContent />
    </Suspense>
  );
}
