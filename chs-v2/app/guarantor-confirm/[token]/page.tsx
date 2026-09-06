"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase";
import { ID_TYPE_PLACEHOLDERS } from "@/lib/idValidation";

const ID_TYPES = ["National ID (NIN slip)", "Voter's Card", "International Passport", "Driver's Licence"];

interface GuarantorContext {
  applicant_full_name: string;
  property_title: string;
  move_in_date: string;
  already_confirmed: boolean;
  guarantor_name: string;
}

// Real, new page completing a direct, serious client concern: this is
// the one and only place a guarantor's own occupation, address,
// relationship, ID, and consent are ever recorded — deliberately
// requiring no CHS account, since a guarantor may not be a CHS user at
// all. The real, single-use token sent directly to the guarantor is
// the credential; nobody else can complete this on their behalf.
export default function GuarantorConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [context, setContext] = useState<GuarantorContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [relationship, setRelationship] = useState("");
  const [address, setAddress] = useState("");
  const [occupation, setOccupation] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [signatureFullName, setSignatureFullName] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    supabase.rpc("get_guarantor_confirmation_context", { p_token: token }).then(({ data, error: rpcError }) => {
      if (rpcError || !data) {
        setError("This real confirmation link is not valid or has expired.");
      } else {
        setContext(data as unknown as GuarantorContext);
      }
      setLoading(false);
    });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!relationship.trim() || !address.trim() || !occupation.trim()) {
      setError("Please fill in your real relationship, address, and occupation.");
      return;
    }
    if (!idType || !idNumber.trim()) {
      setError("Please provide your own, real means of identification.");
      return;
    }
    if (!understood) {
      setError("Please confirm you understand what standing as a guarantor means before continuing.");
      return;
    }
    if (!signatureFullName.trim()) {
      setError("Please type your real, full name as your signature to confirm.");
      return;
    }

    setError(null);
    setSubmitting(true);

    let idDocumentUrl: string | null = null;
    if (idFile) {
      const ext = idFile.name.split(".").pop();
      const path = `guarantor-${token}/documents/guarantor-id-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("private-documents").upload(path, idFile);
      if (!uploadError) {
        const { data: signedData } = await supabase.storage.from("private-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
        idDocumentUrl = signedData?.signedUrl || null;
      }
    }

    const { error: rpcError } = await supabase.rpc("submit_guarantor_confirmation", {
      p_token: token,
      p_relationship: relationship.trim(),
      p_address: address.trim(),
      p_occupation: occupation.trim(),
      p_id_type: idType,
      p_id_number: idNumber.trim(),
      p_id_document_url: idDocumentUrl,
      p_signature_full_name: signatureFullName.trim(),
    });

    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setSubmitted(true);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  if (error && !context) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm font-semibold text-chs-red mb-2">This link could not be used</p>
        <p className="text-xs text-gray-500">{error}</p>
      </div>
    );
  }

  if (submitted || context?.already_confirmed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-xl mb-2">✓</p>
        <p className="text-sm font-semibold text-chs-charcoal mb-2">Thank you — your confirmation has been recorded</p>
        <p className="text-xs text-gray-500">The application can now move forward to the property owner for a real decision.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-chs-charcoal text-white rounded-xl p-4 mb-4">
          <p className="font-serif text-lg font-bold">CHS Guarantor Confirmation</p>
          <p className="text-xs text-white/70 mt-1">
            <strong>{context?.applicant_full_name}</strong> has named you, <strong>{context?.guarantor_name}</strong>, as their guarantor for <strong>{context?.property_title}</strong>, with a move-in date of {context?.move_in_date}.
          </p>
        </div>

        <div className="bg-chs-amber-light rounded-lg p-3 border border-chs-amber-dark mb-4">
          <p className="text-xs font-bold text-chs-charcoal mb-1">Only you can complete this</p>
          <p className="text-[11px] text-gray-600">
            For your protection and the applicant&apos;s, CHS requires every real detail below to come directly from you — never filled in by the applicant on your behalf. No CHS account is needed.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 bg-white rounded-xl border border-gray-200 p-4">
          <div>
            <label className="text-xs font-semibold text-gray-600">Your relationship to the applicant</label>
            <input type="text" value={relationship} onChange={(e) => setRelationship(e.target.value)}
              placeholder="e.g. Uncle, Pastor, Employer, Family friend" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Your real, verifiable address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="Where you currently live" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Your occupation</label>
            <input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)}
              placeholder="e.g. Civil servant, Business owner" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Your means of identification</label>
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
            <p className="text-xs font-bold text-chs-charcoal mb-1">What you are agreeing to</p>
            <p className="text-[11px] text-gray-600 mb-2">
              &quot;I confirm I personally know {context?.applicant_full_name}. I am providing my own, real, verifiable address and identification. If this tenant fails to pay rent or breaches the tenancy agreement and cannot be reached, I understand I may be contacted and held responsible for helping resolve the matter.&quot;
            </p>
            <label className="flex items-start gap-2 text-[11px] text-chs-charcoal">
              <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-0.5" />
              <span>I understand and agree to stand as guarantor under these real terms.</span>
            </label>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Type your full name as your signature</label>
            <input type="text" value={signatureFullName} onChange={(e) => setSignatureFullName(e.target.value)}
              placeholder="Your real, full legal name" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>

          {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={submitting}
            className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
            {submitting ? "Submitting..." : "Confirm and consent"}
          </button>
        </form>
      </div>
    </div>
  );
}
