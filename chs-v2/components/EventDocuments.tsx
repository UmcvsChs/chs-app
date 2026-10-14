"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import FileUploadBox from "@/components/FileUploadBox";
import DocumentViewLink from "@/components/DocumentViewLink";

// Documents for an event booking (permits, event plan, floor plan, equipment list, insurance). The organiser adds
// them; the venue and CHS can open them. Shown only for event-centre bookings. Bigger events are asked for more.

interface Doc { id: string; kind: string; title: string; file_path: string; created_at: string; mine: boolean }
interface Ctx { is_event: boolean; risk_class: "routine" | "managed" | "enhanced"; closed: boolean }

const KINDS: Record<string, string> = { permit: "Permit / licence", event_plan: "Event plan", floor_plan: "Floor plan", equipment_list: "Equipment list", insurance: "Insurance", other: "Other" };
const HINT: Record<string, string> = {
  routine: "A small event. Documents are optional.",
  managed: "Please add your event plan, and any permit that applies (for example a fire or operating permit).",
  enhanced: "A large or public event. CHS and the venue will ask for permits, a safety and crowd plan and an equipment list before they confirm.",
};

export default function EventDocuments({ bookingId, canAdd }: { bookingId: string; canAdd: boolean }) {
  const { session } = useAuth();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [kind, setKind] = useState("event_plan");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const c = await supabase.rpc("booking_event_context", { p_booking: bookingId });
    setCtx((c.data as Ctx | null) ?? null);
    if ((c.data as Ctx | null)?.is_event) {
      const d = await supabase.rpc("get_booking_documents", { p_booking: bookingId });
      setDocs((d.data as Doc[]) || []);
    }
  }, [bookingId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function add() {
    if (!file || !session) return;
    setBusy(true); setErr(null);
    const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
    const path = `${session.user.id}/documents/event-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("private-documents").upload(path, file);
    if (up.error) { setBusy(false); setErr("The file could not be uploaded. Please try again."); return; }
    const { error } = await supabase.rpc("add_booking_document", { p_booking: bookingId, p_kind: kind, p_title: title || KINDS[kind], p_path: path });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setFile(null); setTitle(""); load();
  }

  async function remove(id: string) {
    const { error } = await supabase.rpc("remove_booking_document", { p_doc: id });
    if (error) setErr(error.message); else load();
  }

  if (!ctx || !ctx.is_event) return null;
  if (!canAdd && docs.length === 0) return null;
  return (
    <div className="mt-2 border-t border-gray-100 pt-2 space-y-1.5">
      <p className="text-[11px] font-bold text-chs-charcoal">📎 Event documents <span className={`ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ctx.risk_class === "enhanced" ? "bg-red-100 text-red-700" : ctx.risk_class === "managed" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>{ctx.risk_class === "enhanced" ? "Enhanced review" : ctx.risk_class === "managed" ? "Managed event" : "Routine event"}</span></p>
      {canAdd && !ctx.closed && <p className="text-[10px] text-gray-500">{HINT[ctx.risk_class]}</p>}
      {docs.map((d) => (
        <div key={d.id} className="flex justify-between items-center gap-2 text-[11px] bg-gray-50 rounded px-2 py-1">
          <span><b>{KINDS[d.kind] || d.kind}</b>: {d.title}</span>
          <span className="flex items-center gap-2 whitespace-nowrap">
            <DocumentViewLink url={`private-documents/${d.file_path}`} label="Open" />
            {d.mine && canAdd && !ctx.closed && <button onClick={() => remove(d.id)} className="text-[10px] text-red-600 underline">Remove</button>}
          </span>
        </div>
      ))}
      {canAdd && !ctx.closed && (
        <div className="space-y-1">
          <div className="flex gap-1">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="border border-gray-300 rounded px-1 py-1 text-[11px]">
              {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Short title (optional)" className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-[11px]" />
          </div>
          <FileUploadBox onFileSelect={setFile} accept="image/*,application/pdf" label="Add a document (PDF or photo)" selectedFileName={file?.name || null} />
          <button disabled={busy || !file} onClick={add} className="px-3 py-1 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">{busy ? "Adding…" : "Add document"}</button>
        </div>
      )}
      {err && <p className="text-[10px] text-red-600">{err}</p>}
    </div>
  );
}
