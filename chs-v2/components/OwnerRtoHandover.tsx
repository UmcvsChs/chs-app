"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { Req } from "@/components/FormMarks";
import { uploadDocument } from "@/lib/storage";

// Owner side of a finished mortgage (Rent to Own): the buyer has paid in full,
// CHS is holding the final payment, and the owner must hand over the property
// documents and show proof. The buyer's phone number is never shown here.

interface Row { id: string; total_price: number; final_held_amount: number | null; status: string; properties: { title: string }[] | { title: string } | null }
interface Submission { id: string; status: "submitted" | "approved" | "changes_requested"; review_note: string | null; created_at: string; files: { name: string; url: string }[] }
interface Handover {
  status: "requested" | "sent" | "confirmed"; recipient_name: string; delivery_address: string; method: string; max_days: number;
  deadline: string; overdue: boolean; sent_at: string | null; tracking: string | null; proof_note: string | null;
}

const titleOf = (p: Row["properties"]) => (Array.isArray(p) ? p[0]?.title : p?.title) || "Property";

export default function OwnerRtoHandover({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [handovers, setHandovers] = useState<Record<string, Handover | null>>({});
  const [form, setForm] = useState<Record<string, { method: string; tracking: string; note: string }>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [subs, setSubs] = useState<Record<string, Submission[]>>({});
  const [picked, setPicked] = useState<Record<string, File[]>>({});
  const [proofFile, setProofFile] = useState<Record<string, File | null>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("rent_to_own_agreements").select("id, total_price, final_held_amount, status, properties(title)")
      .eq("seller_id", userId).in("status", ["active", "awaiting_handover", "completed"]).order("started_at", { ascending: false });
    const list = (data as unknown as Row[]) || [];
    setRows(list);
    const hand: Record<string, Handover | null> = {};
    await Promise.all(list.map(async (r) => {
      const { data: h } = await supabase.rpc("get_rto_handover", { p_agreement_id: r.id });
      hand[r.id] = (h as Handover) || null;
    }));
    setHandovers(hand);
    const sb: Record<string, Submission[]> = {};
    await Promise.all(list.map(async (r) => {
      const { data: x } = await supabase.rpc("get_rto_submissions", { p_agreement_id: r.id });
      sb[r.id] = Array.isArray(x) ? (x as Submission[]) : [];
    }));
    setSubs(sb);
  }, [userId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function submitDocs(r: Row) {
    const files = picked[r.id] || [];
    if (files.length === 0) { setMsg((m) => ({ ...m, [r.id]: "Please choose at least one document (a scan or a clear photo)." })); return; }
    setBusy(r.id); setMsg((m) => ({ ...m, [r.id]: "" }));
    const uploaded: { name: string; url: string }[] = [];
    for (const file of files) {
      const url = await uploadDocument(file, userId, `rto-docs-${r.id.slice(0, 8)}`);
      if (!url) { setBusy(null); setMsg((m) => ({ ...m, [r.id]: `Could not upload ${file.name}. Please try again.` })); return; }
      uploaded.push({ name: file.name, url });
    }
    const { error } = await supabase.rpc("rto_submit_documents", { p_agreement_id: r.id, p_files: uploaded, p_note: null });
    setBusy(null);
    if (error) { setMsg((m) => ({ ...m, [r.id]: error.message })); return; }
    setPicked((x) => ({ ...x, [r.id]: [] }));
    load();
  }

  async function send(r: Row) {
    const f = form[r.id] || { method: "courier", tracking: "", note: "" };
    setBusy(r.id);
    let proofUrl: string | null = null;
    const pf = proofFile[r.id];
    if (pf) {
      proofUrl = await uploadDocument(pf, userId, `rto-proof-${r.id.slice(0, 8)}`);
      if (!proofUrl) { setBusy(null); setMsg((m) => ({ ...m, [r.id]: "Could not upload your receipt. Please try again." })); return; }
    }
    const { error } = await supabase.rpc("rto_mark_documents_sent", { p_agreement_id: r.id, p_method: f.method, p_tracking: f.tracking, p_proof_note: f.note, p_proof_url: proofUrl });
    setBusy(null);
    if (error) { setMsg((m) => ({ ...m, [r.id]: error.message })); return; }
    load();
  }

  const shown = rows.filter((r) => r.status === "active" || r.status === "awaiting_handover" || handovers[r.id]);
  if (shown.length === 0) return null;

  return (
    <div className="px-4 pb-3">
      <div className="bg-white border-2 border-chs-charcoal/20 rounded-xl p-3">
        <p className="text-xs font-bold text-chs-charcoal">📮 Mortgage documents to hand over ({shown.length})</p>
        <p className="text-[10px] text-gray-500 mb-2">The buyer has paid in full. CHS holds your final payment and releases it when you have sent the property documents and the buyer or CHS confirms. Contact with the buyer goes through CHS.</p>
        {shown.map((r) => {
          const h = handovers[r.id];
          const f = form[r.id] || { method: "courier", tracking: "", note: "" };
          const setF = (patch: Partial<typeof f>) => setForm({ ...form, [r.id]: { ...f, ...patch } });
          return (
            <div key={r.id} className="bg-[var(--zone-card)] rounded-lg p-2.5 mb-2">
              <p className="text-xs font-semibold text-chs-charcoal">{titleOf(r.properties)} · Ref RTO-{r.id.slice(0, 8)}</p>
              {r.status === "awaiting_handover" && <p className="text-[10px] text-amber-700 font-semibold">🔒 {formatNaira(r.final_held_amount || 0)} is held by CHS for you</p>}
              {r.status === "completed" && <p className="text-[10px] text-green-700 font-semibold">✓ Released. Handover complete</p>}
              {r.status !== "completed" && (
                <div className="mt-2 bg-white rounded-lg border border-gray-100 p-2">
                  <p className="text-[10px] font-bold text-chs-charcoal">Step 1: upload the documents for CHS to check</p>
                  {(subs[r.id] || []).map((sb) => (
                    <p key={sb.id} className={`text-[10px] mt-0.5 ${sb.status === "approved" ? "text-green-700" : sb.status === "changes_requested" ? "text-chs-red" : "text-amber-700"}`}>
                      {sb.status === "approved" ? "✓ Approved by CHS" : sb.status === "changes_requested" ? `✕ CHS asks for changes: ${sb.review_note || ""}` : "⏳ With CHS for checking"} · {sb.files.length} file(s) · {new Date(sb.created_at).toLocaleDateString()}
                    </p>
                  ))}
                  {!(subs[r.id] || []).some((sb) => sb.status === "approved") && (
                    <>
                      <input type="file" multiple accept="image/*,application/pdf" onChange={(e) => setPicked((x) => ({ ...x, [r.id]: Array.from(e.target.files || []) }))} className="w-full text-[10px] mt-1" />
                      <button type="button" onClick={() => submitDocs(r)} disabled={busy === r.id} className="w-full mt-1 py-1.5 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold disabled:opacity-50">{busy === r.id ? "Uploading..." : "Send to CHS for checking"}</button>
                    </>
                  )}
                </div>
              )}
              {!h && <p className="text-[10px] text-gray-500 mt-1">Step 2 starts when the buyer asks for the documents. You will be told straight away.</p>}
              {h && (
                <div className="mt-1 text-[11px] text-gray-700 space-y-0.5">
                  <p>Send to: <b>{h.recipient_name}</b>, {h.delivery_address}</p>
                  <p>By: <b>{new Date(h.deadline).toLocaleDateString()}</b> ({h.max_days} days){h.overdue && h.status !== "confirmed" ? " · overdue" : ""}</p>
                  {h.status === "requested" && (
                    <div className="space-y-1.5 mt-1.5">
                      <p className="text-[10px] font-bold text-chs-charcoal">Step 2: send the hard copies and report it{!(subs[r.id] || []).some((sb) => sb.status === "approved") ? " (after CHS approves Step 1)" : ""}</p>
                      <label className="text-[10px] font-semibold text-gray-600">How you sent them</label>
                      <select value={f.method} onChange={(e) => setF({ method: e.target.value })} className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-white">
                        <option value="courier">Courier</option><option value="in_person">In person</option><option value="registered_post">Registered post</option>
                      </select>
                      <input value={f.tracking} onChange={(e) => setF({ tracking: e.target.value })} placeholder="Tracking number or receipt number" className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs" />
                      <label className="text-[10px] font-semibold text-gray-600">Proof: say what you sent and when <Req /></label>
                      <textarea value={f.note} onChange={(e) => setF({ note: e.target.value })} rows={2} placeholder="e.g. Deed of assignment and survey plan sent by courier on 12 October, receipt 4471" className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs" />
                      <label className="text-[10px] font-semibold text-gray-600">Photo of your courier receipt (optional)</label>
                      <input type="file" accept="image/*,application/pdf" onChange={(e) => setProofFile((x) => ({ ...x, [r.id]: e.target.files?.[0] || null }))} className="w-full text-[10px]" />
                      <button type="button" onClick={() => send(r)} disabled={busy === r.id} className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">{busy === r.id ? "Sending..." : "I have sent the documents"}</button>
                    </div>
                  )}
                  {h.status === "sent" && <p className="text-green-700 font-semibold">✓ Proof received. Waiting for the buyer to confirm they have the documents.</p>}
                  {h.status === "confirmed" && <p className="text-green-700 font-semibold">✓ The buyer has confirmed receipt of the documents.</p>}
                </div>
              )}
              {msg[r.id] && <p className="text-[10px] text-chs-red mt-1">{msg[r.id]}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
