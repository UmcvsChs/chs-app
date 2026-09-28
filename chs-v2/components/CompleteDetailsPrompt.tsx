"use client";

import { useEffect, useRef, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { NIGERIAN_STATES } from "@/lib/geoData";

const AGE_BRACKETS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

// People verified on the earlier, shorter form never gave their
// gender, age bracket, address, occupation or email — and their state
// may only be what they typed at signup. This asks for those details
// without making them upload their ID again (it has already been
// reviewed). It only ever appears for someone who is verified but
// missing details, is never blocking, and disappears for good once
// completed — so it never nags anyone who is already complete.
export default function CompleteDetailsPrompt({ session }: { session: Session }) {
  const [needed, setNeeded] = useState(false);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  const [gender, setGender] = useState("");
  const [ageBracket, setAgeBracket] = useState("");
  const [stateOfResidence, setStateOfResidence] = useState("");
  const [residentialAddress, setResidentialAddress] = useState("");
  const [occupation, setOccupation] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    supabase.from("profiles")
      .select("valid_id_verified, gender, age_bracket, state, residential_address, profession, email")
      .eq("id", session.user.id).single()
      .then(({ data }) => {
        if (!data || !data.valid_id_verified) return;
        const missing = !data.gender || !data.age_bracket || !data.residential_address || !data.profession || !data.email;
        if (!missing) return;
        setNeeded(true);
        // Prefill whatever we already have so they only fill the gaps.
        if (data.gender) setGender(data.gender);
        if (data.age_bracket) setAgeBracket(data.age_bracket);
        if (data.state) setStateOfResidence(data.state);
        if (data.residential_address) setResidentialAddress(data.residential_address);
        if (data.profession) setOccupation(data.profession);
        if (data.email) setContactEmail(data.email);
      });
  }, [session.user.id]);

  useEffect(() => {
    if (error && errorRef.current) errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  async function handleSubmit() {
    if (!gender) { setError("Please select your gender."); return; }
    if (!ageBracket) { setError("Please select your age bracket."); return; }
    if (!stateOfResidence) { setError("Please select your state of residence."); return; }
    if (residentialAddress.trim().length < 10) { setError("Please enter your full residential address — house number, street and area."); return; }
    if (!occupation.trim()) { setError("Please enter your occupation."); return; }
    if (!/^\S+@\S+\.\S+$/.test(contactEmail.trim())) { setError("Please enter a valid email address."); return; }
    if (!consent) { setError("Please tick the box to confirm your details are true and that you consent to CHS keeping them."); return; }

    setError(null);
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc("complete_verified_details", {
      p_gender: gender,
      p_age_bracket: ageBracket,
      p_state_of_residence: stateOfResidence,
      p_residential_address: residentialAddress.trim(),
      p_occupation: occupation.trim(),
      p_contact_email: contactEmail.trim(),
      p_consent: consent,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message || "Could not save your details. Please try again.");
      return;
    }
    setDone(true);
  }

  if (!needed) return null;

  if (done) {
    return (
      <p className="text-xs text-green-700 bg-green-50 rounded-xl px-3 py-2.5 mb-3">
        ✓ Thank you — your details are complete.
      </p>
    );
  }

  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white";
  const labelClass = "text-[11px] font-semibold text-gray-600";

  return (
    <div className="bg-chs-amber-light border border-chs-amber-dark/30 rounded-xl p-3 mb-3">
      <p className="text-xs font-bold text-chs-amber-dark">📝 Complete your details</p>
      <p className="text-[11px] text-gray-600 mt-0.5">
        Your ID is already verified. CHS now also keeps a few more details on file for every member — it takes about a minute, and you don&apos;t need to upload anything again.
      </p>

      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-2 px-4 py-1.5 rounded-full bg-chs-red text-white text-[11px] font-semibold">
          Complete now
        </button>
      ) : (
        <div className="space-y-2.5 mt-3">
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
            <label className={labelClass}>Occupation</label>
            <input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)}
              placeholder="e.g. Trader, Nurse, Civil servant" className={`${inputClass} mt-1`} />
          </div>
          <div>
            <label className={labelClass}>Email address</label>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
              placeholder="you@example.com" className={`${inputClass} mt-1`} />
          </div>
          <label className="flex items-start gap-2 text-[11px] text-gray-600 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            <span>I confirm these details are true, and I consent to CHS keeping them.</span>
          </label>
          {error && <p ref={errorRef} className="text-[11px] text-chs-red bg-white rounded-lg px-3 py-2">{error}</p>}
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-2.5 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
            {submitting ? "Saving..." : "Save my details"}
          </button>
        </div>
      )}
    </div>
  );
}
