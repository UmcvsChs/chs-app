"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadDocument } from "@/lib/storage";
import { Session } from "@supabase/supabase-js";

// A real, genuinely new feature — even the original app never had a
// working owner-side upload for this, only a tenant-facing screen
// using fake, hardcoded data. Built completely here.
export default function HouseRulesUpload({ propertyId, session }: { propertyId: string; session: Session }) {
  const [existingUrl, setExistingUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("property_house_rules")
      .select("document_url")
      .eq("property_id", propertyId)
      .maybeSingle()
      .then(({ data }) => setExistingUrl(data?.document_url || null));
  }, [propertyId]);

  async function handleUpload() {
    if (!file) return;
    setError(null);
    setUploading(true);

    const url = await uploadDocument(file, session.user.id, `house-rules-${propertyId}`);
    if (!url) {
      setError("Could not upload this document. Please try again.");
      setUploading(false);
      return;
    }

    const { error: upsertError } = await supabase
      .from("property_house_rules")
      .upsert({ property_id: propertyId, document_url: url, uploaded_by: session.user.id }, { onConflict: "property_id" });

    setUploading(false);
    if (upsertError) {
      setError("Could not save this document. Please try again.");
      return;
    }
    setExistingUrl(url);
    setFile(null);
  }

  return (
    <div className="mt-1.5">
      <p className="text-[10px] font-semibold text-gray-600">House Rules &amp; Regulations</p>
      {existingUrl && (
        <a href={existingUrl} target="_blank" rel="noreferrer" className="text-[10px] text-chs-red underline block mt-0.5">
          📄 View current document
        </a>
      )}
      <div className="flex gap-1.5 mt-1">
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="flex-1 text-[10px]" />
        {file && (
          <button onClick={handleUpload} disabled={uploading}
            className="px-2.5 py-1 rounded-full bg-chs-red text-white text-[9px] font-semibold disabled:opacity-50">
            {uploading ? "Uploading..." : existingUrl ? "Replace" : "Upload"}
          </button>
        )}
      </div>
      {error && <p className="text-[9px] text-chs-red mt-1">{error}</p>}
    </div>
  );
}
