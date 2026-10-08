"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { Req } from "@/components/FormMarks";

// Owner side of a finished mortgage (Rent to Own): the buyer has paid in full,
// CHS is holding the final payment, and the owner must hand over the property
// documents and show proof. The buyer's phone number is never shown here.

interface Row { id: string; total_price: number; final_held_amount: number | null; status: string; properties: { title: string }[] | { title: string } | null }
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

  const load = useCallback(async () => {
    const { data } = await supabase.from("rent_to_own_agreements").select("id, total_price, final_held_amount, status, properties(title)")
      .eq("seller_id", userId).in("status", ["awaiting_handover", "completed"]).order("started_at", { ascending: false });
    const list = (data as unknown as Row[]) || [];
    setRows(list);
    const hand: Record<string, Handover | null> = {};
    await Promise.all(list.map(async (r) => {
      const { data: h } = await supabase.rpc("get_rto_handover", { p_agreement_id: r.id });
      hand[r.id] = (h as Handover) || null;
    }));
    setHandovers(hand);
  }, [userId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function send(r: Row) {
    const f = form[r.id] || { method: "courier", tracking: "", note: "" };
    const { error } = await supabase.rpc("rto_mark_documents_sent", { p_agreement_id: r.id, p_method: f.method, p_tracking: f.tracking, p_proof_note: f.note, p_proof_url: null });
    if (error) { setMsg((m) => ({ ...m, [r.id]: error.message })); return; }
    load();
  }

  const shown = rows.filter((r) => r.status === "awaiting_handover" || handovers[r.id]);
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
              {!h && <p className="text-[10px] text-gray-500 mt-1">Waiting for the buyer to ask for the documents. You will be told straight away.</p>}
              {h && (
                <div className="mt-1 text-[11px] text-gray-700 space-y-0.5">
                  <p>Send to: <b>{h.recipient_name}</b>, {h.delivery_address}</p>
                  <p>By: <b>{new Date(h.deadline).toLocaleDateString()}</b> ({h.max_days} days){h.overdue && h.status !== "confirmed" ? " · overdue" : ""}</p>
                  {h.status === "requested" && (
                    <div className="space-y-1.5 mt-1.5">
                      <label className="text-[10px] font-semibold text-gray-600">How you sent them</label>
                      <select value={f.method} onChange={(e) => setF({ method: e.target.value })} className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-white">
                        <option value="courier">Courier</option><option value="in_person">In person</option><option value="registered_post">Registered post</option>
                      </select>
                      <input value={f.tracking} onChange={(e) => setF({ tracking: e.target.value })} placeholder="Tracking number or receipt number" className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs" />
                      <label className="text-[10px] font-semibold text-gray-600">Proof: say what you sent and when <Req /></label>
                      <textarea value={f.note} onChange={(e) => setF({ note: e.target.value })} rows={2} placeholder="e.g. Deed of assignment and survey plan sent by courier on 12 October, receipt 4471" className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs" />
                      <button type="button" onClick={() => send(r)} className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold">I have sent the documents</button>
                    </div>
                  )}
                  {h.status === "sent" && <p className="text-green-700 font-semibold">✓ Proof received. Waiting for the buyer or CHS to confirm.</p>}
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
