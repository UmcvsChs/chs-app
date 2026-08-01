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
