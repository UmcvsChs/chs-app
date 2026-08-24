"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadDocument } from "@/lib/storage";

interface EngageDocument {
  id: string;
  document_type: string;
  file_url: string | null;
  due_by: string | null;
  status: "pending" | "ready" | "delivered";
}

const DOC_TYPE_LABELS: Record<string, string> = {
  architectural_drawing: "Architectural drawing",
  bill_of_quantities: "Bill of Quantities",
  structural_drawing: "Structural drawing",
  mep_drawing: "MEP drawing",
  other: "Other document",
};

// The real mechanism for "what next, do we have a way to actually
// deliver the drawing/BOQ" — a genuine status a client can check
// rather than wondering, and a real admin tool to manage it, not just
// a promise in the next-steps text.
export function EngageDocumentsList({ requestId }: { requestId: string }) {
  const [documents, setDocuments] = useState<EngageDocument[]>([]);

  useEffect(() => {
    supabase
      .from("engage_chs_documents")
      .select("*")
      .eq("request_id", requestId)
      .then(({ data }) => setDocuments(data || []));
  }, [requestId]);

  if (documents.length === 0) return null;

  return (
    <div className="mt-2 bg-white rounded-xl border border-gray-100 p-2.5 space-y-1.5">
      <p className="text-[11px] font-bold text-chs-charcoal">📄 Documents</p>
      {documents.map((d) => (
        <div key={d.id} className="flex justify-between items-center text-[11px]">
          <span className="text-gray-600">{DOC_TYPE_LABELS[d.document_type] || d.document_type}</span>
          <div className="flex items-center gap-1.5">
            {d.status === "pending" && d.due_by && (
              <span className="text-[10px] text-gray-400">Due {new Date(d.due_by).toLocaleDateString()}</span>
            )}
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
              d.status === "ready" || d.status === "delivered" ? "text-green-700 bg-green-50" : "text-chs-amber-dark bg-chs-amber-light"
            }`}>
              {d.status}
            </span>
            {d.file_url && (
              <a href={d.file_url} target="_blank" rel="noreferrer" className="text-chs-red font-semibold">View</a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// The admin-facing counterpart — upload or mark a document ready
// against this exact request, with a real due date.
export function EngageDocumentManager({ requestId, adminUserId }: { requestId: string; adminUserId: string }) {
  const [open, setOpen] = useState(false);
  const [documentType, setDocumentType] = useState("architectural_drawing");
  const [dueBy, setDueBy] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleMarkPending() {
    setUploading(true);
    const { error } = await supabase.rpc("upsert_engage_chs_document", {
      p_request_id: requestId,
      p_document_type: documentType,
      p_file_url: null,
      p_due_by: dueBy || null,
      p_status: "pending",
    });
    setUploading(false);
    setMessage(error ? error.message : `✓ ${DOC_TYPE_LABELS[documentType]} marked pending, due ${dueBy || "unspecified"}.`);
  }

  async function handleUploadReady() {
    if (!file) {
      setMessage("Choose a real file first.");
      return;
    }
    setUploading(true);
    const url = await uploadDocument(file, adminUserId, `engage-doc-${requestId}`);
    if (!url) {
      setUploading(false);
      setMessage("Could not upload this file. Please try again.");
      return;
    }
    const { error } = await supabase.rpc("upsert_engage_chs_document", {
      p_request_id: requestId,
      p_document_type: documentType,
      p_file_url: url,
      p_due_by: dueBy || null,
      p_status: "ready",
    });
    setUploading(false);
    setMessage(error ? error.message : `✓ ${DOC_TYPE_LABELS[documentType]} uploaded and marked ready — client notified.`);
    setFile(null);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full mt-2 py-1.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-semibold">
        📄 Manage documents
      </button>
    );
  }

  return (
    <div className="mt-2 bg-white rounded-xl border border-gray-100 p-2.5 space-y-1.5">
      <div className="flex justify-between items-center">
        <p className="text-[11px] font-bold text-chs-charcoal">Manage documents</p>
        <button onClick={() => setOpen(false)} className="text-gray-400 text-xs">✕</button>
      </div>
      <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}
        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] bg-white">
        {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <input type="date" value={dueBy} onChange={(e) => setDueBy(e.target.value)}
        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
      <button onClick={handleMarkPending} disabled={uploading}
        className="w-full py-1.5 rounded-full bg-chs-amber-light text-chs-amber-dark text-[10px] font-semibold disabled:opacity-50">
        Set due date (pending)
      </button>
      <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="w-full text-[10px]" />
      <button onClick={handleUploadReady} disabled={uploading}
        className="w-full py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
        {uploading ? "Working..." : "Upload & mark ready"}
      </button>
      {message && <p className="text-[10px] text-gray-600">{message}</p>}
    </div>
  );
}
