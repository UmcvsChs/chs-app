"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { uploadDocument } from "@/lib/storage";
import { ID_TYPE_PLACEHOLDERS } from "@/lib/idValidation";

interface RentalApplicationFormProps {
  propertyId: string;
  session: Session;
  onSuccess: () => void;
}

const ID_TYPES = ["National ID (NIN slip)", "Voter's Card", "International Passport", "Driver's Licence"];

// A real, complete application about the actual person who wants the
// property — not just their guarantor. This exact gap was flagged in
// an earlier audit and never actually fixed; fixed properly now, with
// every field that belongs here.
export default function RentalApplicationForm({
  propertyId,
  session,
  onSuccess,
}: RentalApplicationFormProps) {
  const [occupation, setOccupation] = useState("");
  const [presentAddress, setPresentAddress] = useState("");
  const [incomeSource, setIncomeSource] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorPhone, setGuarantorPhone] = useState("");
  const [guarantorRelationship, setGuarantorRelationship] = useState("");
  const [guarantorAddress, setGuarantorAddress] = useState("");
  const [guarantorOccupation, setGuarantorOccupation] = useState("");
  const [guarantorConsented, setGuarantorConsented] = useState(false);
  const [moveInDate, setMoveInDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!occupation.trim() || !presentAddress.trim() || !incomeSource.trim()) {
      setError("Please tell us about yourself — your occupation, present address, and source of income.");
      return;
    }
    if (!idType || !idNumber.trim()) {
      setError("Please provide a real means of identification.");
      return;
    }
    if (!guarantorName.trim() || !guarantorPhone.trim()) {
      setError("Please enter your guarantor's name and phone number.");
      return;
    }
    if (!guarantorRelationship.trim() || !guarantorAddress.trim() || !guarantorOccupation.trim()) {
      setError("Please provide your guarantor's relationship to you, their address, and their occupation — a real guarantor needs to be a genuinely identifiable, reachable person.");
      return;
    }
    if (!guarantorConsented) {
      setError("Your guarantor's consent is required before this application can be submitted.");
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

    const { error: insertError } = await supabase.from("rental_applications").insert({
      property_id: propertyId,
      tenant_id: session.user.id,
      applicant_occupation: occupation.trim(),
      applicant_present_address: presentAddress.trim(),
      applicant_income_source: incomeSource.trim(),
      applicant_id_type: idType,
      applicant_id_number: idNumber.trim(),
      applicant_id_document_url: idDocumentUrl,
      guarantor_name: guarantorName.trim(),
      guarantor_phone: guarantorPhone.trim(),
      guarantor_relationship: guarantorRelationship.trim(),
      guarantor_address: guarantorAddress.trim(),
      guarantor_occupation: guarantorOccupation.trim(),
      guarantor_consented: guarantorConsented,
      move_in_date: moveInDate,
    });

    if (insertError) {
      setError("Could not submit your application. Please try again.");
      setSubmitting(false);
      return;
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-gray-500">
        CHS will review your documents, then the property owner makes the final decision on your
        application.
      </p>

      <p className="text-[10px] font-bold text-gray-400 uppercase pt-1">About you</p>
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

      <p className="text-[10px] font-bold text-gray-400 uppercase pt-1">Your guarantor</p>
      <div>
        <label className="text-xs font-semibold text-gray-600">Guarantor&apos;s full name</label>
        <input
          type="text"
          value={guarantorName}
          onChange={(e) => setGuarantorName(e.target.value)}
          placeholder="Full name"
          className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Guarantor&apos;s phone number</label>
        <input
          type="tel"
          value={guarantorPhone}
          onChange={(e) => setGuarantorPhone(e.target.value)}
          placeholder="08XXXXXXXXX"
          className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Your relationship to your guarantor</label>
        <input type="text" value={guarantorRelationship} onChange={(e) => setGuarantorRelationship(e.target.value)}
          placeholder="e.g. Uncle, Pastor, Employer, Family friend" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Guarantor&apos;s address</label>
        <input type="text" value={guarantorAddress} onChange={(e) => setGuarantorAddress(e.target.value)}
          placeholder="A real, verifiable address" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600">Guarantor&apos;s occupation</label>
        <input type="text" value={guarantorOccupation} onChange={(e) => setGuarantorOccupation(e.target.value)}
          placeholder="e.g. Civil servant, Business owner" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
      </div>

      {/* Real, new consent statement per direct client request — a
          guarantor needs to genuinely understand what they're
          agreeing to, in plain language, not a single blank field. */}
      <div className="bg-chs-amber-light rounded-lg p-3 border border-chs-amber-dark">
        <p className="text-xs font-bold text-chs-charcoal mb-1">What your guarantor is agreeing to</p>
        <p className="text-[11px] text-gray-600 mb-2">
          By providing their details here, your guarantor is confirming: &quot;I know this applicant personally.
          I am providing my real, verifiable address and contact details. If this tenant fails to pay rent or
          breaches the tenancy agreement and cannot be reached, I understand I may be contacted and held
          responsible for helping resolve the matter.&quot; CHS or the property owner may call your guarantor
          directly to confirm they understand and accept this before your application proceeds.
        </p>
        <label className="flex items-start gap-2 text-[11px] text-chs-charcoal">
          <input type="checkbox" checked={guarantorConsented} onChange={(e) => setGuarantorConsented(e.target.checked)}
            className="mt-0.5" />
          <span>I confirm my guarantor is a real person who has agreed to stand as my guarantor under these terms.</span>
        </label>
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
