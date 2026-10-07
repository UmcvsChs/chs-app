"use client";

import { Req, RequiredLegend } from "@/components/FormMarks";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import InfoTip from "@/components/InfoTip";
import ValidatedInput from "@/components/ValidatedInput";
import { validatePhone, validateFullName } from "@/lib/validators";

interface RentalApplicationFormProps {
  propertyId: string;
  session: Session;
  onSuccess: () => void;
}


// Real, complete rework per a direct, serious client concern: a
// guarantor's own occupation, address, relationship, and consent were
// previously entered by the applicant on the guarantor's behalf, with
// a single checkbox standing in for real consent — no way to know the
// guarantor was ever real, informed, or willing. Matches real, global
// tenant-referencing practice now: the applicant provides only the
// guarantor's name and phone; the guarantor completes every other real
// field about themselves, independently, via their own secure link.
export default function RentalApplicationForm({
  propertyId,
  session,
  onSuccess,
}: RentalApplicationFormProps) {
  const [applicantFullName, setApplicantFullName] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [occupation, setOccupation] = useState("");
  const [presentAddress, setPresentAddress] = useState("");
  const [incomeSource, setIncomeSource] = useState("");
  const [employerBusinessName, setEmployerBusinessName] = useState("");
  const [employerBusinessAddress, setEmployerBusinessAddress] = useState("");
  // The applicant's ID is NOT asked for again here. They were already
  // verified by CHS at the identity step (which is required before this
  // form even appears), so the verified ID details are read from their
  // own profile and attached for the admin's review. Owners never
  // receive them.
  const [verifiedId, setVerifiedId] = useState<{ type: string; number: string; docUrl: string | null }>({ type: "", number: "", docUrl: null });
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorPhone, setGuarantorPhone] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    // Real, direct fix per a specific, repeated client complaint: if
    // a required field was missed and the person had already
    // scrolled to the submit button at the bottom, the error message
    // appeared wherever it lived on the page, not wherever they were
    // looking — easy to miss entirely on a long form. This scrolls
    // straight to it the instant it appears.
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);
  const [guarantorLink, setGuarantorLink] = useState<string | null>(null);

  // Real, direct fix per a specific, well-described client incident:
  // a real submission genuinely failed (almost certainly a session
  // that quietly expired mid-form, confirmed by the exact sequence
  // reported — refresh forced a fresh login), and everything typed
  // was lost with no way back. This automatically saves every real
  // field to this browser as it's typed, keyed to this specific
  // property, and restores it the moment the form is reopened — the
  // same real, everyday convenience the client described from
  // renewing a driver's licence elsewhere. Nothing here is sent
  // anywhere; it only ever lives in this browser until the real
  // application is actually submitted, at which point it's cleared.
  const draftKey = `chs_rental_draft_${propertyId}`;

  // Real, direct fix per a direct, firm client report, reproduced
  // exactly as described: occupation and present address kept showing
  // the exact same fixed real text ("car dealer", a real Damaturu
  // South address) on every single new application, even after many
  // real, completed applications since. Confirmed the real cause:
  // this effect was silently re-filling both fields from the
  // tenant's own permanent profile record every time the form opened
  // -- a real, one-time value set long ago, never cleared by
  // submitting an application, nothing to do with genuine
  // autocomplete at all. That real profile pre-fill is removed here
  // for both fields. The real ID is still read for admin's review;
  // phone is still real, genuinely sensible to pre-fill since it
  // rarely changes and is not free text the person is meant to
  // retype differently each time.
  useEffect(() => {
    supabase.from("profiles")
      .select("phone, valid_id_type, valid_id_number, valid_id_document_url, id_type, id_number, id_document_url")
      .eq("id", session.user.id).single()
      .then(({ data }) => {
        if (!data) return;
        setVerifiedId({
          type: data.valid_id_type || data.id_type || "",
          number: data.valid_id_number || data.id_number || "",
          docUrl: data.valid_id_document_url || data.id_document_url || null,
        });
        if (data.phone) setApplicantPhone((cur) => cur || data.phone);
      });
  }, [session.user.id]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const d = JSON.parse(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (d.applicantFullName) setApplicantFullName(d.applicantFullName);
        if (d.applicantPhone) setApplicantPhone(d.applicantPhone);
        if (d.occupation) setOccupation(d.occupation);
        if (d.presentAddress) setPresentAddress(d.presentAddress);
        if (d.incomeSource) setIncomeSource(d.incomeSource);
        if (d.employerBusinessName) setEmployerBusinessName(d.employerBusinessName);
        if (d.employerBusinessAddress) setEmployerBusinessAddress(d.employerBusinessAddress);
        if (d.guarantorName) setGuarantorName(d.guarantorName);
        if (d.guarantorPhone) setGuarantorPhone(d.guarantorPhone);
        if (d.moveInDate) setMoveInDate(d.moveInDate);
      }
    } catch { /* a corrupted or blocked draft should never break the real form */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        applicantFullName, applicantPhone, occupation, presentAddress, incomeSource,
        employerBusinessName, employerBusinessAddress,
        guarantorName, guarantorPhone, moveInDate,
      }));
    } catch { /* private-browsing or full storage should never break typing */ }
  }, [draftKey, applicantFullName, applicantPhone, occupation, presentAddress, incomeSource,
      employerBusinessName, employerBusinessAddress,
      guarantorName, guarantorPhone, moveInDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const applicantNameCheck = validateFullName(applicantFullName, "full name — this is what the owner will see you as");
    if (!applicantNameCheck.valid) {
      setError(applicantNameCheck.message);
      return;
    }
    // Real, direct fix per a specific, direct client question: admin
    // genuinely had no way to reach the applicant themselves — only
    // the phone tied to whichever account was logged in, which isn't
    // always the applicant's own real number. Required here, exactly
    // like the guarantor's own phone already is.
    const applicantPhoneCheck = validatePhone(applicantPhone);
    if (!applicantPhoneCheck.valid) {
      setError(`Your phone number: ${applicantPhoneCheck.message}`);
      return;
    }
    if (!occupation.trim() || !presentAddress.trim() || !incomeSource.trim()) {
      setError("Please tell us about yourself — your occupation, present address, and source of income.");
      return;
    }
    if (!employerBusinessName.trim() || !employerBusinessAddress.trim()) {
      setError("Please tell us where you work or the real location of your business — this helps the owner genuinely verify who you are.");
      return;
    }
    if (!guarantorName.trim() || !guarantorPhone.trim()) {
      setError("Please enter your guarantor's name and phone number — they'll confirm everything else about themselves directly.");
      return;
    }
    const guarantorNameCheck = validateFullName(guarantorName, "guarantor's full name");
    if (!guarantorNameCheck.valid) {
      setError(guarantorNameCheck.message);
      return;
    }
    const guarantorPhoneCheck = validatePhone(guarantorPhone);
    if (!guarantorPhoneCheck.valid) {
      setError(`Your guarantor's phone number: ${guarantorPhoneCheck.message}`);
      return;
    }
    // Real, direct fix per explicit client instruction: a spouse,
    // parent, or child sharing the same surname as the applicant is
    // too easy a shortcut to lean on and defeats the real purpose of
    // an independent guarantor — CHS requires a genuine third party,
    // not someone from the same household by name. Comparing the
    // last real word of each name is a practical, honest proxy for
    // this, matching exactly how the client described the rule.
    const applicantSurname = applicantFullName.trim().split(/\s+/).pop()?.toLowerCase();
    const guarantorSurname = guarantorName.trim().split(/\s+/).pop()?.toLowerCase();
    if (applicantSurname && guarantorSurname && applicantSurname === guarantorSurname) {
      setError("Your guarantor cannot share your surname — CHS requires a genuine third party, not a spouse, parent, or child. Please provide someone outside your immediate family.");
      return;
    }
    if (!moveInDate) {
      setError("Please choose your preferred move-in date.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const { data, error: rpcError } = await supabase.rpc("submit_rental_application", {
      p_property_id: propertyId,
      p_applicant_full_name: applicantFullName.trim(),
      p_applicant_phone: validatePhone(applicantPhone).value,
      p_occupation: occupation.trim(),
      p_present_address: presentAddress.trim(),
      p_income_source: incomeSource.trim(),
      p_employer_business_name: employerBusinessName.trim(),
      p_employer_business_address: employerBusinessAddress.trim(),
      p_id_type: verifiedId.type || "Verified by CHS",
      p_id_number: verifiedId.number || "On file with CHS",
      p_id_document_url: verifiedId.docUrl,
      p_guarantor_name: guarantorName.trim(),
      p_guarantor_phone: validatePhone(guarantorPhone).value,
      p_move_in_date: moveInDate,
    });

    if (rpcError || !data) {
      // Real, direct fix for a genuine, serious bug: the actual
      // error was always being thrown away and replaced with one
      // generic sentence, no matter what really went wrong
      // underneath — including the one case that matters most here,
      // a session that quietly expired while the form was open. Real
      // draft is deliberately kept in this failure branch — nothing
      // typed is lost, exactly the point of building this.
      const authLikely = rpcError?.message?.toLowerCase().includes("jwt") || rpcError?.message?.toLowerCase().includes("row-level security") || !session;
      setError(authLikely
        ? "Your session appears to have expired. Please log in again — everything you've typed here has been saved and will be waiting for you."
        : `Could not submit your application: ${rpcError?.message || "please try again."}`);
      setSubmitting(false);
      return;
    }

    // Real: the draft's only job was to survive a real failure —
    // once the application has genuinely, successfully submitted,
    // clearing it is correct, not a loss.
    try { localStorage.removeItem(draftKey); } catch { /* real success should never be blocked by storage cleanup */ }

    setGuarantorLink(`${window.location.origin}/guarantor-confirm/${data.guarantor_token}`);
    setSubmitting(false);
  }

  // Real, deliberate final screen — the application is not actually
  // moving forward until the guarantor completes their own real,
  // independent step, so the applicant needs the real link in hand to
  // send it themselves right now, not just a generic "submitted" message.
  const guarantorLinkRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Real, direct fix per a specific, repeated client complaint: a
    // long form being replaced by a short success screen left the
    // browser sitting wherever it scrolled to fill in the form —
    // often the bottom, showing nothing relevant at all. This
    // scrolls straight to the real next step the instant it appears,
    // instead of leaving the person to hunt for it themselves.
    if (guarantorLink && guarantorLinkRef.current) {
      guarantorLinkRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [guarantorLink]);

  if (guarantorLink) {
    return (
      <div className="space-y-3" ref={guarantorLinkRef}>
        <div className="bg-chs-amber-light rounded-lg p-4 border border-chs-amber-dark">
          <p className="text-sm font-bold text-chs-charcoal mb-2">✓ Your details are in — one real step left</p>
          <p className="text-xs text-gray-600 mb-3">
            Your application will not reach the owner until <strong>{guarantorName}</strong> independently confirms and completes their own section — CHS does not accept a guarantor&apos;s details filled in by anyone but the guarantor themselves.
          </p>
          <p className="text-xs font-semibold text-gray-600 mb-1">Send this real, one-time link to your guarantor now:</p>
          <div className="bg-white rounded-lg px-3 py-2 text-[11px] text-chs-charcoal break-all border border-gray-200">
            {guarantorLink}
          </div>
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(guarantorLink); }}
            className="w-full mt-2 py-2 rounded-full bg-chs-red text-white text-xs font-semibold"
          >
            Copy link
          </button>
        </div>
        <button type="button" onClick={onSuccess} className="w-full py-2.5 rounded-full bg-chs-charcoal text-white text-sm font-semibold">
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-gray-500">
        CHS will review your documents, your guarantor will independently confirm their own details, then the property owner makes the final decision.
      </p>
      <p className="text-[10px] text-gray-400">
        💾 Your entries here are saved automatically in this browser as you type — if something interrupts you, reopening this form brings them right back.
      </p>

      <p className="text-[10px] font-bold text-gray-400 uppercase pt-1">About you</p>
      <div>
        <RequiredLegend className="mb-1.5" />
        <label className="text-xs font-semibold text-gray-600">Your full name (as on your ID) <Req /></label>
        <input type="text" name="applicant-full-name" autoComplete="name" value={applicantFullName} onChange={(e) => setApplicantFullName(e.target.value)}
          placeholder="Your real, full legal name" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Your phone number <Req /></label>
        <ValidatedInput kind="phone" value={applicantPhone} onChange={setApplicantPhone}
          placeholder="08XXXXXXXXX — CHS may need to reach you directly" className="w-full mt-1 px-3 py-2.5 rounded-lg text-sm" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Occupation <Req /></label>
        <input type="text" name="occupation" autoComplete="organization-title" value={occupation} onChange={(e) => setOccupation(e.target.value)}
          placeholder="e.g. Civil servant, Trader, Student" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Present address <Req /></label>
        <input type="text" name="present-address" autoComplete="street-address" value={presentAddress} onChange={(e) => setPresentAddress(e.target.value)}
          placeholder="Where you currently live" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Employer / business name <Req /></label>
        <input type="text" name="employer-business-name" autoComplete="organization" value={employerBusinessName} onChange={(e) => setEmployerBusinessName(e.target.value)}
          placeholder="Who you work for, or your business name" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Employer / business address <Req /></label>
        <input type="text" name="employer-business-address" value={employerBusinessAddress} onChange={(e) => setEmployerBusinessAddress(e.target.value)}
          placeholder="A real, verifiable work or business address" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Source of income <Req /></label>
        <input type="text" name="income-source" value={incomeSource} onChange={(e) => setIncomeSource(e.target.value)}
          placeholder="e.g. Salary from XYZ Ltd, Business owner" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>
      <p className="text-[11px] text-green-700 bg-green-50 rounded-lg px-3 py-2">
        ✓ Your identity is already verified by CHS — there is no need to upload your ID again.
      </p>

      <div className="border-t border-gray-200 pt-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Your guarantor<InfoTip text="A real person who agrees to stand behind you — if you genuinely can't pay rent, your guarantor is who the landlord can turn to. Most landlords require one; it's a standard part of renting, not a sign of distrust in you specifically." /></p>
        <p className="text-[11px] text-gray-500 mb-2">
          You provide only their name and phone number below. Your guarantor will independently fill in everything else about themselves — their address, occupation, ID, and their own real consent — through a private link sent directly to them. This is deliberate: CHS does not accept a guarantor&apos;s details entered by anyone but the guarantor.
        </p>
        <div>
          <label className="text-xs font-semibold text-gray-600">Guarantor&apos;s full name <Req /></label>
          <input type="text" name="guarantor-full-name" value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)}
            placeholder="Full name" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
        </div>
        <div className="mt-2">
          <label className="text-xs font-semibold text-gray-600">Guarantor&apos;s phone number <Req /></label>
          <ValidatedInput kind="phone" value={guarantorPhone} onChange={setGuarantorPhone}
            placeholder="08XXXXXXXXX" className="w-full mt-1 px-3 py-2.5 rounded-lg text-sm" />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600">Preferred move-in date <Req /></label>
        <input
          type="date"
          value={moveInDate}
          onChange={(e) => setMoveInDate(e.target.value)}
          className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
        />
      </div>
      {error && <p ref={errorRef} className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit application"}
      </button>
    </form>
  );
}
