"use client";

import { useEffect, useRef, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { uploadDocument } from "@/lib/storage";
import { ID_TYPE_PLACEHOLDERS } from "@/lib/idValidation";
import { validateIdNumber, validatePhone, validateFullName, validateEmail } from "@/lib/validators";
import ValidatedInput from "@/components/ValidatedInput";
import { NIGERIAN_STATES } from "@/lib/geoData";
import FileUploadBox from "@/components/FileUploadBox";

const ID_TYPES = ["National ID (NIN slip)", "Voter's Card", "International Passport", "Driver's Licence"];
const AGE_BRACKETS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

// A real identity check, done once and reused for everything the
// person does on the platform afterwards (making an offer, applying to
// rent, booking a stay, requesting an inspection).
//
// Rebuilt after a direct client instruction: this used to ask only for
// an ID type and number, so there was nothing to compare the ID
// against and nothing to count by state. It now collects who the
// person is (the name exactly as printed on their ID, gender, age
// bracket rather than exact age), where they are (state and full
// residential address), what they do, and how to reach them (email),
// with explicit consent to CHS keeping these details for
// verification. An admin then compares the name on the ID against
// the name the person registered with, reviews the document, and on
// approval the verified details become the person's real profile data.
export default function IdentityVerificationGate({
  session,
  onVerified,
  propertyId,
  draftOffer,
}: {
  session: Session;
  onVerified: () => void;
  propertyId?: string;
  draftOffer?: Record<string, string>;
}) {
  const [checking, setChecking] = useState(true);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [pendingReview, setPendingReview] = useState(false);

  const [fullNameOnId, setFullNameOnId] = useState("");
  const [gender, setGender] = useState("");
  const [ageBracket, setAgeBracket] = useState("");
  const [stateOfResidence, setStateOfResidence] = useState("");
  const [residentialAddress, setResidentialAddress] = useState("");
  const [occupation, setOccupation] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const draftKey = `chs_idverify_draft_${session.user.id}`;

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("valid_id_verified, state, residential_address, email, profession, phone").eq("id", session.user.id).single(),
      supabase.from("buyer_id_verifications").select("status").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]).then(([profileRes, submissionRes]) => {
      const verified = !!profileRes.data?.valid_id_verified;
      setAlreadyVerified(verified);
      setPendingReview(submissionRes.data?.status === "pending");

      // Prefill only what the platform already knows and the person
      // can simply confirm or correct. The name on the ID and the ID
      // details themselves are never prefilled — they must be typed
      // from the document, which is what makes the comparison mean
      // something.
      if (profileRes.data) {
        if (profileRes.data.state) setStateOfResidence(profileRes.data.state);
        if (profileRes.data.residential_address) setResidentialAddress(profileRes.data.residential_address);
        if (profileRes.data.email) setContactEmail(profileRes.data.email);
        if (profileRes.data.profession) setOccupation(profileRes.data.profession);
        if (profileRes.data.phone) setContactPhone(profileRes.data.phone);
      }
      try {
        const saved = localStorage.getItem(draftKey);
        if (saved) {
          const d = JSON.parse(saved);
          if (d.fullNameOnId) setFullNameOnId(d.fullNameOnId);
          if (d.gender) setGender(d.gender);
          if (d.ageBracket) setAgeBracket(d.ageBracket);
          if (d.stateOfResidence) setStateOfResidence(d.stateOfResidence);
          if (d.residentialAddress) setResidentialAddress(d.residentialAddress);
          if (d.occupation) setOccupation(d.occupation);
          if (d.contactEmail) setContactEmail(d.contactEmail);
          if (d.contactPhone) setContactPhone(d.contactPhone);
          if (d.idType) setIdType(d.idType);
          if (d.idNumber) setIdNumber(d.idNumber);
        }
      } catch { /* a corrupted or blocked draft should never break the form */ }

      setChecking(false);
      if (verified) onVerified();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  // Save progress as they type, so an interruption doesn't lose it.
  useEffect(() => {
    if (checking) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        fullNameOnId, gender, ageBracket, stateOfResidence, residentialAddress, occupation, contactEmail, contactPhone, idType, idNumber,
      }));
    } catch { /* private browsing or full storage should never break typing */ }
  }, [checking, draftKey, fullNameOnId, gender, ageBracket, stateOfResidence, residentialAddress, occupation, contactEmail, contactPhone, idType, idNumber]);

  // Bring the message into view — on a long form it's easy to miss.
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  async function handleSubmit() {
    const nameCheck = validateFullName(fullNameOnId, "full name exactly as printed on your ID");
    if (!nameCheck.valid) { setError(nameCheck.message); return; }
    if (!gender) { setError("Please select your gender."); return; }
    if (!ageBracket) { setError("Please select your age bracket."); return; }
    if (!stateOfResidence) { setError("Please select your state of residence."); return; }
    if (residentialAddress.trim().length < 10) { setError("Please enter your full residential address — house number, street and area."); return; }
    if (!occupation.trim()) { setError("Please enter your occupation."); return; }
    const emailCheck = validateEmail(contactEmail);
    if (!emailCheck.valid) { setError(emailCheck.message); return; }
    const phoneCheck = validatePhone(contactPhone, { international: true });
    if (!phoneCheck.valid) { setError(phoneCheck.message); return; }
    if (!idType) { setError("Please select the type of ID you are submitting."); return; }
    const idCheck = validateIdNumber(idType, idNumber);
    if (!idCheck.valid) { setError(idCheck.message); return; }
    if (!idFile) { setError("Please upload a clear photo or scan of the ID you are submitting."); return; }
    if (!consent) { setError("Please tick the box to confirm your details are true and that you consent to CHS keeping them for verification."); return; }

    setError(null);
    setSubmitting(true);

    const idDocumentUrl = await uploadDocument(idFile, session.user.id, "buyer-id-verification");
    if (!idDocumentUrl) {
      setError("Your ID document could not be uploaded. Please check your connection, try a smaller file, and try again.");
      setSubmitting(false);
      return;
    }

    // Saves the return address and any half-finished offer alongside,
    // so the approval notification can link straight back with
    // everything ready to resume.
    const { error: rpcError } = await supabase.rpc("submit_buyer_id_verification", {
      p_id_type: idType,
      p_id_number: validateIdNumber(idType, idNumber).value,
      p_id_document_url: idDocumentUrl,
      p_full_name_on_id: fullNameOnId.trim(),
      p_gender: gender,
      p_age_bracket: ageBracket,
      p_state_of_residence: stateOfResidence,
      p_residential_address: residentialAddress.trim(),
      p_occupation: occupation.trim(),
      p_contact_email: contactEmail.trim(),
      p_contact_phone: validatePhone(contactPhone, { international: true }).value,
      p_consent: consent,
      p_return_property_id: propertyId || null,
      p_draft_offer: draftOffer || null,
    });

    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message || "Could not submit your identity details. Please try again.");
      return;
    }
    try { localStorage.removeItem(draftKey); } catch { /* success should never be blocked by storage cleanup */ }
    setSubmitted(true);
  }

  if (checking || alreadyVerified) return null;

  if (submitted || pendingReview) {
    return (
      <div className="bg-white rounded-xl border-2 border-chs-amber-dark p-3 mb-3">
        <p className="text-xs font-bold text-chs-amber-dark mb-1">⏳ Identity verification pending review</p>
        <p className="text-[10px] text-gray-500">
          Your details and ID have been submitted to CHS for real review — you&apos;ll be notified once it&apos;s approved, and can then continue with what you were doing.
        </p>
      </div>
    );
  }

  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white";
  const labelClass = "text-[11px] font-semibold text-gray-600";

  return (
    <div className="bg-white rounded-xl border-2 border-chs-red p-3 mb-3">
      <p className="text-xs font-bold text-chs-red mb-1">🪪 Identity verification required</p>
      <p className="text-[10px] text-gray-500 mb-3">
        Before you make an offer, apply to rent, or book a stay, CHS needs to know who you are. You do this once — after CHS approves it, it covers everything you do on the platform from then on.
      </p>

      <div className="space-y-2.5">
        <p className="text-[10px] font-bold text-gray-400 uppercase">About you</p>
        <div>
          <label className={labelClass}>Full name exactly as printed on your ID</label>
          <input type="text" value={fullNameOnId} onChange={(e) => setFullNameOnId(e.target.value)}
            placeholder="Surname and first name, as on the document" className={`${inputClass} mt-1`} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={`${inputClass} mt-1`}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Age bracket</label>
            <select value={ageBracket} onChange={(e) => setAgeBracket(e.target.value)} className={`${inputClass} mt-1`}>
              <option value="">Select</option>
              {AGE_BRACKETS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Occupation</label>
          <input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)}
            placeholder="e.g. Trader, Nurse, Civil servant" className={`${inputClass} mt-1`} />
        </div>

        <p className="text-[10px] font-bold text-gray-400 uppercase pt-1">Where you live and how to reach you</p>
        <div>
          <label className={labelClass}>State of residence</label>
          <select value={stateOfResidence} onChange={(e) => setStateOfResidence(e.target.value)} className={`${inputClass} mt-1`}>
            <option value="">Select your state</option>
            {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Residential address</label>
          <textarea value={residentialAddress} onChange={(e) => setResidentialAddress(e.target.value)} rows={2}
            placeholder="House number, street, area — where you live now" className={`${inputClass} mt-1`} />
        </div>
        <div>
          <label className={labelClass}>Phone number</label>
          <ValidatedInput kind="phoneIntl" value={contactPhone} onChange={setContactPhone}
            placeholder="08012345678 — the best number to reach you on" className={`${inputClass} mt-1`} />
        </div>
        <div>
          <label className={labelClass}>Email address</label>
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
            placeholder="you@example.com" className={`${inputClass} mt-1`} />
        </div>

        <p className="text-[10px] font-bold text-gray-400 uppercase pt-1">Your ID</p>
        <select value={idType} onChange={(e) => { setIdType(e.target.value); setIdNumber(""); }} className={inputClass}>
          <option value="">Select ID type</option>
          {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        {idType && (
          <ValidatedInput kind="idNumber" idType={idType} value={idNumber} onChange={setIdNumber}
            placeholder={ID_TYPE_PLACEHOLDERS[idType] || "ID number"} className={inputClass} />
        )}
        <FileUploadBox onFileSelect={setIdFile} accept="image/*,application/pdf" label="your ID" selectedFileName={idFile?.name} />

        <label className="flex items-start gap-2 text-[11px] text-gray-600 pt-1 cursor-pointer">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          <span>I confirm these details are true and match my ID, and I consent to CHS keeping and using them to verify my identity. CHS will never show my ID number to other users.</span>
        </label>

        {error && <p ref={errorRef} className="text-[11px] text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
        <button onClick={handleSubmit} disabled={submitting}
          className="w-full py-2.5 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
          {submitting ? "Submitting for review..." : "Submit for verification"}
        </button>
      </div>
    </div>
  );
}
