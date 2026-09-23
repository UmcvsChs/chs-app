"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { uploadDocument } from "@/lib/storage";
import { ID_TYPE_PLACEHOLDERS } from "@/lib/idValidation";
import InfoTip from "@/components/InfoTip";

interface RentalApplicationFormProps {
  propertyId: string;
  session: Session;
  onSuccess: () => void;
}

const ID_TYPES = ["National ID (NIN slip)", "Voter's Card", "International Passport", "Driver's Licence"];

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
  const [occupation, setOccupation] = useState("");
  const [presentAddress, setPresentAddress] = useState("");
  const [incomeSource, setIncomeSource] = useState("");
  const [employerBusinessName, setEmployerBusinessName] = useState("");
  const [employerBusinessAddress, setEmployerBusinessAddress] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorPhone, setGuarantorPhone] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const d = JSON.parse(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (d.applicantFullName) setApplicantFullName(d.applicantFullName);
        if (d.occupation) setOccupation(d.occupation);
        if (d.presentAddress) setPresentAddress(d.presentAddress);
        if (d.incomeSource) setIncomeSource(d.incomeSource);
        if (d.employerBusinessName) setEmployerBusinessName(d.employerBusinessName);
        if (d.employerBusinessAddress) setEmployerBusinessAddress(d.employerBusinessAddress);
        if (d.idType) setIdType(d.idType);
        if (d.idNumber) setIdNumber(d.idNumber);
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
        applicantFullName, occupation, presentAddress, incomeSource,
        employerBusinessName, employerBusinessAddress, idType, idNumber,
        guarantorName, guarantorPhone, moveInDate,
      }));
    } catch { /* private-browsing or full storage should never break typing */ }
  }, [draftKey, applicantFullName, occupation, presentAddress, incomeSource,
      employerBusinessName, employerBusinessAddress, idType, idNumber,
      guarantorName, guarantorPhone, moveInDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!applicantFullName.trim()) {
      setError("Please enter your real, full name — this is what the owner will see you as.");
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
    if (!idType || !idNumber.trim()) {
      setError("Please provide a real means of identification.");
      return;
    }
    if (!guarantorName.trim() || !guarantorPhone.trim()) {
      setError("Please enter your guarantor's name and phone number — they'll confirm everything else about themselves directly.");
      return;
    }
    if (!moveInDate) {
      setError("Please choose your preferred move-in date.");
      return;
    }

    setError(null);
    setSubmitting(true);

    let idDocumentUrl: string | null = null;
    if (idFile) idDocumentUrl = await uploadDocument(idFile, session.user.id, "rental-applicant-id");

    const { data, error: rpcError } = await supabase.rpc("submit_rental_application", {
      p_property_id: propertyId,
      p_applicant_full_name: applicantFullName.trim(),
      p_occupation: occupation.trim(),
      p_present_address: presentAddress.trim(),
      p_income_source: incomeSource.trim(),
      p_employer_business_name: employerBusinessName.trim(),
      p_employer_business_address: employerBusinessAddress.trim(),
      p_id_type: idType,
      p_id_number: idNumber.trim(),
      p_id_document_url: idDocumentUrl,
      p_guarantor_name: guarantorName.trim(),
      p_guarantor_phone: guarantorPhone.trim(),
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
  if (guarantorLink) {
    return (
      <div className="space-y-3">
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
        <label className="text-xs font-semibold text-gray-600">Your full name (as on your ID)</label>
        <input type="text" value={applicantFullName} onChange={(e) => setApplicantFullName(e.target.value)}
          placeholder="Your real, full legal name" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Occupation</label>
        <input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)}
          placeholder="e.g. Civil servant, Trader, Student" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Present address</label>
        <input type="text" value={presentAddress} onChange={(e) => setPresentAddress(e.target.value)}
          placeholder="Where you currently live" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Employer / business name</label>
        <input type="text" value={employerBusinessName} onChange={(e) => setEmployerBusinessName(e.target.value)}
          placeholder="Who you work for, or your business name" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Employer / business address</label>
        <input type="text" value={employerBusinessAddress} onChange={(e) => setEmployerBusinessAddress(e.target.value)}
          placeholder="A real, verifiable work or business address" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Source of income</label>
        <input type="text" value={incomeSource} onChange={(e) => setIncomeSource(e.target.value)}
          placeholder="e.g. Salary from XYZ Ltd, Business owner" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Means of identification</label>
        <select value={idType} onChange={(e) => setIdType(e.target.value)}
          className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
          <option value="">Select ID type</option>
          {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      {idType && (
        <input type="text" value={idNumber} onChange={(e) => setIdNumber(e.target.value)}
          placeholder={ID_TYPE_PLACEHOLDERS[idType] || "ID number"}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      )}
      <input type="file" accept="image/*,application/pdf" onChange={(e) => setIdFile(e.target.files?.[0] || null)}
        className="w-full text-xs" />

      <div className="border-t border-gray-200 pt-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Your guarantor<InfoTip text="A real person who agrees to stand behind you — if you genuinely can't pay rent, your guarantor is who the landlord can turn to. Most landlords require one; it's a standard part of renting, not a sign of distrust in you specifically." /></p>
        <p className="text-[11px] text-gray-500 mb-2">
          You provide only their name and phone number below. Your guarantor will independently fill in everything else about themselves — their address, occupation, ID, and their own real consent — through a private link sent directly to them. This is deliberate: CHS does not accept a guarantor&apos;s details entered by anyone but the guarantor.
        </p>
        <div>
          <label className="text-xs font-semibold text-gray-600">Guarantor&apos;s full name</label>
          <input type="text" value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)}
            placeholder="Full name" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
        </div>
        <div className="mt-2">
          <label className="text-xs font-semibold text-gray-600">Guarantor&apos;s phone number</label>
          <input type="tel" value={guarantorPhone} onChange={(e) => setGuarantorPhone(e.target.value)}
            placeholder="08XXXXXXXXX" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600">Preferred move-in date</label>
        <input
          type="date"
          value={moveInDate}
          onChange={(e) => setMoveInDate(e.target.value)}
          className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
        />
      </div>
      {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
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
