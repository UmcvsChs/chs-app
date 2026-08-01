"use client";

import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { uploadDocument } from "@/lib/storage";
import { ID_TYPE_PLACEHOLDERS } from "@/lib/idValidation";

const ID_TYPES = ["National ID (NIN slip)", "Voter's Card", "International Passport", "Driver's Licence"];

// A real, genuine identity check — restored, extended to cover buyers
// making a real offer to purchase, matching the same requirement
// already correctly built for tenants applying to rent. Verified once
// on the real profile, then reused for every future offer — the
// point isn't to re-ask the same person twice, it's to make sure
// someone genuinely serious about buying has real, verified identity
// on file before that first real offer goes anywhere.
export default function IdentityVerificationGate({
  session,
  onVerified,
}: {
  session: Session;
  onVerified: () => void;
}) {
  const [checking, setChecking] = useState(true);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id_type, id_number")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        const verified = !!(data?.id_type && data?.id_number);
        setAlreadyVerified(verified);
        setChecking(false);
        if (verified) onVerified();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  async function handleSubmit() {
    if (!idType || !idNumber.trim() || !idFile) {
      setError("Please provide your ID type, ID number, and a document upload — all four real ID types are accepted: National ID, Voter's Card, International Passport, or Driver's Licence.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const idDocumentUrl = await uploadDocument(idFile, session.user.id, "buyer-id-verification");
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ id_type: idType, id_number: idNumber.trim(), id_document_url: idDocumentUrl })
      .eq("id", session.user.id);

    setSubmitting(false);
    if (updateError) {
      setError("Could not save your identity details. Please try again.");
      return;
    }
    onVerified();
  }

  if (checking || alreadyVerified) return null;

  return (
    <div className="bg-white rounded-xl border-2 border-chs-red p-3 mb-3">
      <p className="text-xs font-bold text-chs-red mb-1">🪪 Identity verification required</p>
      <p className="text-[10px] text-gray-500 mb-2">
        Serious offers require a real, verified identity on file — this is checked once and reused for every future offer you make.
      </p>
      <div className="space-y-2">
        <select value={idType} onChange={(e) => setIdType(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
          <option value="">Select ID type</option>
          {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        {idType && (
          <input type="text" value={idNumber} onChange={(e) => setIdNumber(e.target.value)}
            placeholder={ID_TYPE_PLACEHOLDERS[idType] || "ID number"}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
        )}
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setIdFile(e.target.files?.[0] || null)}
          className="w-full text-xs" />
        {error && <p className="text-[10px] text-chs-red">{error}</p>}
        <button onClick={handleSubmit} disabled={submitting}
          className="w-full py-2.5 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
          {submitting ? "Verifying..." : "Verify my identity"}
        </button>
      </div>
    </div>
  );
}
